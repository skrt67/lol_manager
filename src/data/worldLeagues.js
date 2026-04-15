export const LEAGUES = {
  LCK: {
    id: 'LCK',
    name: 'LCK',
    region: 'Coree du Sud',
    tier: 1,
    prestige: 5,
    salaryMultiplier: 1.4,
    badge: 'gold',
    flag: 'KR',
  },
  LPL: {
    id: 'LPL',
    name: 'LPL',
    region: 'Chine',
    tier: 1,
    prestige: 5,
    salaryMultiplier: 1.45,
    badge: 'gold',
    flag: 'CN',
  },
  LEC: {
    id: 'LEC',
    name: 'LEC',
    region: 'Europe',
    tier: 1,
    prestige: 4,
    salaryMultiplier: 1.28,
    badge: 'gold',
    flag: 'EU',
  },
  LCS: {
    id: 'LCS',
    name: 'LCS',
    region: 'Amerique du Nord',
    tier: 1,
    prestige: 4,
    salaryMultiplier: 1.22,
    badge: 'gold',
    flag: 'NA',
  },
  LFL: {
    id: 'LFL',
    name: 'LFL',
    region: 'France',
    tier: 2,
    prestige: 3,
    salaryMultiplier: 0.92,
    badge: 'silver',
    flag: 'FR',
  },
  PrimeLeague: {
    id: 'PrimeLeague',
    name: 'Prime League',
    region: 'DACH',
    tier: 2,
    prestige: 3,
    salaryMultiplier: 0.9,
    badge: 'silver',
    flag: 'DE',
  },
  TCL: {
    id: 'TCL',
    name: 'TCL',
    region: 'Turquie',
    tier: 2,
    prestige: 2,
    salaryMultiplier: 0.84,
    badge: 'silver',
    flag: 'TR',
  },
}

export const TEAMS_BY_LEAGUE = {
  LCK: [
    { name: 'T1', power: 97 },
    { name: 'Gen.G', power: 96 },
    { name: 'Hanwha Life', power: 91 },
    { name: 'Dplus KIA', power: 90 },
    { name: 'KT Rolster', power: 88 },
    { name: 'Kwangdong Freecs', power: 84 },
    { name: 'FearX', power: 82 },
    { name: 'OKSavingsBank BRION', power: 80 },
    { name: 'Nongshim RedForce', power: 79 },
    { name: 'DRX', power: 78 },
  ],
  LPL: [
    { name: 'Bilibili Gaming', power: 96 },
    { name: 'Top Esports', power: 94 },
    { name: 'JD Gaming', power: 93 },
    { name: 'LNG Esports', power: 91 },
    { name: 'Weibo Gaming', power: 90 },
    { name: 'EDward Gaming', power: 87 },
    { name: 'FunPlus Phoenix', power: 85 },
    { name: 'Oh My God', power: 82 },
    { name: 'Ninjas in Pyjamas', power: 81 },
    { name: 'Rare Atom', power: 79 },
  ],
  LEC: [
    { name: 'G2 Esports', power: 93 },
    { name: 'Fnatic', power: 90 },
    { name: 'Karmine Corp', power: 89 },
    { name: 'MAD Lions KOI', power: 87 },
    { name: 'Team BDS', power: 86 },
    { name: 'SK Gaming', power: 83 },
    { name: 'Team Heretics', power: 82 },
    { name: 'GIANTX', power: 81 },
    { name: 'Rogue', power: 80 },
    { name: 'Vitality Bee', power: 78 },
  ],
  LCS: [
    { name: 'Cloud9', power: 89 },
    { name: 'Team Liquid', power: 88 },
    { name: 'FlyQuest', power: 87 },
    { name: 'NRG', power: 84 },
    { name: '100 Thieves', power: 83 },
    { name: 'Dignitas', power: 81 },
    { name: 'Shopify Rebellion', power: 79 },
    { name: 'Immortals', power: 78 },
    { name: 'Golden Guardians', power: 77 },
    { name: 'Evil Geniuses', power: 76 },
  ],
  LFL: [
    { name: 'Karmine Corp Blue', power: 84 },
    { name: 'Vitality.Bee', power: 83 },
    { name: 'Gentle Mates', power: 82 },
    { name: 'GameWard', power: 80 },
    { name: 'Aegis', power: 79 },
    { name: 'BK ROG Esports', power: 78 },
    { name: 'Solary', power: 77 },
    { name: 'BDS Academy', power: 76 },
    { name: 'Joblife', power: 75 },
    { name: 'Izi Dream', power: 74 },
  ],
  PrimeLeague: [
    { name: 'BIG', power: 82 },
    { name: 'MOUZ', power: 81 },
    { name: 'SK Gaming Prime', power: 80 },
    { name: 'Eintracht Spandau', power: 79 },
    { name: 'Unicorns of Love Sexy Edition', power: 78 },
    { name: 'Austrian Force', power: 77 },
    { name: 'E WIE EINFACH', power: 76 },
    { name: 'Macko', power: 75 },
    { name: 'Schalke 04 Esports', power: 74 },
    { name: 'SNOGARD Dragons', power: 73 },
  ],
  TCL: [
    { name: 'FUT Esports', power: 80 },
    { name: 'Papara SuperMassive', power: 79 },
    { name: 'Eternal Fire', power: 78 },
    { name: 'Dark Passage', power: 76 },
    { name: 'Galakticos', power: 75 },
    { name: 'Misa Esports', power: 74 },
    { name: 'BoostGate', power: 73 },
    { name: 'Besiktas Esports', power: 72 },
    { name: 'NASR', power: 71 },
    { name: 'Istanbul Wildcats', power: 70 },
  ],
}

const TIER_POWER_BONUS = {
  1: 6,
  2: 2,
}

const TIER_PLAYER_STAT_BONUS = {
  1: 6,
  2: 1,
}

export function applyLeagueTierBonusToPlayers(players, league) {
  const statBonus = TIER_PLAYER_STAT_BONUS[league.tier] ?? 0

  return players.map((player) => ({
    ...player,
    laning: Math.min(99, player.laning + statBonus),
    teamfight: Math.min(99, player.teamfight + statBonus),
    macro: Math.min(99, player.macro + statBonus),
    mechanics: Math.min(99, player.mechanics + statBonus),
  }))
}

export function getLeagueStandings(leagueId) {
  const league = LEAGUES[leagueId]
  const teams = TEAMS_BY_LEAGUE[leagueId] ?? []
  const tierBonus = TIER_POWER_BONUS[league?.tier] ?? 0

  return teams
    .map((team, index) => {
      const points = Math.max(12, Math.round((team.power + tierBonus) * 0.58) - index)
      const wins = Math.max(4, Math.round(points / 2.8))
      const losses = Math.max(1, 18 - wins)
      const salaryIndex = Math.round((team.power * league.salaryMultiplier) / 10)

      return {
        rank: index + 1,
        name: team.name,
        points,
        wins,
        losses,
        power: team.power,
        salaryIndex,
      }
    })
    .sort((a, b) => b.points - a.points)
    .map((team, index) => ({ ...team, rank: index + 1 }))
}

export function getWorldPowerRanking(limit = 10) {
  return Object.entries(TEAMS_BY_LEAGUE)
    .flatMap(([leagueId, teams]) =>
      teams.map((team) => ({
        ...team,
        leagueId,
        leagueName: LEAGUES[leagueId].name,
        tier: LEAGUES[leagueId].tier,
        score: team.power + (TIER_POWER_BONUS[LEAGUES[leagueId].tier] ?? 0),
      })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((team, index) => ({ ...team, rank: index + 1 }))
}
