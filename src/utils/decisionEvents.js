/**
 * decisionEvents.js
 * ─────────────────
 * Événements à choix multiples (press conferences, drames internes, décisions
 * managériales). Chaque événement propose 2-3 choix au joueur, chaque choix
 * ayant ses propres conséquences (moral, budget, réputation, stats).
 *
 * Flux :
 *   1) rollWeeklyDecision(roster) → peut retourner une décision pending
 *   2) Le joueur voit un modal et choisit une option
 *   3) resolveDecision(choiceId) applique les effets du choix
 *
 * Les effets ont le même format que les events classiques :
 *   { playerId, conditionDelta, moralDelta, budgetDelta, ladderLpDelta, stats, reputationDelta }
 */

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

// ─── Decision Catalog ─────────────────────────────────────────────────────────

export const DECISION_POOL = [
  {
    id: 'post_loss_interview',
    icon: '🎙',
    weight: 12,
    build: ({ player }) => ({
      headline: `Interview post-match : ${player.pseudo}`,
      prompt: `Un journaliste demande à ${player.pseudo} ce qu'il pense de la dernière défaite. Comment tu briefes sa réponse ?`,
      choices: [
        {
          id: 'accountable',
          label: 'Responsabiliser',
          description: `"On a mal joué ce match. Je prends ma part et on travaille."`,
          summary: `${player.pseudo} a assumé publiquement. L'équipe apprécie la maturité.`,
          effects: { playerId: player.playerId, moralDelta: 2, reputationDelta: +1 },
        },
        {
          id: 'blame_meta',
          label: 'Blâmer le patch',
          description: `"Le patch actuel nous handicape, on attend des nerfs."`,
          summary: `${player.pseudo} a critiqué le meta. Les fans sont mitigés.`,
          effects: { playerId: player.playerId, moralDelta: 0, reputationDelta: -1 },
        },
        {
          id: 'deflect_team',
          label: 'Minimiser',
          description: `"C'est du sport, ça arrive. On passe à autre chose."`,
          summary: `${player.pseudo} a expédié l'interview. Réponse neutre, pas de drame.`,
          effects: { playerId: player.playerId, moralDelta: -1, reputationDelta: 0 },
        },
      ],
    }),
  },

  {
    id: 'salary_raise',
    icon: '💰',
    weight: 9,
    build: ({ player }) => ({
      headline: `${player.pseudo} demande une augmentation`,
      prompt: `${player.pseudo} estime que son niveau justifie un meilleur salaire. Comment tu gères la demande ?`,
      choices: [
        {
          id: 'accept',
          label: 'Accepter (−15k€)',
          description: `Accorder l'augmentation demandée. Le joueur est reconnaissant.`,
          summary: `${player.pseudo} est ravi. Gros boost de moral, mais impact budget.`,
          effects: { playerId: player.playerId, moralDelta: 4, budgetDelta: -15000 },
        },
        {
          id: 'negotiate',
          label: 'Négocier (−5k€)',
          description: `Proposer un arrangement intermédiaire avec bonus de perf.`,
          summary: `${player.pseudo} accepte le compromis. Moral légèrement boosté.`,
          effects: { playerId: player.playerId, moralDelta: 1, budgetDelta: -5000 },
        },
        {
          id: 'refuse',
          label: 'Refuser',
          description: `Refuser fermement. Le contrat actuel reste.`,
          summary: `${player.pseudo} est déçu. La relation se tend.`,
          effects: { playerId: player.playerId, moralDelta: -5 },
        },
      ],
    }),
  },

  {
    id: 'rest_request',
    icon: '🛌',
    weight: 10,
    build: ({ player }) => ({
      headline: `${player.pseudo} demande du repos`,
      prompt: `${player.pseudo} se sent épuisé après plusieurs semaines intenses et demande une pause. Ta décision ?`,
      choices: [
        {
          id: 'grant',
          label: 'Accorder (3 jours)',
          description: `Repos forcé, pas de scrims ni SoloQ pendant 3 jours.`,
          summary: `${player.pseudo} a récupéré. Condition au top.`,
          effects: { playerId: player.playerId, conditionDelta: 20, moralDelta: 2 },
        },
        {
          id: 'half',
          label: 'Demi-mesure',
          description: `Allègement du planning sans pause complète.`,
          summary: `${player.pseudo} a récupéré partiellement.`,
          effects: { playerId: player.playerId, conditionDelta: 8, moralDelta: 0 },
        },
        {
          id: 'refuse',
          label: 'Refuser',
          description: `Maintenir le planning intensif. Scrims + SoloQ continuent.`,
          summary: `${player.pseudo} est épuisé et mécontent.`,
          effects: { playerId: player.playerId, conditionDelta: -8, moralDelta: -3 },
        },
      ],
    }),
  },

  {
    id: 'sponsor_controversy',
    icon: '⚠️',
    weight: 7,
    build: ({ player }) => ({
      headline: `Sponsor controversé sur la table`,
      prompt: `Une marque de paris propose un deal juteux mais polémique. ${player.pseudo} serait la face du deal.`,
      choices: [
        {
          id: 'accept',
          label: 'Accepter (+25k€)',
          description: `Signer le deal. Cash immédiat mais risque d'image.`,
          summary: `Le deal est signé. Trésorerie renforcée, la com' monte en pression.`,
          effects: { playerId: player.playerId, budgetDelta: 25000, reputationDelta: -2, moralDelta: -1 },
        },
        {
          id: 'refuse',
          label: 'Refuser',
          description: `Décliner poliment. Pas de cash mais image protégée.`,
          summary: `Deal refusé. Les fans apprécient l'intégrité.`,
          effects: { playerId: player.playerId, reputationDelta: +2 },
        },
      ],
    }),
  },

  {
    id: 'tilt_scandal',
    icon: '😡',
    weight: 6,
    triggers: ({ player }) => !player.traits?.includes('ice_cold'),
    build: ({ player }) => ({
      headline: `Scandale : ${player.pseudo} a flamé en SoloQ`,
      prompt: `Des captures d'écran de ${player.pseudo} flamant coéquipiers fuient sur Twitter. Tu gères comment ?`,
      choices: [
        {
          id: 'sanction',
          label: 'Sanctionner publiquement',
          description: `Communiqué officiel : ${player.pseudo} est mis à l'amende.`,
          summary: `Sanction appliquée. Le public apprécie la fermeté, le joueur encaisse.`,
          effects: { playerId: player.playerId, moralDelta: -3, reputationDelta: +1, budgetDelta: 2000 },
        },
        {
          id: 'defend',
          label: 'Défendre publiquement',
          description: `Soutenir ${player.pseudo} en minimisant l'incident.`,
          summary: `${player.pseudo} se sent soutenu. Les fans sont partagés.`,
          effects: { playerId: player.playerId, moralDelta: +3, reputationDelta: -1 },
        },
        {
          id: 'ignore',
          label: 'Ignorer',
          description: `Pas de communication officielle. Laisser passer.`,
          summary: `Le buzz retombe tout seul. Pas d'impact majeur.`,
          effects: { playerId: player.playerId, moralDelta: 0, reputationDelta: 0 },
        },
      ],
    }),
  },

  {
    id: 'show_match_invite',
    icon: '🎪',
    weight: 8,
    build: ({ player }) => ({
      headline: `Invitation show-match caritatif`,
      prompt: `${player.pseudo} est invité à un show-match de charité. Trois jours hors scrims. Tu acceptes ?`,
      choices: [
        {
          id: 'accept',
          label: 'Participer',
          description: `Visibilité maximale + bon karma, mais moins de temps d'entraînement.`,
          summary: `${player.pseudo} a brillé au show-match. Gros boost d'image.`,
          effects: { playerId: player.playerId, conditionDelta: -5, reputationDelta: +2, budgetDelta: 3000 },
        },
        {
          id: 'refuse',
          label: 'Décliner',
          description: `Focus sur l'entraînement. Moins de visibilité.`,
          summary: `${player.pseudo} a préféré le travail. L'équipe garde son rythme.`,
          effects: { playerId: player.playerId, conditionDelta: 5 },
        },
      ],
    }),
  },

  {
    id: 'champion_pool_gap',
    icon: '📚',
    weight: 10,
    build: ({ player }) => ({
      headline: `Pool de champions à élargir ?`,
      prompt: `L'analyste note que ${player.pseudo} a un pool trop étroit pour le meta actuel. Tu investis ?`,
      choices: [
        {
          id: 'deep_dive',
          label: 'Stage intensif',
          description: `Bloc complet dédié à apprendre 2 nouveaux champions.`,
          summary: `${player.pseudo} a élargi son pool. +3 mechanics, mais fatigue accumulée.`,
          effects: { playerId: player.playerId, stats: { mechanics: 3 }, conditionDelta: -8 },
        },
        {
          id: 'soft_learn',
          label: 'Apprentissage léger',
          description: `Sessions SoloQ orientées sans sacrifier les scrims.`,
          summary: `${player.pseudo} a progressé modérément. +1 mechanics.`,
          effects: { playerId: player.playerId, stats: { mechanics: 1 } },
        },
        {
          id: 'skip',
          label: 'Pas maintenant',
          description: `Continuer avec le pool actuel.`,
          summary: `Pas de changement. Le pool reste étroit.`,
          effects: {},
        },
      ],
    }),
  },
]

// ─── Rolling ──────────────────────────────────────────────────────────────────

/**
 * Tire au plus 1 décision hebdomadaire parmi le roster (~30% de chance).
 * Si une décision est tirée, on choisit un joueur aléatoire et une décision
 * éligible (via trigger optionnel).
 *
 * @param {Array} roster - joueurs (doivent avoir playerId, pseudo, traits)
 * @param {object} options
 * @param {string} options.seed
 * @param {number} options.weekIndex
 * @param {number} [options.probability=0.30]
 * @returns {object | null} décision construite (avec id unique) ou null
 */
export function rollWeeklyDecision(roster = [], { seed = 'w', weekIndex = 0, probability = 0.30 } = {}) {
  if (!roster.length) return null

  const chance = seededRand(stableHash(`${seed}-decision-chance-${weekIndex}`))
  if (chance >= probability) return null

  // Pick a target player
  const playerIdx = Math.floor(seededRand(stableHash(`${seed}-decision-player-${weekIndex}`)) * roster.length)
  const player = roster[playerIdx]
  if (!player) return null

  const ctx = { player, weekIndex }
  const eligible = DECISION_POOL.filter((d) => !d.triggers || d.triggers(ctx))
  if (!eligible.length) return null

  const totalWeight = eligible.reduce((s, d) => s + d.weight, 0)
  const r = seededRand(stableHash(`${seed}-decision-pick-${weekIndex}`)) * totalWeight

  let acc = 0
  for (const tmpl of eligible) {
    acc += tmpl.weight
    if (r <= acc) {
      const built = tmpl.build(ctx)
      return {
        id: `${tmpl.id}-${player.playerId}-${weekIndex}`,
        templateId: tmpl.id,
        icon: tmpl.icon,
        playerId: player.playerId,
        weekIndex,
        headline: built.headline,
        prompt: built.prompt,
        choices: built.choices,
        timestamp: Date.now(),
      }
    }
  }
  return null
}
