/**
 * playerTraits.js
 * ───────────────
 * Système de traits de personnalité pour chaque joueur.
 *
 * Un trait est une caractéristique RP/gameplay qui influence :
 *   – les stats en match (via `matchPowerModifier`)
 *   – l'efficacité de l'entraînement (via `trainingModifier`)
 *   – le moral et la condition (via `weeklyMoraleDelta`, `weeklyConditionDelta`)
 *   – les finances (via `weeklyIncome`)
 *   – la dynamique d'équipe (via `teamSynergyBonus`, `mentorBonus`)
 *
 * Chaque joueur reçoit 1-2 traits de façon déterministe à partir de son `playerId`.
 */

// ─── Trait Catalog ────────────────────────────────────────────────────────────

export const TRAITS = {
  clutch: {
    id: 'clutch',
    name: 'Clutch',
    icon: '🎯',
    tone: 'positive',
    color: '#facc15', // amber-400
    description: 'Monte en puissance sous pression. +8 mental dans les matchs à haute pression.',
    matchPowerModifier: ({ isHighPressure }) => (isHighPressure ? 0.08 : 0),
  },

  shot_caller: {
    id: 'shot_caller',
    name: 'Shot-Caller',
    icon: '📢',
    tone: 'positive',
    color: '#38bdf8', // sky-400
    description: 'Oriente l\'équipe en teamfight. +4 macro, +3 synergie d\'équipe.',
    statBonuses: { macro: 4 },
    teamSynergyBonus: 3,
  },

  mechanical_prodigy: {
    id: 'mechanical_prodigy',
    name: 'Prodige Mécanique',
    icon: '⚡',
    tone: 'positive',
    color: '#a78bfa', // violet-400
    description: 'Mécaniques exceptionnelles. +6 mechanics permanent.',
    statBonuses: { mechanics: 6 },
  },

  streamer: {
    id: 'streamer',
    name: 'Streamer',
    icon: '📹',
    tone: 'neutral',
    color: '#f472b6', // pink-400
    description: '+800€/semaine via streaming, mais -2 condition/semaine (fatigue).',
    weeklyIncome: 800,
    weeklyConditionDelta: -2,
  },

  veteran: {
    id: 'veteran',
    name: 'Vétéran',
    icon: '🎖',
    tone: 'positive',
    color: '#cbd5e1', // slate-300
    description: 'L\'expérience parle. +2 mental (FM), +3 macro, résilient au tilt.',
    statBonuses: { mental: 2, macro: 3 },
    tiltResistance: 0.5,
  },

  hot_headed: {
    id: 'hot_headed',
    name: 'Sanguin',
    icon: '🔥',
    tone: 'neutral',
    color: '#f87171', // red-400
    description: 'Forme volatile. +5% dégâts quand en série de victoires, -4 mental quand tilté.',
    matchPowerModifier: ({ currentStreakWins }) => (currentStreakWins >= 2 ? 0.05 : 0),
    tiltAmplifier: 1.5,
  },

  mentor: {
    id: 'mentor',
    name: 'Mentor',
    icon: '👨‍🏫',
    tone: 'positive',
    color: '#34d399', // emerald-400
    description: 'Améliore l\'entraînement de toute l\'équipe (+10% bonus training coéquipiers).',
    mentorBonus: 0.10,
  },

  workaholic: {
    id: 'workaholic',
    name: 'Bourreau de travail',
    icon: '💼',
    tone: 'neutral',
    color: '#fb923c', // orange-400
    description: 'Entraînement personnel +20%, mais -3 moral/semaine (burnout).',
    trainingModifier: 1.20,
    weeklyMoraleDelta: -3,
  },

  rockstar: {
    id: 'rockstar',
    name: 'Rockstar',
    icon: '🎸',
    tone: 'neutral',
    color: '#e879f9', // fuchsia-400
    description: 'Valeur marketing boostée (+15% revenus sponsors). -3 focus entraînement.',
    sponsorMultiplier: 1.15,
    trainingModifier: 0.95,
  },

  grinder: {
    id: 'grinder',
    name: 'Grinder SoloQ',
    icon: '🎮',
    tone: 'positive',
    color: '#4ade80', // green-400
    description: '+25% gains de LP en SoloQ. Grinde sans fin.',
    ladderGainMultiplier: 1.25,
  },

  ice_cold: {
    id: 'ice_cold',
    name: 'Glacial',
    icon: '❄️',
    tone: 'positive',
    color: '#60a5fa', // blue-400
    description: 'Impassible. Immunisé au tilt. Moral stable même sur les défaites.',
    tiltResistance: 1.0,
  },

  playmaker: {
    id: 'playmaker',
    name: 'Playmaker',
    icon: '🎪',
    tone: 'positive',
    color: '#fcd34d', // amber-300
    description: 'Trouve les engages décisifs. +5 teamfight, +3 mechanics.',
    statBonuses: { teamfight: 5, mechanics: 3 },
  },

  workhorse: {
    id: 'workhorse',
    name: 'Cheval de trait',
    icon: '🐴',
    tone: 'positive',
    color: '#94a3b8', // slate-400
    description: 'Endurance hors norme. Pas de fatigue sur matches consécutifs.',
    fatigueResistance: 0.75,
  },

  international: {
    id: 'international',
    name: 'International',
    icon: '🌍',
    tone: 'positive',
    color: '#22d3ee', // cyan-400
    description: 'Expérience sur scènes mondiales. +6% power vs équipes internationales.',
    matchPowerModifier: ({ isInternationalMatch }) => (isInternationalMatch ? 0.06 : 0),
  },
}

/** Liste stable des IDs pour l'assignation aléatoire. */
export const TRAIT_IDS = Object.keys(TRAITS)

// ─── Assignation ──────────────────────────────────────────────────────────────

function stableHash(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i++) {
    h = (Math.imul(h ^ str.charCodeAt(i), 16777619)) >>> 0
  }
  return h
}

/**
 * Assigne 1-2 traits déterministes à un joueur basé sur son identifiant.
 *
 * Logique :
 *  - 35% chance d'avoir 2 traits, 65% d'en avoir 1.
 *  - Les 2 traits sont distincts.
 *  - Les vétérans (age >= 26) ont plus de chances d'avoir "veteran" ou "mentor".
 *  - Les jeunes (age <= 20) ont plus de chances d'avoir "mechanical_prodigy" ou "grinder".
 *
 * @param {string|number} playerId  - identifiant stable du joueur
 * @param {object} [options]
 * @param {number} [options.age]    - âge du joueur (affecte la pondération)
 * @param {string} [options.role]   - role (pas utilisé actuellement, réservé)
 * @returns {string[]} tableau de 1-2 trait IDs
 */
export function assignTraitsToPlayer(playerId, { age = 22 } = {}) {
  const seed = stableHash(`${playerId}-traits`)
  const hasDouble = (seed % 100) < 35
  const count = hasDouble ? 2 : 1

  // Pondération par âge : certains traits sont plus probables selon l'âge
  const weights = TRAIT_IDS.reduce((acc, id) => {
    let w = 10
    if (age >= 26 && (id === 'veteran' || id === 'mentor' || id === 'ice_cold' || id === 'international')) w = 28
    if (age <= 20 && (id === 'mechanical_prodigy' || id === 'grinder' || id === 'hot_headed')) w = 24
    if (age >= 23 && id === 'mechanical_prodigy') w = 6
    acc[id] = w
    return acc
  }, {})

  const totalW = Object.values(weights).reduce((s, w) => s + w, 0)
  const picked = new Set()

  for (let i = 0; i < count; i++) {
    const r = (stableHash(`${playerId}-trait-${i}`) % totalW)
    let acc = 0
    for (const id of TRAIT_IDS) {
      acc += weights[id]
      if (r < acc) {
        if (picked.has(id)) {
          // Collision : prendre le suivant disponible
          const fallback = TRAIT_IDS.find(tid => !picked.has(tid))
          if (fallback) picked.add(fallback)
        } else {
          picked.add(id)
        }
        break
      }
    }
  }

  return Array.from(picked)
}

// ─── Calculs d'effets ─────────────────────────────────────────────────────────

/**
 * Retourne le modificateur de puissance en match (somme de tous les traits).
 *
 * @param {string[]} traitIds
 * @param {object} context - { isHighPressure, currentStreakWins, isInternationalMatch, ... }
 * @returns {number} multiplicateur additif (ex: 0.12 = +12%)
 */
export function getTraitMatchPowerBonus(traitIds = [], context = {}) {
  return traitIds.reduce((acc, id) => {
    const t = TRAITS[id]
    if (!t?.matchPowerModifier) return acc
    return acc + (t.matchPowerModifier(context) || 0)
  }, 0)
}

/**
 * Retourne le multiplicateur d'entraînement (1.0 = neutre).
 *
 * @param {string[]} traitIds
 * @returns {number}
 */
export function getTraitTrainingMultiplier(traitIds = []) {
  return traitIds.reduce((acc, id) => {
    const t = TRAITS[id]
    return t?.trainingModifier ? acc * t.trainingModifier : acc
  }, 1.0)
}

/**
 * Revenu hebdomadaire cumulé issu des traits (ex: streamer).
 *
 * @param {string[]} traitIds
 * @returns {number} euros
 */
export function getTraitWeeklyIncome(traitIds = []) {
  return traitIds.reduce((acc, id) => acc + (TRAITS[id]?.weeklyIncome ?? 0), 0)
}

/** Delta hebdomadaire de moral cumulé. */
export function getTraitWeeklyMoraleDelta(traitIds = []) {
  return traitIds.reduce((acc, id) => acc + (TRAITS[id]?.weeklyMoraleDelta ?? 0), 0)
}

/** Delta hebdomadaire de condition cumulé. */
export function getTraitWeeklyConditionDelta(traitIds = []) {
  return traitIds.reduce((acc, id) => acc + (TRAITS[id]?.weeklyConditionDelta ?? 0), 0)
}

/** Multiplicateur de gains sponsors (ex: rockstar). */
export function getTraitSponsorMultiplier(traitIds = []) {
  return traitIds.reduce((acc, id) => acc * (TRAITS[id]?.sponsorMultiplier ?? 1), 1)
}

/** Multiplicateur de gains LP en SoloQ (ex: grinder). */
export function getTraitLadderMultiplier(traitIds = []) {
  return traitIds.reduce((acc, id) => acc * (TRAITS[id]?.ladderGainMultiplier ?? 1), 1)
}

/** Résistance au tilt [0, 1] (1 = immunisé). */
export function getTraitTiltResistance(traitIds = []) {
  return Math.min(1, traitIds.reduce((acc, id) => acc + (TRAITS[id]?.tiltResistance ?? 0), 0))
}

/** Bonus de synergie d'équipe cumulé (ex: shot-caller). */
export function getTraitTeamSynergyBonus(traitIds = []) {
  return traitIds.reduce((acc, id) => acc + (TRAITS[id]?.teamSynergyBonus ?? 0), 0)
}

/** Bonus d'entraînement octroyé aux coéquipiers (ex: mentor). */
export function getTraitMentorBonus(traitIds = []) {
  return traitIds.reduce((acc, id) => acc + (TRAITS[id]?.mentorBonus ?? 0), 0)
}

/**
 * Retourne les bonus de stats cumulés des traits.
 * Clés possibles : laning, teamfight, mechanics, macro, mental.
 *
 * @param {string[]} traitIds
 * @returns {{ laning: number, teamfight: number, mechanics: number, macro: number, mental: number }}
 */
export function getTraitStatBonuses(traitIds = []) {
  const acc = { laning: 0, teamfight: 0, mechanics: 0, macro: 0, mental: 0 }
  for (const id of traitIds) {
    const bonuses = TRAITS[id]?.statBonuses
    if (!bonuses) continue
    for (const key of Object.keys(acc)) {
      acc[key] += bonuses[key] ?? 0
    }
  }
  return acc
}

/**
 * Retourne le trait complet à partir de son id.
 * Utilitaire pour l'UI (ex: afficher un badge).
 */
export function getTrait(traitId) {
  return TRAITS[traitId] ?? null
}
