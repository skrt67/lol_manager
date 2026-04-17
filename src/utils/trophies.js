/**
 * trophies.js
 * ───────────
 * Catalogue des trophées et palmarès. Les trophées sont décernés
 * automatiquement à la fin d'une étape (printemps/été) en fonction
 * du classement final, ou manuellement via `awardTrophy`.
 *
 * Structure d'un trophée décerné :
 *   { id, trophyId, label, tier, stage, season, dateKey, leagueId }
 */

// ─── Trophy catalog ──────────────────────────────────────────────────────────

export const TROPHIES = {
  // League titles
  spring_champion: {
    id: 'spring_champion',
    label: 'Champion Printemps',
    icon: '🏆',
    tier: 'gold',
    description: 'Remporter la saison régulière du printemps',
  },
  summer_champion: {
    id: 'summer_champion',
    label: 'Champion Été',
    icon: '🏆',
    tier: 'gold',
    description: 'Remporter la saison régulière d\'été',
  },
  spring_runnerup: {
    id: 'spring_runnerup',
    label: 'Finaliste Printemps',
    icon: '🥈',
    tier: 'silver',
    description: 'Terminer 2e du split printemps',
  },
  summer_runnerup: {
    id: 'summer_runnerup',
    label: 'Finaliste Été',
    icon: '🥈',
    tier: 'silver',
    description: 'Terminer 2e du split été',
  },
  playoff_berth: {
    id: 'playoff_berth',
    label: 'Qualification Playoffs',
    icon: '🎖',
    tier: 'bronze',
    description: 'Se qualifier pour les playoffs',
  },

  // Achievements
  undefeated_month: {
    id: 'undefeated_month',
    label: 'Mois Invaincu',
    icon: '⭐',
    tier: 'silver',
    description: 'Aucune défaite pendant un mois complet',
  },
  perfect_draft: {
    id: 'perfect_draft',
    label: 'Draft Parfait',
    icon: '🎯',
    tier: 'bronze',
    description: 'Remporter un match avec +15 de draft score',
  },
  financial_wizard: {
    id: 'financial_wizard',
    label: 'Magicien Financier',
    icon: '💰',
    tier: 'silver',
    description: 'Atteindre 2M€ de trésorerie',
  },
  mvp_season: {
    id: 'mvp_season',
    label: 'MVP de Saison',
    icon: '👑',
    tier: 'gold',
    description: 'Avoir un joueur élu MVP de la saison',
  },
}

export const TROPHY_LIST = Object.values(TROPHIES)

// ─── Tier styling helpers ────────────────────────────────────────────────────

export const TROPHY_TIER_STYLES = {
  gold:   { color: '#fbbf24', border: '#f59e0b', glow: 'rgba(251,191,36,0.35)' },
  silver: { color: '#cbd5e1', border: '#94a3b8', glow: 'rgba(203,213,225,0.3)' },
  bronze: { color: '#d97706', border: '#b45309', glow: 'rgba(217,119,6,0.3)' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crée un trophée décerné prêt à être pushé dans la liste.
 */
export function buildAwardedTrophy({ trophyId, stage, season, leagueId, dateKey }) {
  const trophy = TROPHIES[trophyId]
  if (!trophy) return null
  return {
    id: `${trophyId}-${season ?? 0}-${stage ?? 'x'}-${Date.now()}`,
    trophyId,
    label: trophy.label,
    icon: trophy.icon,
    tier: trophy.tier,
    stage: stage ?? null,
    season: season ?? null,
    leagueId: leagueId ?? null,
    dateKey: dateKey ?? null,
  }
}

/**
 * Détermine le trophée à décerner en fonction du classement final d'une étape.
 *
 * @param {number} rank   - position finale (1 = premier)
 * @param {'Printemps' | 'Ete'} stage
 * @returns {string | null} trophyId ou null si pas de trophée
 */
export function trophyForRank(rank, stage) {
  const isSpring = stage === 'Printemps'
  if (rank === 1) return isSpring ? 'spring_champion' : 'summer_champion'
  if (rank === 2) return isSpring ? 'spring_runnerup' : 'summer_runnerup'
  if (rank >= 3 && rank <= 6) return 'playoff_berth'
  return null
}

/**
 * Build a 4-team single-elimination bracket from standings.
 * Pairs 1v4 and 2v3 in semis.
 *
 * @param {Array<{ team: string, rank: number }>} standings - sorted by rank
 * @returns {{ semis: Array<{seedA: object, seedB: object, winner?: object}>, final?: object }}
 */
export function buildBracketFromStandings(standings = []) {
  const top4 = standings.slice(0, 4).map((s, i) => ({
    seed: i + 1,
    team: s.team ?? s.name ?? `Équipe ${i + 1}`,
    score: s.wins ?? s.points ?? null,
  }))
  if (top4.length < 4) return { semis: [], final: null }

  return {
    semis: [
      { seedA: top4[0], seedB: top4[3] },
      { seedA: top4[1], seedB: top4[2] },
    ],
    final: null,
  }
}
