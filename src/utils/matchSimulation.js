/**
 * matchSimulation.js
 * ──────────────────
 * Stats-driven MOBA match simulation for lol_manager.
 *
 * Each exported function is pure (no side-effects).
 * All positions are in the [0, 100] coordinate space used by MatchMap's SVG viewBox.
 *
 * Stats expected per player:
 *   laning    [0–100]  – lane pressure, trading, wave management
 *   mechanics [0–100]  – individual skill, roaming, outplay potential
 *   mental    [0–100]  – consistency, tilt resistance, teamfight positioning
 *   form      [0–100]  – current form (recent performance)
 *   condition [0–100]  – fatigue / physical condition
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

/** Spawn-side base positions (near nexus) */
const BASE_POSITIONS = {
  team: {
    Top:     { x: 12, y: 28 },
    Jungle:  { x: 28, y: 60 },
    Mid:     { x: 26, y: 72 },
    ADC:     { x: 54, y: 88 },
    Support: { x: 46, y: 88 },
  },
  enemy: {
    Top:     { x: 88, y: 72 },
    Jungle:  { x: 72, y: 40 },
    Mid:     { x: 74, y: 28 },
    ADC:     { x: 46, y: 12 },
    Support: { x: 54, y: 12 },
  },
}

/** Lane contest midpoints laners push toward */
const LANE_MIDPOINTS = {
  Top:     { x: 22, y: 20 },
  Mid:     { x: 50, y: 50 },
  ADC:     { x: 78, y: 80 },
  Support: { x: 74, y: 78 },
}

/** Contested objectives by type */
const OBJECTIVE_POSITIONS = {
  dragon: { x: 65, y: 64 },
  baron:  { x: 36, y: 36 },
  mid:    { x: 50, y: 50 },
}

/** Teamfight cluster offset per role (relative to objective, scaled by side direction) */
const TF_OFFSETS = {
  Top:     { x: -8, y: -5 },
  Jungle:  { x: -3, y: -2 },
  Mid:     { x:  0, y:  0 },
  ADC:     { x:  5, y:  4 },
  Support: { x:  2, y:  6 },
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/** Deterministic pseudo-random float [0, 1) from an integer seed. */
function seededRand(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0
  return (s >>> 0) / 4294967296
}

/** FNV-1a string hash → unsigned 32-bit integer. */
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h ^ str.charCodeAt(i), 16777619)) >>> 0
  }
  return h
}

/**
 * Normalises a player object so stats can be read as top-level numbers.
 * Handles both { laning: 85 } and { stats: { laning: 85 } } shapes.
 */
function normalisePlayer(player) {
  if (!player) return {}
  const s = player.stats ?? player
  return {
    role:      player.role      ?? s.role,
    laning:    s.laning    ?? player.laning    ?? 50,
    mechanics: s.mechanics ?? player.mechanics ?? 50,
    mental:    s.mental    ?? player.mental    ?? 50,
    form:      player.form ?? s.form ?? 80,
    condition: player.condition ?? s.condition ?? 100,
  }
}

// ─── Player Power ─────────────────────────────────────────────────────────────

/**
 * Returns the effective combat power [0.1, 1.0] of a player.
 *
 * Weights:
 *   Mechanics 40% – individual outplay / playmaking
 *   Laning    35% – lane dominance / gold lead
 *   Mental    25% – consistency / clutch
 *
 * Multiplied by form and a condition penalty when below 50%.
 *
 * @param {object} player
 * @param {number} [counterFactor=1.0] – draft advantage [0.7, 1.3]
 */
export function computePlayerPower(player, counterFactor = 1.0) {
  const p = normalisePlayer(player)
  const laning    = p.laning    / 100
  const mechanics = p.mechanics / 100
  const mental    = p.mental    / 100
  const form      = p.form      / 100
  const cond      = p.condition / 100

  const conditionCoef = cond >= 0.5 ? 1.0 : 0.7 + cond * 0.6
  const raw = laning * 0.35 + mechanics * 0.40 + mental * 0.25
  return clamp(raw * form * conditionCoef * counterFactor, 0.1, 1.0)
}

/**
 * Converts a draft counter score (team POV, −50…+50) into a power multiplier
 * for each side.
 *
 * @param {number} [counterScore=0]
 * @param {'team'|'enemy'} side
 */
export function getDraftCounterFactor(counterScore = 0, side = 'team') {
  const norm = counterScore / 100          // −0.5 … +0.5
  const tf = clamp(1.0 + norm * 0.5, 0.7, 1.3)
  const ef = clamp(1.0 - norm * 0.5, 0.7, 1.3)
  return side === 'team' ? tf : ef
}

/**
 * Aggregated team strength ratio [0, 1].
 * 0.5 = perfectly balanced, >0.5 = our team has an advantage.
 *
 * @param {object[]} teamRoster
 * @param {object[]} enemyRoster
 * @param {number}   [counterScore=0]
 */
export function computeTeamStrengthRatio(teamRoster = [], enemyRoster = [], counterScore = 0) {
  const tf = getDraftCounterFactor(counterScore, 'team')
  const ef = getDraftCounterFactor(counterScore, 'enemy')
  const tp = teamRoster.reduce((s, p) => s + computePlayerPower(p, tf), 0) || 0.5
  const ep = enemyRoster.reduce((s, p) => s + computePlayerPower(p, ef), 0) || 0.5
  return tp / (tp + ep)
}

// ─── Phase & Mode ─────────────────────────────────────────────────────────────

/**
 * Returns the contested objective for the current minute given the team's tactic.
 *
 * @param {number} minute
 * @param {'dragon'|'baron'|'split'|string} [prioriteObjectifs='dragon']
 */
export function getContestedObjective(minute, prioriteObjectifs = 'dragon') {
  if (prioriteObjectifs === 'baron' && minute >= 20) return OBJECTIVE_POSITIONS.baron
  if (minute < 20) return OBJECTIVE_POSITIONS.dragon
  if (minute < 27) return OBJECTIVE_POSITIONS.mid
  return OBJECTIVE_POSITIONS.baron
}

/**
 * Derives the action mode for a given minute.
 * Aggressiveness shifts mode toward fights earlier.
 *
 * @param {number} minute
 * @param {number} [aggressivite=50]
 * @param {string} [seed='x']
 * @returns {'lane'|'gank'|'teamfight'}
 */
export function getActionMode(minute, aggressivite = 50, seed = 'x') {
  const rng   = seededRand(hash(`${seed}-mode-${minute}`))
  const aggrN = aggressivite / 100

  if (minute < 8)  return rng < 0.10 + aggrN * 0.12 ? 'gank' : 'lane'
  if (minute < 15) return rng < 0.20 + aggrN * 0.16 ? 'gank' : 'lane'
  if (minute < 22) {
    if (rng < 0.20 + aggrN * 0.22) return 'teamfight'
    if (rng < 0.50)                 return 'gank'
    return 'lane'
  }
  if (rng < 0.50 + aggrN * 0.26) return 'teamfight'
  return 'gank'
}

// ─── Position Computation ─────────────────────────────────────────────────────

/**
 * Computes the (x, y) map position of a single player at a given minute.
 *
 * How stats influence positioning:
 *
 * | Stat       | Effect                                                     |
 * |------------|------------------------------------------------------------|
 * | Laning     | Laners push further into lane (more aggressive midpoint)  |
 * | Mechanics  | Jungle/Support roam deeper; all roles have cleaner paths   |
 * | Mental     | Tighter teamfight clustering; reduced jitter               |
 * | Aggressivite | Whole team positions more forward toward the objective   |
 *
 * @param {object} params
 * @param {'team'|'enemy'} params.side
 * @param {string}  params.role         – 'Top'|'Jungle'|'Mid'|'ADC'|'Support'
 * @param {object}  params.player       – raw player object (stats may be nested)
 * @param {number}  params.minute
 * @param {'lane'|'gank'|'teamfight'} params.mode
 * @param {{ x: number, y: number }} params.objective
 * @param {number}  [params.aggressivite=50]
 * @param {string}  [params.seed='x']
 * @returns {{ x: number, y: number }}
 */
export function computePlayerPosition({ side, role, player, minute, mode, objective, aggressivite = 50, seed = 'x' }) {
  const p   = normalisePlayer(player)
  const base = BASE_POSITIONS[side]?.[role] ?? { x: 50, y: 50 }

  const laning    = p.laning    / 100
  const mechanics = p.mechanics / 100
  const mental    = p.mental    / 100
  const aggrN     = aggressivite / 100

  // Positional noise — reduced by high mental (disciplined positioning)
  const noiseAmp = 3.0 * (1 - mental * 0.4)
  const jx = (seededRand(hash(`${seed}-${side}-${role}-${minute}-jx`)) - 0.5) * 2 * noiseAmp
  const jy = (seededRand(hash(`${seed}-${side}-${role}-${minute}-jy`)) - 0.5) * 2 * noiseAmp

  // ── Lane phase ────────────────────────────────────────────────────────────
  if (mode === 'lane') {
    if (role === 'Jungle') {
      // Patrol circuit: mechanics determines patrol radius
      const patrolX = side === 'team'
        ? clamp(20 + minute * 0.9 * mechanics, 12, 55)
        : clamp(80 - minute * 0.9 * mechanics, 45, 88)
      const patrolY = side === 'team'
        ? clamp(70 - minute * 0.6 * mechanics, 30, 80)
        : clamp(30 + minute * 0.6 * mechanics, 20, 70)
      const patrol = { x: patrolX, y: patrolY }
      const alpha  = clamp(0.3 + mechanics * 0.35, 0.25, 0.75)
      const pos    = lerp(base, patrol, alpha)
      return { x: clamp(pos.x + jx, 4, 96), y: clamp(pos.y + jy, 4, 96) }
    }

    const midpoint = LANE_MIDPOINTS[role]
    if (!midpoint) return { x: clamp(base.x + jx, 4, 96), y: clamp(base.y + jy, 4, 96) }

    // Forward pressure: driven by laning strength + global aggressiveness
    const laneProgress = clamp((minute / 18) * (0.38 + laning * 0.24 + aggrN * 0.12), 0, 0.64)
    const pos = lerp(base, midpoint, laneProgress)
    return { x: clamp(pos.x + jx, 4, 96), y: clamp(pos.y + jy, 4, 96) }
  }

  // ── Gank phase ────────────────────────────────────────────────────────────
  if (mode === 'gank') {
    if (role === 'Jungle' || role === 'Support') {
      // Roamers head toward a random lane; mechanics = roam depth
      const rnd1 = seededRand(hash(`${seed}-${side}-gtx-${minute}`))
      const rnd2 = seededRand(hash(`${seed}-${side}-gty-${minute}`))
      const gankTarget = { x: 25 + rnd1 * 50, y: 25 + rnd2 * 50 }
      const depth = clamp(0.45 + mechanics * 0.35 + aggrN * 0.1, 0.35, 0.88)
      const pos   = lerp(base, gankTarget, depth)
      return { x: clamp(pos.x + jx, 4, 96), y: clamp(pos.y + jy, 4, 96) }
    }

    // Laners hold their lane during ganks
    const midpoint = LANE_MIDPOINTS[role] ?? base
    const alpha = clamp((minute / 18) * 0.36, 0, 0.46)
    const pos   = lerp(base, midpoint, alpha)
    return { x: clamp(pos.x + jx, 4, 96), y: clamp(pos.y + jy, 4, 96) }
  }

  // ── Teamfight phase ───────────────────────────────────────────────────────
  // All 5 cluster around objective.
  // High mental → tighter cluster (less jitter)
  // High aggressivite → team pushes forward relative to objective
  const offset  = TF_OFFSETS[role] ?? { x: 0, y: 0 }
  const dir     = side === 'team' ? 1 : -1
  const aggrPush = aggrN * 5 * dir

  return {
    x: clamp(objective.x + offset.x * dir + jx * (1 - mental * 0.4) + aggrPush, 4, 96),
    y: clamp(objective.y + offset.y * dir + jy * (1 - mental * 0.4), 4, 96),
  }
}

// ─── Event Generation ─────────────────────────────────────────────────────────

/**
 * Checks if a kill occurs at a given minute.
 *
 * Kill frequency scales with aggressivite and game phase.
 * The winning side of each skirmish is determined by comparing individual
 * player powers (boosted/penalised by draft counter factor).
 *
 * @returns {{ winnerSide, loserSide, killerRole, victimRole, goldReward, deltaGold } | null}
 */
export function checkKillEvent({ minute, teamRoster = [], enemyRoster = [], counterScore = 0, aggressivite = 50, seed = 'x' }) {
  const rng   = seededRand(hash(`${seed}-kill-${minute}`))
  const aggrN = aggressivite / 100

  const baseRate = minute < 8 ? 0.15 : minute < 15 ? 0.22 : minute < 22 ? 0.30 : 0.38
  if (rng > baseRate + aggrN * 0.14) return null

  // Determine which role matchup generates the skirmish
  const ri1 = hash(`${seed}-killer-role-${minute}`) % ROLES.length
  const ri2 = (ri1 + 1 + hash(`${seed}-victim-role-${minute}`) % (ROLES.length - 1)) % ROLES.length

  const role1 = ROLES[ri1]
  const role2 = ROLES[ri2]

  const tp = computePlayerPower(teamRoster.find(p => p.role === role1),  getDraftCounterFactor(counterScore, 'team'))
  const ep = computePlayerPower(enemyRoster.find(p => p.role === role2), getDraftCounterFactor(counterScore, 'enemy'))

  const teamWins = seededRand(hash(`${seed}-killwinner-${minute}`)) < tp / (tp + ep)
  const winner   = teamWins ? 'team' : 'enemy'
  const loser    = teamWins ? 'enemy' : 'team'
  const reward   = 300 + Math.floor(seededRand(hash(`${seed}-kreward-${minute}`)) * 200)

  return {
    winnerSide:  winner,
    loserSide:   loser,
    killerRole:  teamWins ? role1 : role2,
    victimRole:  teamWins ? role2 : role1,
    goldReward:  reward,
    deltaGold:   teamWins ? reward : -reward,
  }
}

/**
 * Checks if an objective is contested and taken at a given minute.
 *
 * Windows: Dragon every 5 min (up to min 25), Baron at min 20+ every 6 min.
 * `prioriteObjectifs` adds a take-probability bonus for the matching objective.
 *
 * @returns {{ type, takenBy, minute } | null}
 */
export function checkObjectiveEvent({ minute, teamStrengthRatio = 0.5, tactics = {}, seed = 'x' }) {
  const { prioriteObjectifs = 'dragon', aggressivite = 50 } = tactics
  const rng = seededRand(hash(`${seed}-obj-${minute}`))

  const isDragonWindow = minute >= 5  && minute % 5 === 0 && minute <= 25
  const isBaronWindow  = minute >= 20 && (minute === 20 || minute % 6 === 0)
  if (!isDragonWindow && !isBaronWindow) return null

  const objType    = isBaronWindow && minute >= 20 ? 'baron' : 'dragon'
  const focusBonus = prioriteObjectifs === objType ? 0.14 : 0
  const aggrBonus  = (aggressivite / 100) * 0.07

  // Not every window is fully contested
  if (rng > 0.55 + aggrBonus) return null

  const teamTakeProb = clamp(teamStrengthRatio + focusBonus, 0.15, 0.90)
  const takenBy = seededRand(hash(`${seed}-objwinner-${minute}`)) < teamTakeProb ? 'team' : 'enemy'

  return { type: objType, takenBy, minute }
}

// ─── Full Timeline Simulation ─────────────────────────────────────────────────

/**
 * Simulates a full MOBA match minute-by-minute and returns a structured timeline.
 *
 * Each entry in the returned array represents one minute and contains:
 *   - `minute`      {number}
 *   - `mode`        {'lane'|'gank'|'teamfight'}
 *   - `positions`   {Object<string, {x:number, y:number}>}  e.g. 'team-Top', 'enemy-Mid'
 *   - `events`      {Array}  kill / objective events that fired this minute
 *   - `scoreboard`  {{ team, enemy }}
 *   - `goldDiff`    {number}  team.gold − enemy.gold
 *
 * @param {object} params
 * @param {Array}  params.teamRoster   – [{ role, laning?, mechanics?, mental?, form?, condition? }]
 * @param {Array}  params.enemyRoster
 * @param {object} params.draftState   – { counterScore?, playerPicks?, enemyPicks? }
 * @param {object} params.tactics      – { aggressivite?, rythmeJeu?, prioriteObjectifs?, focusJoueur? }
 * @param {string} params.matchId      – stable seed string
 * @param {number} [params.maxMinutes=33]
 * @returns {Array<object>}
 */
export function simulateMatchTimeline({
  teamRoster    = [],
  enemyRoster   = [],
  draftState    = {},
  tactics       = {},
  matchId       = 'match',
  maxMinutes    = 33,
}) {
  const { aggressivite = 50, prioriteObjectifs = 'dragon' } = tactics
  const counterScore    = draftState?.counterScore ?? 0
  const strengthRatio   = computeTeamStrengthRatio(teamRoster, enemyRoster, counterScore)
  const seed            = matchId

  const scoreboard = {
    team:  { kills: 0, gold: 14400, towers: 0, dragons: 0, barons: 0 },
    enemy: { kills: 0, gold: 14400, towers: 0, dragons: 0, barons: 0 },
  }

  const timeline = []

  for (let minute = 1; minute <= maxMinutes; minute++) {
    const mode      = getActionMode(minute, aggressivite, seed)
    const objective = getContestedObjective(minute, prioriteObjectifs)

    // Passive gold income per minute
    scoreboard.team.gold  += 480 + minute * 5
    scoreboard.enemy.gold += 480 + minute * 5

    // Compute positions for all 10 players
    const positions = {}
    for (const player of teamRoster) {
      positions[`team-${player.role}`] = computePlayerPosition({
        side: 'team', role: player.role, player, minute, mode, objective, aggressivite, seed,
      })
    }
    for (const player of enemyRoster) {
      positions[`enemy-${player.role}`] = computePlayerPosition({
        side: 'enemy', role: player.role, player, minute, mode, objective, aggressivite, seed,
      })
    }

    // Fire events
    const events = []

    const kill = checkKillEvent({ minute, teamRoster, enemyRoster, counterScore, aggressivite, seed })
    if (kill) {
      events.push({ type: 'kill', ...kill })
      scoreboard[kill.winnerSide].kills += 1
      scoreboard[kill.winnerSide].gold  += kill.goldReward
    }

    const obj = checkObjectiveEvent({ minute, teamStrengthRatio: strengthRatio, tactics, seed })
    if (obj) {
      events.push({ type: 'objective', ...obj })
      if (obj.type === 'dragon') scoreboard[obj.takenBy].dragons += 1
      if (obj.type === 'baron') {
        scoreboard[obj.takenBy].barons  += 1
        scoreboard[obj.takenBy].towers  += 1     // Baron buff usually yields tower
        scoreboard[obj.takenBy].gold    += 1500  // Baron bounty
      }
    }

    timeline.push({
      minute,
      mode,
      positions,
      events,
      goldDiff: scoreboard.team.gold - scoreboard.enemy.gold,
      scoreboard: {
        team:  { ...scoreboard.team },
        enemy: { ...scoreboard.enemy },
      },
    })
  }

  return timeline
}
