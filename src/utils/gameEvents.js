/**
 * gameEvents.js
 * ─────────────
 * Système d'événements dynamiques hebdomadaires : actualités, drames,
 * percées, scandales, opportunités. Chaque événement peut modifier les
 * stats, le moral, la condition, le budget, et enrichit le "news feed"
 * qui raconte l'histoire de la saison.
 *
 * Catégories :
 *   – positive  : breakthrough, viral, endorsement, win streak…
 *   – negative  : illness, scandal, tilt, injury…
 *   – neutral   : interview, invitation, transfer rumor…
 *
 * Certains événements sont déclenchés par des traits (ex: streamer → viral)
 * ou des conditions de jeu (ex: streak de victoires → confiance).
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

function stableHash(str) {
  let h = 2166136261
  for (let i = 0; i < String(str).length; i++) {
    h = (Math.imul(h ^ str.charCodeAt(i), 16777619)) >>> 0
  }
  return h
}

function seededRand(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0
  return (s >>> 0) / 4294967296
}

// ─── Event Catalog ────────────────────────────────────────────────────────────

/**
 * Chaque événement a :
 *   - id             : identifiant unique
 *   - category       : 'positive' | 'negative' | 'neutral'
 *   - icon           : emoji pour l'UI
 *   - weight         : probabilité relative (10 = standard)
 *   - triggers       : fn(ctx) → bool  (si présent, événement gated)
 *   - build(ctx)     : fn → { headline, body, effects }
 *
 * `effects` peut contenir :
 *   - moralDelta           (int, appliqué à un joueur)
 *   - conditionDelta       (int)
 *   - stats                ({ mechanics: +1, laning: +1 } appliqués au profil)
 *   - budgetDelta          (euros, ±)
 *   - ladderLpDelta        (LP)
 */
export const EVENT_POOL = [
  // ─── POSITIVE ─────────────────────────────────────────────────────────────
  {
    id: 'breakthrough_mechanics',
    category: 'positive',
    icon: '🚀',
    weight: 10,
    build: ({ player }) => ({
      headline: `${player.pseudo} fait une percée mécanique`,
      body: `Après un bloc intensif de SoloQ, ${player.pseudo} sort des combos qu'on ne lui avait jamais vus. Ses coéquipiers parlent d'un "nouveau niveau".`,
      effects: { playerId: player.playerId, stats: { mechanics: 2 }, moralDelta: 1 },
    }),
  },
  {
    id: 'stream_viral',
    category: 'positive',
    icon: '📹',
    weight: 16,
    triggers: ({ player }) => player.traits?.includes('streamer'),
    build: ({ player }) => ({
      headline: `Stream viral pour ${player.pseudo}`,
      body: `Un highlight de ${player.pseudo} explose sur les réseaux (2M de vues). Retombées publicitaires immédiates.`,
      effects: { playerId: player.playerId, budgetDelta: 3500, moralDelta: 1 },
    }),
  },
  {
    id: 'soloq_dominance',
    category: 'positive',
    icon: '👑',
    weight: 12,
    triggers: ({ player }) => player.traits?.includes('grinder'),
    build: ({ player }) => ({
      headline: `${player.pseudo} domine la SoloQ`,
      body: `${player.pseudo} trustera le top 10 EUW cette semaine. Visibilité garantie.`,
      effects: { playerId: player.playerId, ladderLpDelta: 120, moralDelta: 2 },
    }),
  },
  {
    id: 'sponsor_endorsement',
    category: 'positive',
    icon: '🤝',
    weight: 9,
    build: ({ player }) => ({
      headline: `Nouveau deal sponsoring autour de ${player.pseudo}`,
      body: `Une marque gaming signe un deal de visibilité avec ${player.pseudo} — bonus one-shot sur le budget.`,
      effects: { playerId: player.playerId, budgetDelta: 6000 },
    }),
  },
  {
    id: 'mentor_session',
    category: 'positive',
    icon: '👨‍🏫',
    weight: 14,
    triggers: ({ player }) => player.traits?.includes('mentor'),
    build: ({ player }) => ({
      headline: `${player.pseudo} coach les rookies`,
      body: `${player.pseudo} organise une session de théorycraft avec les juniors. Effet immédiat sur la chimie d'équipe.`,
      effects: { playerId: player.playerId, moralDelta: 2 },
    }),
  },
  {
    id: 'analyst_praise',
    category: 'positive',
    icon: '🎙',
    weight: 8,
    build: ({ player }) => ({
      headline: `Les analystes saluent ${player.pseudo}`,
      body: `Lors du Watch Party, le panel analyste a mis en avant la macro exemplaire de ${player.pseudo}.`,
      effects: { playerId: player.playerId, moralDelta: 2 },
    }),
  },

  // ─── NEGATIVE ─────────────────────────────────────────────────────────────
  {
    id: 'wrist_injury',
    category: 'negative',
    icon: '🤕',
    weight: 6,
    build: ({ player }) => ({
      headline: `Alerte poignet pour ${player.pseudo}`,
      body: `${player.pseudo} ressent des tensions au poignet. Repos imposé par le staff médical.`,
      effects: { playerId: player.playerId, conditionDelta: -15 },
    }),
  },
  {
    id: 'tilt_streak',
    category: 'negative',
    icon: '😤',
    weight: 10,
    triggers: ({ player }) => !player.traits?.includes('ice_cold'),
    build: ({ player }) => ({
      headline: `${player.pseudo} sur un tilt monumental`,
      body: `Une nuit de SoloQ tilted — ${player.pseudo} perd ses games clés. Coup au moral.`,
      effects: { playerId: player.playerId, moralDelta: -3, ladderLpDelta: -80 },
    }),
  },
  {
    id: 'social_drama',
    category: 'negative',
    icon: '💬',
    weight: 7,
    build: ({ player }) => ({
      headline: `Polémique Twitter autour de ${player.pseudo}`,
      body: `Un tweet maladroit de ${player.pseudo} fait du bruit. Le community manager gère, mais le moral prend un coup.`,
      effects: { playerId: player.playerId, moralDelta: -2 },
    }),
  },
  {
    id: 'illness',
    category: 'negative',
    icon: '🤒',
    weight: 7,
    build: ({ player }) => ({
      headline: `${player.pseudo} malade`,
      body: `${player.pseudo} choppe un virus. Le staff impose 3 jours de repos.`,
      effects: { playerId: player.playerId, conditionDelta: -10 },
    }),
  },
  {
    id: 'burnout_warning',
    category: 'negative',
    icon: '🔥',
    weight: 6,
    triggers: ({ player }) => player.traits?.includes('workaholic'),
    build: ({ player }) => ({
      headline: `Signes de burnout chez ${player.pseudo}`,
      body: `Le coach mental tire la sonnette d'alarme : ${player.pseudo} frôle le burnout. Pause indispensable.`,
      effects: { playerId: player.playerId, moralDelta: -4, conditionDelta: -8 },
    }),
  },

  // ─── NEUTRAL ──────────────────────────────────────────────────────────────
  {
    id: 'media_interview',
    category: 'neutral',
    icon: '🎤',
    weight: 9,
    build: ({ player }) => ({
      headline: `Interview exclusive pour ${player.pseudo}`,
      body: `${player.pseudo} accorde une longue interview à un média esport. Bonne visibilité pour l'équipe.`,
      effects: { playerId: player.playerId, budgetDelta: 1200 },
    }),
  },
  {
    id: 'rival_callout',
    category: 'neutral',
    icon: '⚔️',
    weight: 7,
    build: ({ player }) => ({
      headline: `${player.pseudo} appelé en duel`,
      body: `Un joueur d'une équipe rivale a publiquement challengé ${player.pseudo}. Le match retour est désormais chaud bouillant.`,
      effects: { playerId: player.playerId, moralDelta: 1 },
    }),
  },
  {
    id: 'transfer_rumor',
    category: 'neutral',
    icon: '🔄',
    weight: 5,
    build: ({ player }) => ({
      headline: `Rumeur de transfert : ${player.pseudo}`,
      body: `Des sources journalistiques évoquent un intérêt d'une équipe étrangère pour ${player.pseudo}. Pour l'instant, pas de négos.`,
      effects: { playerId: player.playerId, moralDelta: 0 },
    }),
  },
  {
    id: 'fan_meetup',
    category: 'neutral',
    icon: '🙌',
    weight: 8,
    build: ({ player }) => ({
      headline: `Rencontre fans avec ${player.pseudo}`,
      body: `${player.pseudo} participe à un meetup communautaire. Retour très positif des fans.`,
      effects: { playerId: player.playerId, moralDelta: 2 },
    }),
  },
]

// ─── Rolling ──────────────────────────────────────────────────────────────────

/**
 * Tire un événement hebdomadaire pour un joueur donné.
 *
 * @param {object} player - joueur cible (doit contenir playerId, pseudo, traits)
 * @param {object} [options]
 * @param {string} [options.seed='w']
 * @param {number} [options.weekIndex=0]
 * @returns {object | null} - événement construit ou null (aucun tirage)
 */
export function rollWeeklyEventForPlayer(player, { seed = 'w', weekIndex = 0 } = {}) {
  if (!player?.playerId) return null

  const ctx = { player, weekIndex }
  const eligible = EVENT_POOL.filter((evt) => !evt.triggers || evt.triggers(ctx))
  if (eligible.length === 0) return null

  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0)
  const r = seededRand(stableHash(`${seed}-${player.playerId}-${weekIndex}`)) * totalWeight

  let acc = 0
  for (const evt of eligible) {
    acc += evt.weight
    if (r <= acc) {
      const { headline, body, effects } = evt.build(ctx)
      return {
        id: `${evt.id}-${player.playerId}-${weekIndex}`,
        eventId: evt.id,
        category: evt.category,
        icon: evt.icon,
        headline,
        body,
        effects,
        weekIndex,
        timestamp: Date.now(),
      }
    }
  }
  return null
}

/**
 * Tire les événements hebdomadaires pour toute l'équipe.
 * Probabilité réduite pour ne pas spammer (chaque joueur a ~40% de chance d'avoir un event).
 *
 * @param {Array} roster - liste des joueurs (avec playerId, pseudo, traits)
 * @param {object} options
 * @param {string} options.seed
 * @param {number} options.weekIndex
 * @returns {Array} événements générés (0 à N)
 */
export function rollWeeklyEventsForRoster(roster = [], { seed = 'w', weekIndex = 0 } = {}) {
  const events = []
  for (const player of roster) {
    const chanceRng = seededRand(stableHash(`${seed}-chance-${player.playerId}-${weekIndex}`))
    if (chanceRng < 0.40) {
      const evt = rollWeeklyEventForPlayer(player, { seed, weekIndex })
      if (evt) events.push(evt)
    }
  }
  return events
}

/**
 * Calcule l'index de semaine à partir d'une date (depuis le 1er Jan 2026).
 * Utile pour savoir si une nouvelle semaine a commencé.
 */
export function getWeekIndex(date) {
  const start = new Date('2026-01-01T00:00:00').getTime()
  const diff = new Date(date).getTime() - start
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 7))
}
