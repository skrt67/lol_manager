/**
 * matchEngine.js
 * ──────────────
 * Moteur de simulation de match LoL narratif + positionnel.
 *
 * Philosophie : pas un vrai moteur physique/combat, mais une simulation
 * narrative déterministe (par seed) qui produit des événements crédibles
 * et des trajectoires de joueurs lisibles sur minimap.
 *
 * Modèle de temps :
 *   – Le moteur est agnostique au temps réel. Tu l'avances de N game-seconds
 *     via `advanceMatch(state, dtSeconds)`. L'UI décide du mapping real↔game.
 *   – Une game typique : 25-42 game-minutes. Le moteur stoppe quand le nexus
 *     de l'un des camps tombe.
 *
 * API publique :
 *   – createMatch({ blueRoster, redRoster, seed, draft? }) → state initial
 *   – advanceMatch(state, dtSeconds) → nouveau state
 *   – isFinished(state) → boolean
 *   – getWinner(state) → 'blue' | 'red' | null
 *
 * État (simplifié) :
 *   {
 *     gameTimeSec, phase, status, winner,
 *     units: { [unitId]: { id, side, role, championId, x, y, alive,
 *                          hp, respawnAt, kda, cs, gold, level } },
 *     score: {
 *       blue|red: { kills, towers, dragons, heralds, barons, inhibitors,
 *                   soul, baronBuffUntil, gold, nexusHp }
 *     },
 *     objectives: { nextDragonAt, nextHeraldAt, nextBaronAt, dragonStack },
 *     events: [{ id, timeSec, type, side, description, icon }],
 *     rngState: number,
 *   }
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES = ['top', 'jungle', 'mid', 'adc', 'support']

const PHASES = {
  EARLY:    { from: 0,    to: 840 },   // 0 → 14 min : laning pure
  SKIRMISH: { from: 840,  to: 1500 },  // 14 → 25 min : rotations / herald + dragons
  MID:      { from: 1500, to: 1800 },  // 25 → 30 min : first tower + inhib
  LATE:     { from: 1800, to: 99999 }, // 30+ : baron / sieges / winning condition
}

// Positions d'ancrage par side/role/phase (x/y en [0..100])
// Calibrées sur la minimap de la Faille : bleu bas-gauche, rouge haut-droit.
const LANE_ANCHORS = {
  blue: {
    top:     { x: 16, y: 46 },
    jungle:  { x: 34, y: 54 },
    mid:     { x: 42, y: 54 },
    adc:     { x: 60, y: 84 },
    support: { x: 56, y: 82 },
  },
  red: {
    top:     { x: 40, y: 16 },
    jungle:  { x: 62, y: 46 },
    mid:     { x: 54, y: 46 },
    adc:     { x: 82, y: 56 },
    support: { x: 84, y: 58 },
  },
}

// Points d'intérêt objectifs
const POI = {
  dragon:  { x: 70, y: 72 },
  baron:   { x: 30, y: 28 },
  herald:  { x: 30, y: 28 },
  midLane: { x: 50, y: 50 },
  blueBase: { x: 8,  y: 92 },
  redBase:  { x: 92, y: 8  },
}

// Timers d'objectifs (game-seconds)
const OBJECTIVE_TIMINGS = {
  firstDragon:  5 * 60,      // 5:00
  dragonCooldown: 5 * 60,    // 5 min entre dragons
  soulAtStack: 4,            // soul au 4e dragon d'une team
  firstHerald:  8 * 60,      // 8:00
  heraldCooldown: 6 * 60,
  heraldDespawnAt: 19 * 60 + 45, // herald despawn avant baron
  firstBaron:  20 * 60,      // 20:00
  baronCooldown: 6 * 60,
  baronBuffDuration: 3 * 60, // 3 min
}

const DRAGON_TYPES = ['Infernal', 'Mountain', 'Ocean', 'Cloud', 'Hextech', 'Chemtech']

// ─── PRNG (mulberry32, deterministic) ────────────────────────────────────────

function mulberry32(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(input) {
  const s = String(input ?? 'default')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function getPhase(gameTimeSec) {
  if (gameTimeSec < PHASES.EARLY.to)    return 'laning'
  if (gameTimeSec < PHASES.SKIRMISH.to) return 'skirmish'
  if (gameTimeSec < PHASES.MID.to)      return 'mid'
  return 'late'
}

function makeEvent(state, { type, side, description, icon, data }) {
  return {
    id: `evt-${state.events.length}-${state.gameTimeSec | 0}`,
    timeSec: state.gameTimeSec,
    type,
    side: side ?? null,
    description,
    icon: icon ?? '•',
    data: data ?? null,
  }
}

function pushEvent(state, evt) {
  state.events.push(makeEvent(state, evt))
  // Garde-fou : cap à 200 derniers
  if (state.events.length > 200) state.events.shift()
}

// ─── Roster normalization ────────────────────────────────────────────────────

/**
 * Normalise un roster entrant en 5 unités indexées par role.
 * @param {Array<{role, championId?, pseudo?, name?}>} roster
 */
function normalizeRoster(roster = []) {
  const byRole = {}
  for (const role of ROLES) {
    const found = roster.find((p) =>
      (p.role ?? '').toLowerCase() === role ||
      (p.role_id ?? '').toLowerCase() === role,
    )
    byRole[role] = {
      role,
      championId: found?.championId ?? found?.champion ?? null,
      pseudo: found?.pseudo ?? found?.name ?? found?.joueur ?? role.toUpperCase(),
      power: clamp(found?.power ?? found?.niveau ?? 75, 40, 99),
    }
  }
  return byRole
}

// ─── createMatch ─────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {Array} opts.blueRoster - [{role, championId, pseudo, power}] (len 5)
 * @param {Array} opts.redRoster  - idem
 * @param {string|number} [opts.seed]
 * @param {object} [opts.draft]   - optionnel : metadata draft pour enrichir events
 * @param {number} [opts.powerBias] - [-1..+1] skew du matchmaking en faveur du bleu (+) ou rouge (-)
 * @returns état initial
 */
export function createMatch({ blueRoster = [], redRoster = [], seed, draft = null, powerBias = 0 } = {}) {
  const blue = normalizeRoster(blueRoster)
  const red = normalizeRoster(redRoster)

  const units = {}
  for (const role of ROLES) {
    const anchor = LANE_ANCHORS.blue[role]
    units[`blue-${role}`] = {
      id: `blue-${role}`,
      side: 'blue',
      role,
      championId: blue[role]?.championId ?? null,
      pseudo: blue[role]?.pseudo ?? role,
      power: blue[role]?.power ?? 75,
      x: anchor.x, y: anchor.y,
      targetX: anchor.x, targetY: anchor.y,
      alive: true, hp: 100, respawnAt: 0,
      kda: { k: 0, d: 0, a: 0 },
      cs: 0, gold: 500, level: 1,
    }
    const anchorR = LANE_ANCHORS.red[role]
    units[`red-${role}`] = {
      id: `red-${role}`,
      side: 'red',
      role,
      championId: red[role]?.championId ?? null,
      pseudo: red[role]?.pseudo ?? role,
      power: red[role]?.power ?? 75,
      x: anchorR.x, y: anchorR.y,
      targetX: anchorR.x, targetY: anchorR.y,
      alive: true, hp: 100, respawnAt: 0,
      kda: { k: 0, d: 0, a: 0 },
      cs: 0, gold: 500, level: 1,
    }
  }

  const scoreBase = () => ({
    kills: 0, towers: 0, dragons: 0, heralds: 0, barons: 0, inhibitors: 0,
    soul: null, baronBuffUntil: 0, gold: 2500, nexusHp: 100,
  })

  return {
    gameTimeSec: 0,
    phase: 'laning',
    status: 'ongoing',
    winner: null,
    units,
    score: { blue: scoreBase(), red: scoreBase() },
    objectives: {
      nextDragonAt: OBJECTIVE_TIMINGS.firstDragon,
      nextHeraldAt: OBJECTIVE_TIMINGS.firstHerald,
      nextBaronAt:  OBJECTIVE_TIMINGS.firstBaron,
      dragonStack: { blue: 0, red: 0 },
      lastDragonType: null,
    },
    events: [],
    rngState: hashSeed(seed ?? `match-${Date.now()}`),
    powerBias: clamp(powerBias, -1, 1),
    draft,
    // Internals
    _replanCooldown: 0,
    _teamfightCooldown: 0,
    _firstBloodDone: false,
  }
}

// ─── Unit planning (where each unit wants to go) ─────────────────────────────

function planUnits(state, rand) {
  const phase = state.phase
  const t = state.gameTimeSec

  // Détermine l'objectif le plus chaud
  let hotObjective = null
  const secToDragon = state.objectives.nextDragonAt - t
  const secToBaron  = state.objectives.nextBaronAt - t
  const secToHerald = state.objectives.nextHeraldAt - t

  if (phase !== 'laning') {
    if (secToBaron > 0 && secToBaron < 30 && t >= 20 * 60) hotObjective = 'baron'
    else if (secToDragon > 0 && secToDragon < 25) hotObjective = 'dragon'
    else if (secToHerald > 0 && secToHerald < 25 && t < OBJECTIVE_TIMINGS.heraldDespawnAt) hotObjective = 'herald'
  }

  for (const unit of Object.values(state.units)) {
    if (!unit.alive) continue
    const anchor = LANE_ANCHORS[unit.side][unit.role]

    if (phase === 'laning') {
      // Laning : chaque unité reste près de son anchor avec micro-mouvement
      const jitter = rand() * 4 - 2
      unit.targetX = clamp(anchor.x + jitter, 4, 96)
      unit.targetY = clamp(anchor.y + jitter, 4, 96)

      // La jungle se balade entre son côté et la rivière
      if (unit.role === 'jungle') {
        const side = rand() < 0.5 ? 'top' : 'bot'
        const target = side === 'top'
          ? { x: unit.side === 'blue' ? 22 : 50, y: unit.side === 'blue' ? 40 : 22 }
          : { x: unit.side === 'blue' ? 50 : 76, y: unit.side === 'blue' ? 78 : 60 }
        unit.targetX = target.x
        unit.targetY = target.y
      }
      return
    }

    // Skirmish / mid / late : rotations vers objectif chaud
    if (hotObjective) {
      const target = POI[hotObjective]
      // Chaque membre s'approche avec un petit offset par role (pour étalement)
      const roleOffset = {
        top: { x: -4, y: 2 }, jungle: { x: 0, y: 0 }, mid: { x: 2, y: 0 },
        adc: { x: 4, y: -2 }, support: { x: 3, y: 3 },
      }[unit.role] ?? { x: 0, y: 0 }
      unit.targetX = clamp(target.x + roleOffset.x, 4, 96)
      unit.targetY = clamp(target.y + roleOffset.y, 4, 96)
      return
    }

    // Pas d'objectif chaud : retour sur lane ou farming jungle
    const jitter = rand() * 6 - 3
    unit.targetX = clamp(anchor.x + jitter, 4, 96)
    unit.targetY = clamp(anchor.y + jitter, 4, 96)
  }
}

// ─── Unit movement + passive income per tick ────────────────────────────────

function tickUnits(state, dt) {
  for (const unit of Object.values(state.units)) {
    // Respawn check
    if (!unit.alive && state.gameTimeSec >= unit.respawnAt) {
      unit.alive = true
      unit.hp = 100
      const base = unit.side === 'blue' ? POI.blueBase : POI.redBase
      unit.x = base.x
      unit.y = base.y
    }
    if (!unit.alive) continue

    // Move vers target (interpolation proportionnelle au dt)
    const speed = 6  // pct per game-second
    const dx = unit.targetX - unit.x
    const dy = unit.targetY - unit.y
    const dist = Math.hypot(dx, dy)
    const step = Math.min(speed * dt, dist)
    if (dist > 0.5) {
      unit.x += (dx / dist) * step
      unit.y += (dy / dist) * step
    }

    // Passive income (cs, gold, xp) dépend de la phase
    // Laning CS : ~6 cs/min + more in later
    const minute = state.gameTimeSec / 60
    const csRate = unit.role === 'support' ? 0.5 : (minute < 14 ? 7 : 5) // per min
    const goldPerCs = 21
    const dCs = (csRate / 60) * dt
    unit.cs += dCs
    unit.gold += dCs * goldPerCs + 2.5 * dt  // 2.5 gold/s passive
    unit.level = clamp(1 + Math.floor(minute * 0.6), 1, 18)
  }
}

// ─── Random events (kills, ganks, tower, objective contests) ────────────────

function tryFirstBlood(state, rand) {
  if (state._firstBloodDone) return
  if (state.gameTimeSec < 90) return         // pas avant 1:30
  if (state.gameTimeSec > 5 * 60) {           // au max à 5 min, on force
    if (rand() < 0.05) registerKill(state, rand, { firstBlood: true })
    return
  }
  if (rand() < 0.015) registerKill(state, rand, { firstBlood: true })
}

function registerKill(state, rand, { firstBlood = false, winner = null, atObjective = null } = {}) {
  // Détermine camp gagnant : base sur le powerBias + aléatoire
  const side = winner ?? (rand() < 0.5 + state.powerBias * 0.1 ? 'blue' : 'red')
  const loser = side === 'blue' ? 'red' : 'blue'

  // Pick a killer and victim role (aléatoires différents)
  const killerRole = ROLES[Math.floor(rand() * ROLES.length)]
  let victimRole   = ROLES[Math.floor(rand() * ROLES.length)]
  if (victimRole === killerRole) victimRole = ROLES[(ROLES.indexOf(victimRole) + 1) % ROLES.length]

  const killerUnit = state.units[`${side}-${killerRole}`]
  const victimUnit = state.units[`${loser}-${victimRole}`]
  if (!killerUnit?.alive || !victimUnit?.alive) return

  killerUnit.kda.k += 1
  killerUnit.gold += 300 + (firstBlood ? 150 : 0)
  victimUnit.kda.d += 1
  victimUnit.alive = false
  victimUnit.hp = 0
  victimUnit.respawnAt = state.gameTimeSec + respawnTime(state.gameTimeSec)

  // Assists: 0-2 assists aléatoires dans l'équipe killer
  const assistCount = Math.floor(rand() * 3)
  const assistRoles = ROLES.filter((r) => r !== killerRole).sort(() => rand() - 0.5).slice(0, assistCount)
  for (const r of assistRoles) {
    const u = state.units[`${side}-${r}`]
    if (u?.alive) {
      u.kda.a += 1
      u.gold += 150
    }
  }

  state.score[side].kills += 1
  state.score[side].gold += 300

  const fbLabel = firstBlood ? 'FIRST BLOOD — ' : ''
  const desc = `${fbLabel}${killerUnit.pseudo} élimine ${victimUnit.pseudo}${atObjective ? ` sur ${atObjective}` : ''}`
  pushEvent(state, { type: 'kill', side, description: desc, icon: '⚔', data: { killer: killerUnit.id, victim: victimUnit.id, firstBlood } })

  if (firstBlood) state._firstBloodDone = true
}

function respawnTime(gameSec) {
  // Respawn approx LoL : 8s early → 50s late
  const min = gameSec / 60
  return clamp(8 + min * 1.3, 8, 60)
}

function tryGankOrSkirmish(state, rand) {
  if (state._teamfightCooldown > 0) return
  const phase = state.phase
  const baseChance = phase === 'laning' ? 0.006 : phase === 'skirmish' ? 0.018 : 0.012
  if (rand() >= baseChance) return

  registerKill(state, rand)
  state._teamfightCooldown = 25  // 25s cooldown between combat events
}

function tryTeamfight(state, rand) {
  // Proximité des unités sur un objectif chaud
  const phase = state.phase
  if (phase === 'laning') return
  if (state._teamfightCooldown > 0) return
  if (rand() >= 0.01) return

  // Team fight : 1-4 kills distribués, majoritairement d'un côté
  const winnerBlue = rand() < 0.5 + state.powerBias * 0.15 + (state.score.blue.gold - state.score.red.gold) / 30000
  const side = winnerBlue ? 'blue' : 'red'
  const kills = 2 + Math.floor(rand() * 3) // 2-4 kills
  for (let i = 0; i < kills; i++) registerKill(state, rand, { winner: side, atObjective: 'teamfight' })
  state._teamfightCooldown = 45

  pushEvent(state, { type: 'teamfight', side, description: `Teamfight remporté (${kills}-0) par le camp ${side === 'blue' ? 'bleu' : 'rouge'}`, icon: '⚔', data: { kills } })
}

// ─── Objective resolution ────────────────────────────────────────────────────

function tryContestObjective(state, rand) {
  const t = state.gameTimeSec

  // Dragon
  if (t >= state.objectives.nextDragonAt) {
    const side = rand() < 0.5 + state.powerBias * 0.1 ? 'blue' : 'red'
    state.score[side].dragons += 1
    state.score[side].gold += 500
    state.objectives.dragonStack[side] += 1
    state.objectives.nextDragonAt = t + OBJECTIVE_TIMINGS.dragonCooldown

    const type = DRAGON_TYPES[Math.floor(rand() * DRAGON_TYPES.length)]
    state.objectives.lastDragonType = type

    if (state.objectives.dragonStack[side] >= OBJECTIVE_TIMINGS.soulAtStack && !state.score[side].soul) {
      state.score[side].soul = type
      pushEvent(state, { type: 'dragon-soul', side, description: `ÂME DU DRAGON ${type.toUpperCase()} pour le camp ${side === 'blue' ? 'bleu' : 'rouge'} !`, icon: '👑' })
    } else {
      pushEvent(state, { type: 'dragon', side, description: `Dragon ${type} pris par le camp ${side === 'blue' ? 'bleu' : 'rouge'}`, icon: '🐉' })
    }
    // Souvent un ou deux morts sur contest
    if (rand() < 0.55) registerKill(state, rand, { winner: side, atObjective: 'Dragon' })
    return
  }

  // Herald
  if (t >= state.objectives.nextHeraldAt && t < OBJECTIVE_TIMINGS.heraldDespawnAt) {
    const side = rand() < 0.5 ? 'blue' : 'red'
    state.score[side].heralds += 1
    state.score[side].gold += 300
    state.objectives.nextHeraldAt = 99999 // Un seul Herald (Herald #2 après en vrai, simplifié)
    pushEvent(state, { type: 'herald', side, description: `Herald pris par le camp ${side === 'blue' ? 'bleu' : 'rouge'}`, icon: '👁' })
    return
  }

  // Baron
  if (t >= state.objectives.nextBaronAt) {
    const side = rand() < 0.5 + state.powerBias * 0.1 ? 'blue' : 'red'
    state.score[side].barons += 1
    state.score[side].gold += 1500
    state.score[side].baronBuffUntil = t + OBJECTIVE_TIMINGS.baronBuffDuration
    state.objectives.nextBaronAt = t + OBJECTIVE_TIMINGS.baronCooldown
    pushEvent(state, { type: 'baron', side, description: `BARON NASHOR pris par le camp ${side === 'blue' ? 'bleu' : 'rouge'} !`, icon: '🐲' })
    if (rand() < 0.65) registerKill(state, rand, { winner: side, atObjective: 'Baron' })
    return
  }
}

// ─── Towers / inhibitors / nexus ─────────────────────────────────────────────

function tryTower(state, rand) {
  if (state.phase === 'laning' && state.gameTimeSec < 10 * 60) return // pas de tour avant 10 min
  const base = state.phase === 'laning' ? 0.003 : state.phase === 'skirmish' ? 0.01 : 0.02
  if (rand() >= base) return

  // Le camp qui a le momentum prend la tour
  const diff = state.score.blue.gold - state.score.red.gold
  const side = diff > 0 ? (rand() < 0.7 ? 'blue' : 'red') : (rand() < 0.7 ? 'red' : 'blue')

  // Soft cap : 11 tours par camp adverse max
  const enemy = side === 'blue' ? 'red' : 'blue'
  const enemyLost = state.score[side].towers
  if (enemyLost >= 11) {
    // Inhibitor
    if (state.score[side].inhibitors < 3) {
      state.score[side].inhibitors += 1
      state.score[side].gold += 400
      pushEvent(state, { type: 'inhibitor', side, description: `Inhibiteur détruit par le camp ${side === 'blue' ? 'bleu' : 'rouge'} !`, icon: '💥' })
      return
    }
    // Nexus damage
    state.score[enemy].nexusHp = Math.max(0, state.score[enemy].nexusHp - 30)
    pushEvent(state, { type: 'nexus-damage', side, description: `Le Nexus ${enemy === 'blue' ? 'bleu' : 'rouge'} est attaqué (${state.score[enemy].nexusHp}%)`, icon: '🔥' })
    if (state.score[enemy].nexusHp <= 0) {
      state.status = 'finished'
      state.winner = side
      pushEvent(state, { type: 'nexus', side, description: `VICTOIRE ${side === 'blue' ? 'BLEUE' : 'ROUGE'} — Nexus détruit`, icon: '🏆' })
    }
    return
  }
  state.score[side].towers += 1
  state.score[side].gold += 250
  pushEvent(state, { type: 'tower', side, description: `Tour détruite par le camp ${side === 'blue' ? 'bleu' : 'rouge'}`, icon: '🗼' })
}

// ─── advanceMatch (public) ───────────────────────────────────────────────────

/**
 * Avance l'état du match de `dtSeconds` secondes de jeu.
 * `dtSeconds` devrait être ≤ 3 pour garder la précision des events.
 * Si tu veux avancer de plus, appelle cette fonction en boucle.
 */
export function advanceMatch(state, dtSeconds) {
  if (state.status !== 'ongoing') return state
  const rand = mulberry32(state.rngState)
  // Avance interne par sous-pas ≤ 1s pour éviter de rater des events
  let remaining = dtSeconds
  while (remaining > 0 && state.status === 'ongoing') {
    const step = Math.min(remaining, 1)
    state.gameTimeSec += step
    state.phase = getPhase(state.gameTimeSec)
    state._teamfightCooldown = Math.max(0, state._teamfightCooldown - step)
    state._replanCooldown = Math.max(0, state._replanCooldown - step)

    // Replan toutes les 4-7s
    if (state._replanCooldown <= 0) {
      planUnits(state, rand)
      state._replanCooldown = 4 + rand() * 3
    }

    tickUnits(state, step)
    tryFirstBlood(state, rand)
    tryGankOrSkirmish(state, rand)
    tryTeamfight(state, rand)
    tryContestObjective(state, rand)
    tryTower(state, rand)

    remaining -= step
  }

  // Met à jour rngState pour le prochain appel (determinisme relatif)
  state.rngState = (state.rngState + 0x9e3779b9) >>> 0

  // Sync gold globaux au pot de l'équipe
  let blueGold = 0, redGold = 0
  for (const u of Object.values(state.units)) {
    if (u.side === 'blue') blueGold += u.gold
    else redGold += u.gold
  }
  state.score.blue.gold = Math.round(blueGold)
  state.score.red.gold = Math.round(redGold)

  return state
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function isFinished(state) {
  return state?.status === 'finished'
}

export function getWinner(state) {
  return state?.winner ?? null
}

export function formatGameTime(gameTimeSec) {
  const t = Math.max(0, Math.floor(gameTimeSec))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export { ROLES, LANE_ANCHORS, POI }
