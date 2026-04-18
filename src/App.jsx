import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2,
  Calendar,
  DollarSign,
  Dumbbell,
  FileSearch,
  Inbox,
  LayoutDashboard,
  Search,
  Swords,
  Users,
} from 'lucide-react'
import {
  LEAGUES,
  TEAMS_BY_LEAGUE,
  applyLeagueTierBonusToPlayers,
  getLeagueStandings,
  getWorldPowerRanking,
} from './data/worldLeagues'
import { CHAMPIONS_DB, NO_LUCK_COMBOS } from './data'
import { LEC_PLAYERS, LFL_PLAYERS } from './data/proPlayers'
import TrainingView from './components/TrainingView'
import MatchMap from './components/MatchMap'
import { clearGameState, loadGameState, saveGameState } from './utils/saveGame'
import { assignTraitsToPlayer, getTrait, getTraitStatBonuses } from './utils/playerTraits'
import { rollWeeklyEventsForRoster, getWeekIndex } from './utils/gameEvents'
import { rollWeeklyDecision } from './utils/decisionEvents'

const _initialSave = loadGameState()

const navGroups = [
  {
    title: 'Preparer',
    items: [
      { id: 'mailbox', label: 'Boite mail', icon: Inbox },
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { id: 'tactiques', label: 'Tactiques', icon: Swords },
      { id: 'rapport-analyste', label: 'Rapport Analyste', icon: FileSearch },
      { id: 'entrainement', label: 'Entrainement', icon: Dumbbell },
      { id: 'calendrier', label: 'Calendrier', icon: Calendar },
    ],
  },
  {
    title: 'Gerer',
    items: [
      { id: 'effectif', label: 'Effectif', icon: Users },
      { id: 'staff-finances', label: 'Staff & Finances', icon: DollarSign },
      { id: 'data-hub', label: 'Centre de donnees', icon: BarChart2 },
    ],
  },
  {
    title: 'Recruter',
    items: [{ id: 'recrutement', label: 'Recrutement', icon: Search }],
  },
]

const navItems = navGroups.flatMap((group) => group.items)

const hiddenPages = [
  { id: 'championnat', label: 'Championnat' },
  { id: 'monde', label: 'Monde' },
  { id: 'profil-joueur', label: 'Profil Joueur' },
  { id: 'soloq-europe', label: 'SoloQ Europe' },
  { id: 'match-day', label: 'Match Day' },
  { id: 'match-live', label: 'Live Match' },
  { id: 'match-result', label: 'Fin de Match' },
]

const pageDirectory = [...navItems.map((item) => ({ id: item.id, label: item.label })), ...hiddenPages]

const PRO_PLAYERS = [...LEC_PLAYERS, ...LFL_PLAYERS]

const PRO_PLAYERS_BY_LEAGUE = PRO_PLAYERS.reduce((acc, player) => {
  if (!acc[player.league_id]) {
    acc[player.league_id] = []
  }

  acc[player.league_id].push(player)
  return acc
}, {})

const DEFAULT_TEAM_BY_LEAGUE = {
  LEC: 'g2_esports',
  LFL: 'aegis',
}

const LEC_VERSUS_GUEST_TEAMS = ['Los Ratones', 'EMEA Consistency Seed']

const WEEK_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const DEFAULT_TRAINING_PLAN = WEEK_DAYS.reduce((acc, day, index) => {
  acc[`${day}-morning`] = index % 2 === 0 ? 'scrims' : 'vod_review'
  acc[`${day}-afternoon`] = index < 4 ? 'soloq' : 'rest'
  return acc
}, {})

const INITIAL_SCOUTING_QUEUE = [
  { id: 'scout-mid-erl', player: 'Raven', role: 'Mid', league: 'PrimeLeague', daysRemaining: 4 },
  { id: 'scout-jgl-kr', player: 'Nox', role: 'Jungle', league: 'LCK', daysRemaining: 6 },
]

const SOLOQ_TUNING = {
  active: {
    randomFloor: -18,
    randomRange: 39,
    minDelta: -24,
    maxDelta: 26,
  },
  global: {
    randomFloor: -10,
    randomRange: 21,
    minDelta: -14,
    maxDelta: 16,
  },
}

const MATCH_APPROACHES = [
  {
    id: 'early-stomp',
    label: 'Early Game Stomp',
    summary: '+10% laning, -20% apres 25 min',
    laneMultiplier: 1.1,
    lateMultiplier: 0.8,
    objectiveMultiplier: 1,
    farmPenalty: 0,
  },
  {
    id: 'scaling-focus',
    label: 'Scaling Focus',
    summary: '-10% laning, +20% apres 30 min',
    laneMultiplier: 0.9,
    lateMultiplier: 1.2,
    objectiveMultiplier: 1,
    farmPenalty: 0,
  },
  {
    id: 'objective-control',
    label: 'Objective Control',
    summary: 'Priorite drakes/Nashor, farm individuel reduit',
    laneMultiplier: 1,
    lateMultiplier: 1,
    objectiveMultiplier: 1.18,
    farmPenalty: 4,
  },
]

const DEFAULT_MATCH_APPROACH_ID = 'objective-control'
const MATCH_DAY_STEP_COUNT = 4

const DRAFT_ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const MAX_DRAFT_BANS = 5
const FIRST_BAN_PHASE_COUNT = 3
const SECOND_BAN_PHASE_COUNT = 2
const SECOND_BAN_TRIGGER_PICK_INDEX = 4
const DRAFT_WINRATE_IMPACT_FACTOR = 1.6
const DRAFT_MISMATCH_WINRATE_PENALTY_FACTOR = 42
const STAFF_MAX_LEVEL = 3
const CHAMPION_IMAGE_CDN_VERSION = '16.7.1'
const ITEM_IMAGE_CDN_VERSION = CHAMPION_IMAGE_CDN_VERSION
const CHAMPION_IMAGE_ID_OVERRIDES = {
  BelVeth: 'Belveth',
  ChoGath: 'Chogath',
  JarvanIV: 'JarvanIV',
  Khazix: 'Khazix',
  KogMaw: 'KogMaw',
  LeBlanc: 'Leblanc',
  NunuWillump: 'Nunu',
  RenataGlasc: 'Renata',
  TahmKench: 'TahmKench',
  VelKoz: 'Velkoz',
  Wukong: 'MonkeyKing',
}
const ITEM_IMAGE_ID_BY_LABEL = {
  'Black Cleaver': '3071',
  Shojin: '3161',
  Sterak: '3053',
  'Death Dance': '6333',
  Maw: '3156',
  GA: '3026',
  'Sundered Sky': '6610',
  Titanic: '3748',
  JakSho: '6665',
  Ludens: '6655',
  Shadowflame: '4645',
  Zhonyas: '3157',
  Rabadon: '3089',
  'Void Staff': '3135',
  Banshee: '3102',
  'Infinity Edge': '3031',
  'Rapid Firecannon': '3094',
  LDR: '3036',
  BT: '3072',
  Mercurial: '3139',
  'Solstice Sleigh': '3876',
  Locket: '3190',
  Mikaels: '3222',
  Redemption: '3107',
  Shurelya: '2065',
  Wardstone: '4643',
}
const STAFF_CATALOG = {
  dataAnalyst: {
    label: 'Analyste Data',
    role: 'Predictions draft et breakdown post-match',
    monthlyCostByLevel: [0, 12000, 24000, 38000],
  },
  headScout: {
    label: 'Head Scout',
    role: 'Vitesse de scouting sur ligues externes',
    monthlyCostByLevel: [0, 9000, 17500, 28000],
  },
  mentalCoach: {
    label: 'Coach Mental',
    role: 'Reduction du tilt en SoloQ et en matchs a pression',
    monthlyCostByLevel: [0, 10000, 19000, 30000],
  },
}
const DEFAULT_STAFF_TEAM = {
  dataAnalyst: 0,
  headScout: 0,
  mentalCoach: 0,
}
const DRAFT_PICK_SEQUENCE = [
  { side: 'blue', roles: ['Top'] },
  { side: 'red', roles: ['Top', 'Jungle'] },
  { side: 'blue', roles: ['Jungle', 'Mid'] },
  { side: 'red', roles: ['Mid'] },
  { side: 'red', roles: ['ADC'] },
  { side: 'blue', roles: ['ADC', 'Support'] },
  { side: 'red', roles: ['Support'] },
]

const COUNTER_TAG_RULES = {
  poke: ['Sustain', 'Engage'],
  engage: ['Disengage', 'Peel', 'Control'],
  dive: ['Disengage', 'Peel', 'Control'],
  scaling: ['Lane Bully', 'Snowball', 'Early Game'],
  assassin: ['Tank', 'Control', 'Peel'],
  skirmisher: ['Tank', 'Control'],
  teamfight: ['Splitpush', 'Poke'],
}

// Role weights per game phase: higher = more impact on team power during that phase.
// Early: Jungle/Top lead (ganks, prio), ADC minimal. Late: ADC/Mid carry, Jungle still useful.
const ROLE_PHASE_WEIGHTS = {
  early: { Top: 0.22, Jungle: 0.26, Mid: 0.22, ADC: 0.16, Support: 0.14 },
  mid: { Top: 0.18, Jungle: 0.22, Mid: 0.22, ADC: 0.20, Support: 0.18 },
  late: { Top: 0.14, Jungle: 0.18, Mid: 0.22, ADC: 0.28, Support: 0.18 },
}

const SEASON_START_BUDGET = 5_200_000
const DEFAULT_PLAYER_SALARY = 22_000
const PRIZE_MONEY_BY_STAGE = {
  'LEC Versus': { win: 15000, loss: 4000 },
  Printemps: { win: 45000, loss: 12000 },
  Ete: { win: 60000, loss: 15000 },
  Regulier: { win: 22000, loss: 6000 },
  Playoffs: { win: 90000, loss: 25000 },
}

const SPONSOR_CONTRACTS = [
  {
    id: 'riot-partner',
    label: 'Riot Games Partner',
    monthly: 85_000,
    target: { type: 'winrate', value: 55, bonus: 60_000 },
  },
  {
    id: 'redbull',
    label: 'Red Bull Energy',
    monthly: 45_000,
    target: { type: 'top_finish', value: 4, bonus: 90_000 },
  },
  {
    id: 'logitech',
    label: 'Logitech G',
    monthly: 38_000,
    target: { type: 'winrate', value: 50, bonus: 30_000 },
  },
  {
    id: 'secretlab',
    label: 'Secretlab Pro',
    monthly: 22_000,
    target: { type: 'winrate', value: 45, bonus: 15_000 },
  },
]

const BOARD_OBJECTIVES = [
  { id: 'spring-top4', label: 'Top 4 au Split Printemps', stage: 'Printemps', minRank: 4, reward: 120_000 },
  { id: 'summer-top2', label: 'Top 2 au Split Ete', stage: 'Ete', minRank: 2, reward: 220_000 },
  { id: 'no-bot3', label: 'Eviter le Bottom 3', minWinrate: 42, reward: 40_000 },
]

const META_PATCH_ARCHETYPES = ['Tank', 'Assassin', 'Marksman', 'Mage', 'Enchanter', 'Juggernaut', 'Skirmisher', 'Engage']
const POTENTIAL_BAND = {
  // Potential cap relative to mental stat. Stars cap higher.
  elite: 98,
  high: 92,
  mid: 86,
  low: 80,
}

function isFragileChampion(champion) {
  if (!champion) {
    return false
  }

  const frontline = hasAnyTag(champion, ['Tank', 'Juggernaut', 'Bruiser', 'AP Bruiser'])
  if (frontline) {
    return false
  }

  const carryLike = hasAnyTag(champion, ['Marksman', 'Assassin', 'AP Carry', 'Carry', 'Enchanter', 'Mage', 'Ranged'])
  const burstGlass = (champion.stats?.burst ?? 0) >= 7 && (champion.stats?.cc ?? 0) <= 4

  return carryLike || burstGlass
}

function computeDraftPunishmentProfile({
  draftState,
  roster,
  rosterProfiles,
  baseRosterProfiles,
}) {
  const effectiveDraftState = draftState ?? createEmptyDraftState()
  const rosterByRole = (roster ?? []).reduce((acc, player) => {
    if (!acc[player.role]) {
      acc[player.role] = player
    }
    return acc
  }, {})

  const byRole = {}
  const fatalRiskByRole = {}
  const penalties = []
  let lowMasteryCount = 0
  let severeMismatchCount = 0

  DRAFT_ROLES.forEach((role) => {
    const playerPickKey = effectiveDraftState.playerPicks?.[role]
    if (!playerPickKey) {
      byRole[role] = { multiplier: 1, penalty: 0, mastery: 0, pressureGap: 0 }
      fatalRiskByRole[role] = 0.08
      return
    }

    const enemyPickKey = effectiveDraftState.enemyPicks?.[role]
    const rosterPlayer = rosterByRole[role]
    const profile = rosterPlayer ? (rosterProfiles[rosterPlayer.playerId] ?? baseRosterProfiles[rosterPlayer.playerId]) : null
    const mastery = profile?.championMastery?.[playerPickKey] ?? 35

    let masteryPenalty = 0
    if (mastery < 20) {
      masteryPenalty = 0.34
      lowMasteryCount += 1
    } else if (mastery < 35) {
      masteryPenalty = 0.24
    } else if (mastery < 50) {
      masteryPenalty = 0.14
    } else if (mastery < 65) {
      masteryPenalty = 0.06
    }

    const playerChampion = getChampionByKey(playerPickKey)
    const enemyChampion = getChampionByKey(enemyPickKey)
    const playerPressure = computeCounterPressure(playerChampion, enemyChampion)
    const enemyPressure = computeCounterPressure(enemyChampion, playerChampion)
    const pressureGap = clamp(enemyPressure - playerPressure, 0, 4)

    let matchupPenalty = pressureGap > 0 ? 0.12 + (pressureGap * 0.08) : 0
    let punishBoost = 0

    if (isFragileChampion(playerChampion) && enemyChampion) {
      const hardCcPunish = (enemyChampion.stats?.cc ?? 0) >= 7 ? 0.16 : (enemyChampion.stats?.cc ?? 0) >= 5 ? 0.1 : 0
      const burstPunish = (enemyChampion.stats?.burst ?? 0) >= 8 ? 0.14 : (enemyChampion.stats?.burst ?? 0) >= 6 ? 0.08 : 0
      punishBoost = hardCcPunish + burstPunish
      matchupPenalty += clamp(punishBoost * 0.75, 0, 0.18)
    }

    const totalPenalty = clamp(masteryPenalty + matchupPenalty, 0, 0.5)
    const multiplier = clamp(1 - totalPenalty, 0.5, 1)
    const fatalRisk = clamp(0.08 + (mastery < 20 ? 0.62 : mastery < 35 ? 0.34 : 0.12) + (pressureGap * 0.08) + punishBoost, 0.08, 0.95)

    if (totalPenalty >= 0.3) {
      severeMismatchCount += 1
    }

    penalties.push(totalPenalty)
    byRole[role] = {
      multiplier: Number(multiplier.toFixed(2)),
      penalty: Number(totalPenalty.toFixed(2)),
      mastery,
      pressureGap,
    }
    fatalRiskByRole[role] = Number(fatalRisk.toFixed(2))
  })

  const averagePenalty = penalties.length
    ? penalties.reduce((sum, penalty) => sum + penalty, 0) / penalties.length
    : 0

  return {
    byRole,
    fatalRiskByRole,
    averagePenalty: Number(averagePenalty.toFixed(3)),
    lowMasteryCount,
    severeMismatchCount,
  }
}

function computeProjectedWinRateWithDraft(baseProjectedWinRate, draftScore, draftPunishmentProfile) {
  const mismatchPenalty = Math.round((draftPunishmentProfile?.averagePenalty ?? 0) * DRAFT_MISMATCH_WINRATE_PENALTY_FACTOR)
  const weightedDraftScore = Math.round(draftScore * DRAFT_WINRATE_IMPACT_FACTOR)
  return clamp(baseProjectedWinRate + weightedDraftScore - mismatchPenalty, 3, 96)
}

function computeStaffMonthlyCost(staffTeam) {
  return Object.entries(STAFF_CATALOG).reduce((sum, [staffId, config]) => {
    const level = clamp(staffTeam?.[staffId] ?? 0, 0, STAFF_MAX_LEVEL)
    return sum + (config.monthlyCostByLevel[level] ?? 0)
  }, 0)
}

function applyAnalystPrecision(value, analystLevel, seedKey, step = 1) {
  const level = clamp(analystLevel ?? 0, 0, STAFF_MAX_LEVEL)
  if (level >= 3) {
    return Math.round(value / step) * step
  }

  const baseNoise = level === 2 ? 2 : level === 1 ? 4 : 8
  const noise = (stableHash(`${seedKey}-analyst`) % (baseNoise * 2 + 1)) - baseNoise
  const adjusted = value + noise
  const precisionStep = level === 2 ? step : level === 1 ? Math.max(step, 2) : Math.max(step, 5)
  return Math.round(adjusted / precisionStep) * precisionStep
}

function shouldApplyTilt(baseChance, mentalCoachLevel, seedKey) {
  const level = clamp(mentalCoachLevel ?? 0, 0, STAFF_MAX_LEVEL)
  const mitigation = 0.14 * level
  const effectiveChance = clamp(baseChance - mitigation, 0.06, 0.98)
  const roll = stableHash(seedKey) % 100
  return roll < Math.round(effectiveChance * 100)
}

function applyMentalCoachToPunishmentProfile(draftPunishmentProfile, mentalCoachLevel, isHighPressureMatch) {
  const level = clamp(mentalCoachLevel ?? 0, 0, STAFF_MAX_LEVEL)
  if (level <= 0 || !draftPunishmentProfile) {
    return draftPunishmentProfile
  }

  const riskReduction = clamp(0.1 * level + (isHighPressureMatch ? 0.05 * level : 0), 0, 0.45)
  const penaltyReduction = clamp(0.05 * level + (isHighPressureMatch ? 0.03 * level : 0), 0, 0.28)
  const baseByRole = draftPunishmentProfile.byRole ?? {}
  const baseFatalRisk = draftPunishmentProfile.fatalRiskByRole ?? {}
  const nextByRole = {}
  const nextFatalRiskByRole = {}

  DRAFT_ROLES.forEach((role) => {
    const roleState = baseByRole[role] ?? { multiplier: 1, penalty: 0, mastery: 0, pressureGap: 0 }
    const reducedPenalty = clamp((roleState.penalty ?? 0) * (1 - penaltyReduction), 0, 0.5)
    nextByRole[role] = {
      ...roleState,
      penalty: Number(reducedPenalty.toFixed(3)),
      multiplier: Number(clamp(1 - reducedPenalty, 0.5, 1).toFixed(3)),
    }

    const baseRisk = baseFatalRisk[role] ?? 0.08
    nextFatalRiskByRole[role] = Number(clamp(baseRisk * (1 - riskReduction), 0.05, 0.95).toFixed(3))
  })

  const penalties = Object.values(nextByRole).map((entry) => entry.penalty ?? 0)
  const averagePenalty = penalties.length ? penalties.reduce((sum, value) => sum + value, 0) / penalties.length : 0
  const severeMismatchCount = penalties.filter((value) => value >= 0.3).length

  return {
    ...draftPunishmentProfile,
    byRole: nextByRole,
    fatalRiskByRole: nextFatalRiskByRole,
    averagePenalty: Number(averagePenalty.toFixed(3)),
    severeMismatchCount,
  }
}

function buildPostMatchBreakdown({
  timeline,
  teamRows,
  baseProjectedWinRate,
  projectedWinRate,
  analystLevel,
  matchId,
}) {
  const earlyEvents = (timeline ?? []).filter((event) => event.minute <= 15)
  const eventAt15 = earlyEvents[earlyEvents.length - 1] ?? (timeline ?? [])[0]
  const rawGoldDiffAt15 = eventAt15?.goldDiff ?? 0
  const goldDiffAt15 = applyAnalystPrecision(rawGoldDiffAt15, analystLevel, `${matchId}-gold15`, 50)

  const damageRows = (teamRows ?? []).map((row) => {
    const roleBonus = row.role === 'ADC' ? 210 : row.role === 'Mid' ? 170 : row.role === 'Top' ? 90 : row.role === 'Jungle' ? 130 : 110
    const rawDamage = (row.kills * 980) + (row.assists * 430) + Math.round(row.kda * 120) + roleBonus
    return {
      role: row.role,
      playerName: row.playerName,
      rawDamage,
    }
  })

  const totalDamage = Math.max(1, damageRows.reduce((sum, row) => sum + row.rawDamage, 0))
  const damageShare = damageRows
    .map((row) => {
      const rawShare = (row.rawDamage / totalDamage) * 100
      return {
        ...row,
        sharePercent: clamp(applyAnalystPrecision(rawShare, analystLevel, `${matchId}-${row.role}-share`, 1), 1, 80),
      }
    })
    .sort((a, b) => b.sharePercent - a.sharePercent)

  const adcShare = damageShare.find((row) => row.role === 'ADC')?.sharePercent ?? 0
  const rawDraftImpact = projectedWinRate - baseProjectedWinRate
  const draftImpactPercent = clamp(applyAnalystPrecision(rawDraftImpact, analystLevel, `${matchId}-draft-impact`, 1), -40, 40)

  const draftImpactNote =
    draftImpactPercent >= 12
      ? `Cette draft vous a donne +${draftImpactPercent}% de chances de gagner.`
      : draftImpactPercent <= -10
        ? `Cette draft vous a retire ${Math.abs(draftImpactPercent)}% de chances de gagner.`
        : `Impact draft limite (${draftImpactPercent >= 0 ? '+' : ''}${draftImpactPercent}%).`

  return {
    goldDiffAt15,
    damageShare,
    adcShare,
    draftImpactPercent,
    draftImpactNote,
  }
}

function buildDraftScoreExplanation(draftScoreCard, draftPunishmentProfile, analystLevel = 0) {
  const card = draftScoreCard ?? {}
  const punishment = draftPunishmentProfile ?? {}
  const analystTier = clamp(analystLevel, 0, STAFF_MAX_LEVEL)
  const lines = []

  lines.push(
    `Score final ${card.score >= 0 ? '+' : ''}${card.score}: bans ${card.banImpact >= 0 ? '+' : ''}${card.banImpact}, ` +
      `comfort ${card.comfortImpact >= 0 ? '+' : ''}${card.comfortImpact}, counters ${card.counterImpact >= 0 ? '+' : ''}${card.counterImpact}, ` +
      `synergie ${card.synergyImpact >= 0 ? '+' : ''}${card.synergyImpact}, pression bans IA ${card.enemyBanImpact >= 0 ? '+' : ''}${card.enemyBanImpact}.`,
  )

  if ((card.comfortBanHits ?? 0) > 0) {
    lines.push(`Tu as neutralise ${card.comfortBanHits} pick(s) comfort adverse via les bans.`)
  }
  if ((card.enemyBanHits ?? 0) > 0) {
    lines.push(`L IA a cible ${card.enemyBanHits} de tes picks joues via ses bans.`)
  }

  if (analystTier === 0) {
    lines.push('Analyste Data absent: lecture post-draft limitee et marge d erreur plus elevee.')
    return lines.slice(0, 2)
  }

  if ((punishment.lowMasteryCount ?? 0) > 0) {
    lines.push(
      `Punition de maitrise active sur ${punishment.lowMasteryCount} role(s): risque d erreur fatale fortement augmente.`,
    )
  }

  if (analystTier >= 2 && (punishment.severeMismatchCount ?? 0) > 0) {
    lines.push(
      `${punishment.severeMismatchCount} matchup(s) presentent un desavantage structurel avec malus stats significatif en phase de jeu.`,
    )
  }

  if (analystTier >= 2 && (punishment.averagePenalty ?? 0) >= 0.3) {
    lines.push('La draft est globalement punie: execution mecanique necessaire pour compenser les matchups.')
  } else if (analystTier >= 2 && (punishment.averagePenalty ?? 0) <= 0.12) {
    lines.push('La draft est propre: peu de penalites structurelles appliquees sur les stats.')
  }

  return lines
}

function buildDraftRoleReport(draftState, draftScoreCard, draftPunishmentProfile, analystLevel = 0) {
  const roleBreakdown = draftScoreCard?.roleBreakdown ?? {}
  const byRole = draftPunishmentProfile?.byRole ?? {}
  const fatalRiskByRole = draftPunishmentProfile?.fatalRiskByRole ?? {}
  const analystTier = clamp(analystLevel, 0, STAFF_MAX_LEVEL)

  return DRAFT_ROLES.map((role) => {
    const playerChampion = getChampionByKey(draftState?.playerPicks?.[role])
    const enemyChampion = getChampionByKey(draftState?.enemyPicks?.[role])
    const roleDraft = roleBreakdown[role] ?? {}
    const punish = byRole[role] ?? {}

    const comfortDelta = roleDraft.comfortDelta ?? 0
    const counterDelta = roleDraft.counterDelta ?? 0
    const roleImpact = comfortDelta + counterDelta
    const statMalusPct = Math.round((1 - (punish.multiplier ?? 1)) * 100)
    const fatalRiskPct = Math.round((fatalRiskByRole[role] ?? 0.08) * 100)

    const status =
      roleImpact >= 2 && statMalusPct <= 12
        ? 'Avantage'
        : roleImpact <= -2 || statMalusPct >= 25 || fatalRiskPct >= 45
          ? 'Desavantage'
          : 'Neutre'

    const reasons = []
    if ((roleDraft.mastery ?? 50) < 20) {
      reasons.push('Champion hors pool: maitrise < 20.')
    } else if ((roleDraft.mastery ?? 50) < 35) {
      reasons.push('Maitrise fragile: execution instable sous pression.')
    }

    if ((roleDraft.enemyPressure ?? 0) > (roleDraft.playerPressure ?? 0)) {
      reasons.push('Le counter adverse domine ce matchup.')
    } else if ((roleDraft.playerPressure ?? 0) > (roleDraft.enemyPressure ?? 0)) {
      reasons.push('Ton pick applique une bonne pression de counter.')
    }

    if (statMalusPct >= 30) {
      reasons.push(`Malus stats severe applique: -${statMalusPct}% en phase de match.`)
    } else if (statMalusPct >= 15) {
      reasons.push(`Malus stats modere applique: -${statMalusPct}%.`)
    }

    if (fatalRiskPct >= 50) {
      reasons.push(`Risque d erreur fatale tres eleve (${fatalRiskPct}%).`)
    } else if (fatalRiskPct >= 30) {
      reasons.push(`Risque d erreur fatale eleve (${fatalRiskPct}%).`)
    }

    if (!reasons.length) {
      reasons.push('Ligne stable: peu de penalites structurelles detectees.')
    }

    const safeMastery = analystTier >= 1 ? (roleDraft.mastery ?? null) : null
    const safeMalus = analystTier >= 2 ? statMalusPct : Math.round(statMalusPct / 5) * 5
    const safeFatal = analystTier >= 2 ? fatalRiskPct : Math.round(fatalRiskPct / 5) * 5

    return {
      role,
      status,
      roleImpact,
      comfortDelta,
      counterDelta,
      mastery: safeMastery,
      statMalusPct: safeMalus,
      fatalRiskPct: safeFatal,
      playerChampionLabel: playerChampion ? `${playerChampion.name} (${playerChampion.role})` : '-',
      enemyChampionLabel: enemyChampion ? `${enemyChampion.name} (${enemyChampion.role})` : '-',
      reasons: analystTier >= 1 ? reasons : ['Analyste Data absent: detail role par role incomplet.'],
    }
  })
}

function toDateKey(date) {
  // Defensive coercion: legacy saves may store the date as an ISO string
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '1970-01-01'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateTimestamp(value, fallback = 0) {
  const d = value instanceof Date ? value : new Date(value)
  const time = d.getTime()
  return Number.isNaN(time) ? fallback : time
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function formatDateLong(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function getWeekDayLabel(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  const labels = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  return labels[d.getDay()]
}

function increaseMorale(value) {
  if (value === 'Fragile') {
    return 'Moyen'
  }
  if (value === 'Moyen') {
    return 'Bon'
  }
  if (value === 'Bon') {
    return 'Excellent'
  }
  return value
}

function decreaseMorale(value) {
  if (value === 'Excellent') {
    return 'Bon'
  }
  if (value === 'Bon') {
    return 'Moyen'
  }
  if (value === 'Moyen') {
    return 'Fragile'
  }
  return value
}

function getActivityForDate(plan, date, slot) {
  const dayLabel = getWeekDayLabel(date)
  return plan[`${dayLabel}-${slot}`] ?? 'rest'
}

function createScheduleMatch({
  leagueId,
  teamName,
  stage,
  stageRound,
  opponent,
  date,
  seriesType,
  stake,
  index,
}) {
  return {
    id: `${leagueId}-${normalizeKey(teamName)}-${normalizeKey(stage)}-${index + 1}`,
    round: index + 1,
    stageRound,
    stage,
    seriesType,
    stake,
    date,
    dateKey: toDateKey(date),
    opponent,
    status: 'upcoming',
    result: null,
  }
}

function buildLec2026Schedule(teamName) {
  const lecTeams = (TEAMS_BY_LEAGUE.LEC ?? []).map((team) => team.name)
  const versusTeams = [...new Set([...lecTeams, ...LEC_VERSUS_GUEST_TEAMS])]
  const versusOpponents = versusTeams.filter((name) => name !== teamName)
  const springOpponents = lecTeams.filter((name) => name !== teamName)
  const summerOpponents = lecTeams.filter((name) => name !== teamName)

  const seasonStart = new Date('2026-01-10T00:00:00')
  const schedule = []
  let cursor = 0

  versusOpponents.forEach((opponent, index) => {
    const date = addDays(seasonStart, cursor)
    schedule.push(
      createScheduleMatch({
        leagueId: 'LEC',
        teamName,
        stage: 'LEC Versus',
        stageRound: index + 1,
        opponent,
        date,
        seriesType: 'BO1',
        stake: 'Vainqueur qualifie au First Stand',
        index: schedule.length,
      }),
    )
    cursor += 3
  })

  cursor += 10

  springOpponents.forEach((opponent, index) => {
    const date = addDays(seasonStart, cursor)
    schedule.push(
      createScheduleMatch({
        leagueId: 'LEC',
        teamName,
        stage: 'Printemps',
        stageRound: index + 1,
        opponent,
        date,
        seriesType: 'BO3',
        stake: 'Top 2 qualifies MSI',
        index: schedule.length,
      }),
    )
    cursor += 7
  })

  cursor += 14

  summerOpponents.forEach((opponent, index) => {
    const date = addDays(seasonStart, cursor)
    schedule.push(
      createScheduleMatch({
        leagueId: 'LEC',
        teamName,
        stage: 'Ete',
        stageRound: index + 1,
        opponent,
        date,
        seriesType: 'BO3',
        stake: 'Top 3 qualifies Worlds',
        index: schedule.length,
      }),
    )
    cursor += 7
  })

  return schedule
}

function buildSeasonSchedule(leagueId, teamName) {
  if (leagueId === 'LEC') {
    return buildLec2026Schedule(teamName)
  }

  const teams = TEAMS_BY_LEAGUE[leagueId] ?? []
  const opponents = teams.map((team) => team.name).filter((name) => name !== teamName)
  const rounds = [...opponents, ...opponents]
  const seasonStart = new Date('2026-01-15T00:00:00')

  return rounds.slice(0, 18).map((opponent, index) => {
    const date = addDays(seasonStart, index * 7)
    return {
      id: `${leagueId}-${normalizeKey(teamName)}-${index + 1}`,
      round: index + 1,
      date,
      dateKey: toDateKey(date),
      opponent,
      status: 'upcoming',
      result: null,
    }
  })
}

function buildSeriesScoreFromSeed(isWin, seriesType, seed) {
  if (seriesType === 'BO1') {
    return isWin ? '1-0' : '0-1'
  }

  if (seriesType === 'BO5') {
    if (isWin) {
      return seed % 3 === 0 ? '3-0' : seed % 3 === 1 ? '3-1' : '3-2'
    }
    return seed % 3 === 0 ? '0-3' : seed % 3 === 1 ? '1-3' : '2-3'
  }

  if (isWin) {
    return seed % 2 === 0 ? '2-0' : '2-1'
  }

  return seed % 2 === 0 ? '0-2' : '1-2'
}

function invertSeriesScore(score) {
  const [left, right] = String(score)
    .split('-')
    .map((value) => Number(value))

  if (Number.isNaN(left) || Number.isNaN(right)) {
    return score
  }

  return `${right}-${left}`
}

function applyMirroredResultToOpponentSchedule({
  schedules,
  leagueId,
  teamName,
  opponentName,
  dateKey,
  stage,
  isTeamWin,
  score,
}) {
  const opponentTeam = (TEAMS_BY_LEAGUE[leagueId] ?? []).find((team) => team.name === opponentName)
  if (!opponentTeam) {
    return schedules
  }

  const opponentScheduleKey = `${leagueId}:${opponentTeam.id}`
  const opponentBaseSchedule = schedules[opponentScheduleKey] ?? buildSeasonSchedule(leagueId, opponentTeam.name)
  const mirroredScore = invertSeriesScore(score)
  let changed = false

  const updatedOpponentSchedule = opponentBaseSchedule.map((opponentMatch) => {
    if (opponentMatch.status !== 'upcoming') {
      return opponentMatch
    }

    const sameDate = opponentMatch.dateKey === dateKey
    const sameOpponent = opponentMatch.opponent === teamName
    const sameStage = (opponentMatch.stage ?? null) === (stage ?? null)

    if (!sameDate || !sameOpponent || !sameStage) {
      return opponentMatch
    }

    changed = true
    return {
      ...opponentMatch,
      status: 'played',
      result: `${isTeamWin ? 'D' : 'V'} ${mirroredScore}`,
    }
  })

  if (!changed) {
    return schedules
  }

  return {
    ...schedules,
    [opponentScheduleKey]: updatedOpponentSchedule,
  }
}

function resolveLeagueSchedulesForDate({
  existingSchedules,
  leagueId,
  dateKey,
  activeLeagueId,
  activeTeamId,
}) {
  const teams = TEAMS_BY_LEAGUE[leagueId] ?? []
  if (!teams.length) {
    return existingSchedules
  }

  const standingsByName = new Map((getLeagueStandings(leagueId) ?? []).map((team) => [team.name, team.power]))
  const processedFixtures = new Set()
  let nextSchedules = { ...existingSchedules }

  teams.forEach((team) => {
    const teamScheduleKey = `${leagueId}:${team.id}`
    const baseSchedule = nextSchedules[teamScheduleKey] ?? buildSeasonSchedule(leagueId, team.name)
    let teamScheduleChanged = false

    const updatedTeamSchedule = baseSchedule.map((match) => {
      if (match.status !== 'upcoming' || match.dateKey !== dateKey) {
        return match
      }

      if (leagueId === activeLeagueId && team.id === activeTeamId) {
        return match
      }

      const fixtureKey = `${leagueId}:${dateKey}:${match.stage ?? 'regular'}:${match.seriesType ?? 'BO3'}:${[team.name, match.opponent]
        .sort()
        .join('|')}`

      if (processedFixtures.has(fixtureKey)) {
        return match
      }

      processedFixtures.add(fixtureKey)

      const teamPower = standingsByName.get(team.name) ?? 72
      const opponentPower = standingsByName.get(match.opponent) ?? 72
      const winChance = clamp(0.5 + (teamPower - opponentPower) / 130, 0.2, 0.8)
      const seed = stableHash(`${fixtureKey}-${team.name}`)
      const isWin = (seed % 100) < Math.round(winChance * 100)
      const score = buildSeriesScoreFromSeed(isWin, match.seriesType, seed)

      teamScheduleChanged = true
      nextSchedules = applyMirroredResultToOpponentSchedule({
        schedules: nextSchedules,
        leagueId,
        teamName: team.name,
        opponentName: match.opponent,
        dateKey,
        stage: match.stage,
        isTeamWin: isWin,
        score,
      })

      return {
        ...match,
        status: 'played',
        result: `${isWin ? 'V' : 'D'} ${score}`,
      }
    })

    if (teamScheduleChanged) {
      nextSchedules = {
        ...nextSchedules,
        [teamScheduleKey]: updatedTeamSchedule,
      }
    }
  })

  return nextSchedules
}

function getStageProgressFromSchedule(schedule, stageName) {
  const stageMatches = (schedule ?? []).filter((match) => match.stage === stageName)
  if (!stageMatches.length) {
    return { total: 0, played: 0, upcoming: 0 }
  }

  const played = stageMatches.filter((match) => match.status === 'played').length
  const upcoming = stageMatches.length - played
  return {
    total: stageMatches.length,
    played,
    upcoming,
  }
}

function getLecStageContext(schedule, currentDate) {
  const safeSchedule = schedule ?? []
  const stages = ['LEC Versus', 'Printemps', 'Ete']
  const progressByStage = stages.reduce((acc, stage) => {
    acc[stage] = getStageProgressFromSchedule(safeSchedule, stage)
    return acc
  }, {})

  const todayKey = toDateKey(currentDate)
  const todayMatch = safeSchedule.find((match) => match.status === 'upcoming' && match.dateKey === todayKey)
  const nextUpcoming = [...safeSchedule]
    .filter((match) => match.status === 'upcoming')
    .sort((a, b) => getDateTimestamp(a.date, Number.MAX_SAFE_INTEGER) - getDateTimestamp(b.date, Number.MAX_SAFE_INTEGER))[0]
  const lastPlayed = [...safeSchedule]
    .filter((match) => match.status === 'played')
    .sort((a, b) => getDateTimestamp(b.date, -1) - getDateTimestamp(a.date, -1))[0]

  const activeStage = todayMatch?.stage ?? nextUpcoming?.stage ?? lastPlayed?.stage ?? 'LEC Versus'

  return {
    activeStage,
    progressByStage,
  }
}

function buildLecVersusBracketProjection(standings) {
  const top8 = (standings ?? []).slice(0, 8)
  if (top8.length < 8) {
    return {
      upperRound1: [],
      upperRound2: [],
      lowerRound1: [],
      lowerRound2: [],
      lowerRound3: null,
      lowerFinal: null,
      upperFinal: null,
      grandFinal: null,
      champion: null,
    }
  }

  const findSeed = (seed) => top8.find((team) => team.rank === seed) ?? top8[seed - 1]
  const seedMatches = [
    [findSeed(1), findSeed(8)],
    [findSeed(4), findSeed(5)],
    [findSeed(2), findSeed(7)],
    [findSeed(3), findSeed(6)],
  ]

  const predictWinner = (teamA, teamB) => {
    if (!teamA) {
      return teamB
    }
    if (!teamB) {
      return teamA
    }
    return teamA.power >= teamB.power ? teamA : teamB
  }

  const simulateSeries = (teamA, teamB, format, seedKey) => {
    if (!teamA || !teamB) {
      return {
        teamA,
        teamB,
        format,
        score: 'N/A',
        winner: teamA ?? teamB,
        loser: teamA && teamB ? null : teamA ? null : teamB,
      }
    }

    const winsNeeded = format === 'BO5' ? 3 : format === 'BO1' ? 1 : 2
    const maxGames = winsNeeded * 2 - 1
    const powerDelta = teamA.power - teamB.power
    const winChanceA = clamp(0.5 + (powerDelta / 130), 0.25, 0.75)

    let winsA = 0
    let winsB = 0

    for (let game = 1; game <= maxGames; game += 1) {
      if (winsA >= winsNeeded || winsB >= winsNeeded) {
        break
      }

      const roll = stableHash(`${seedKey}-g${game}`) % 100
      if (roll < Math.round(winChanceA * 100)) {
        winsA += 1
      } else {
        winsB += 1
      }
    }

    if (winsA === winsB) {
      const tieBreaker = stableHash(`${seedKey}-tiebreak`) % 2
      if (tieBreaker === 0) {
        winsA += 1
      } else {
        winsB += 1
      }
    }

    const winner = winsA > winsB ? teamA : teamB
    const loser = winner === teamA ? teamB : teamA

    return {
      teamA,
      teamB,
      format,
      score: `${winsA}-${winsB}`,
      winner,
      loser,
    }
  }

  const upperRound1 = seedMatches.map(([teamA, teamB], index) => ({
    id: `ubr1-${index + 1}`,
    ...simulateSeries(teamA, teamB, 'BO3', `lec-versus-ubr1-${index + 1}`),
  }))

  const upperRound2 = [
    {
      id: 'ubr2-1',
      teamA: upperRound1[0].winner,
      teamB: upperRound1[1].winner,
    },
    {
      id: 'ubr2-2',
      teamA: upperRound1[2].winner,
      teamB: upperRound1[3].winner,
    },
  ].map((match, index) => ({
    ...match,
    ...simulateSeries(match.teamA, match.teamB, 'BO3', `lec-versus-ubr2-${index + 1}`),
  }))

  const lowerRound1 = [
    {
      id: 'lbr1-1',
      teamA: upperRound1[0].loser,
      teamB: upperRound1[1].loser,
    },
    {
      id: 'lbr1-2',
      teamA: upperRound1[2].loser,
      teamB: upperRound1[3].loser,
    },
  ].map((match, index) => ({
    ...match,
    ...simulateSeries(match.teamA, match.teamB, 'BO3', `lec-versus-lbr1-${index + 1}`),
  }))

  const lowerRound2 = [
    {
      id: 'lbr2-1',
      teamA: lowerRound1[0].winner,
      teamB: upperRound2[0].loser,
    },
    {
      id: 'lbr2-2',
      teamA: lowerRound1[1].winner,
      teamB: upperRound2[1].loser,
    },
  ].map((match, index) => ({
    ...match,
    ...simulateSeries(match.teamA, match.teamB, 'BO3', `lec-versus-lbr2-${index + 1}`),
  }))

  const lowerRound3 = {
    id: 'lbr3',
    ...simulateSeries(lowerRound2[0].winner, lowerRound2[1].winner, 'BO3', 'lec-versus-lbr3'),
  }

  const upperFinal = {
    id: 'ub-final',
    ...simulateSeries(upperRound2[0].winner, upperRound2[1].winner, 'BO5', 'lec-versus-ub-final'),
  }

  const lowerFinal = {
    id: 'lb-final',
    ...simulateSeries(lowerRound3.winner, upperFinal.loser, 'BO5', 'lec-versus-lb-final'),
  }

  const grandFinal = {
    id: 'grand-final',
    ...simulateSeries(upperFinal.winner, lowerFinal.winner, 'BO5', 'lec-versus-grand-final'),
  }

  return {
    upperRound1,
    upperRound2,
    lowerRound1,
    lowerRound2,
    lowerRound3,
    lowerFinal,
    upperFinal,
    grandFinal,
    champion: grandFinal.winner ?? predictWinner(upperFinal.winner, lowerFinal.winner),
  }
}

function computeSeasonProgress(schedule, currentDate) {
  if (!schedule.length) {
    return 0
  }

  const scheduleTimestamps = schedule
    .map((match) => getDateTimestamp(match?.date, Number.NaN))
    .filter((time) => !Number.isNaN(time))

  if (!scheduleTimestamps.length) {
    return 0
  }

  const start = Math.min(...scheduleTimestamps)
  const end = Math.max(...scheduleTimestamps)
  const now = getDateTimestamp(currentDate, start)
  if (end <= start) {
    return 0
  }

  return clamp(Math.round(((now - start) / (end - start)) * 100), 0, 100)
}

const joueurs = [
  {
    joueur: 'Aster',
    role: 'Top',
    laning: 82,
    teamfight: 86,
    macro: 79,
    mechanics: 84,
    moral: 'Bon',
    forme: '7.7',
    contrat: '2027',
  },
  {
    joueur: 'Naru',
    role: 'Jungle',
    laning: 88,
    teamfight: 90,
    macro: 91,
    mechanics: 89,
    moral: 'Excellent',
    forme: '8.3',
    contrat: '2028',
  },
  {
    joueur: 'Miro',
    role: 'Mid',
    laning: 92,
    teamfight: 89,
    macro: 86,
    mechanics: 93,
    moral: 'Bon',
    forme: '8.5',
    contrat: '2028',
  },
  {
    joueur: 'Hex',
    role: 'ADC',
    laning: 87,
    teamfight: 85,
    macro: 80,
    mechanics: 91,
    moral: 'Moyen',
    forme: '7.6',
    contrat: '2027',
  },
  {
    joueur: 'Rook',
    role: 'Support',
    laning: 80,
    teamfight: 92,
    macro: 88,
    mechanics: 78,
    moral: 'Bon',
    forme: '8.0',
    contrat: '2026',
  },
]

const focusJunglerTargets = joueurs.filter((joueur) => joueur.role !== 'Jungle')

const rapportAdversaire = {
  equipe: 'Nova Prime',
  patch: '14.7',
  faiblesses: {
    earlyGame: 78,
    mentalMid: 38,
    visionRiver: 44,
    conversionLead: 41,
  },
}

const PLAYER_PROFILE_SEED = {
  Aster: {
    pseudo: 'ASTER',
    age: 23,
    nationality: 'France',
    marketValue: '€420K',
    condition: 78,
    matchHistory: ['V', 'D', 'V', 'V'],
  },
  Naru: {
    pseudo: 'NARU',
    age: 21,
    nationality: 'Coree du Sud',
    marketValue: '€680K',
    condition: 84,
    matchHistory: ['V', 'V', 'D', 'V'],
  },
  Miro: {
    pseudo: 'MIRO',
    age: 22,
    nationality: 'Pologne',
    marketValue: '€750K',
    condition: 73,
    matchHistory: ['V', 'V', 'V', 'D'],
  },
  Hex: {
    pseudo: 'HEX',
    age: 20,
    nationality: 'Suede',
    marketValue: '€620K',
    condition: 69,
    matchHistory: ['D', 'V', 'V', 'V'],
  },
  Rook: {
    pseudo: 'ROOK',
    age: 24,
    nationality: 'Danemark',
    marketValue: '€560K',
    condition: 66,
    matchHistory: ['V', 'D', 'D', 'V'],
  },
}

function normalizeKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function formatEuroValue(value) {
  return `€${Math.round(value / 1000)}K`
}

function mapProPlayerToRosterRow(player) {
  return {
    playerId: player.id,
    joueur: player.pseudo,
    realName: player.real_name,
    role: player.role,
    teamId: player.team_id,
    leagueId: player.league_id,
    nationality: player.nationality ?? null,
    marketValue: player.value,
    signatureChampions: player.signature_champions,
    laning: player.stats.laning * 5,
    teamfight: player.stats.teamfight * 5,
    macro: player.stats.macro * 5,
    mechanics: player.stats.mechanics * 5,
    mental: player.stats.mental,
    moral: player.stats.mental >= 17 ? 'Excellent' : player.stats.mental >= 15 ? 'Bon' : 'Moyen',
    forme: (player.stats.mental / 2).toFixed(1),
    contrat: '2028',
  }
}

function mapFallbackPlayerToRosterRow(player) {
  return {
    playerId: `local-${normalizeKey(player.joueur)}`,
    joueur: player.joueur,
    realName: player.joueur,
    role: player.role,
    teamId: 'local-team',
    leagueId: 'LOCAL',
    nationality: null,
    marketValue: null,
    signatureChampions: [],
    mental: clamp(Math.round((player.macro + player.teamfight) / 10), 1, 20),
    ...player,
  }
}

function findTeamIdForLeague(leagueId, teamName) {
  const normalizedName = normalizeKey(teamName)
  const leaguePlayers = PRO_PLAYERS_BY_LEAGUE[leagueId] ?? []
  const teamIds = [...new Set(leaguePlayers.map((player) => player.team_id))]

  return (
    teamIds.find((teamId) => normalizedName.includes(normalizeKey(teamId)) || normalizeKey(teamId).includes(normalizedName)) ??
    null
  )
}

function getTeamNameByLeagueAndId(leagueId, teamId) {
  const teams = TEAMS_BY_LEAGUE[leagueId] ?? []
  return teams.find((team) => findTeamIdForLeague(leagueId, team.name) === teamId)?.name ?? teamId
}

function buildInitialMasteryMap(playerId, role, signatureChampions = []) {
  const signatureSet = new Set(signatureChampions.map((championName) => normalizeKey(championName)))

  return CHAMPIONS_DB.reduce((acc, champion) => {
    const key = `${champion.id}-${champion.role}`
    const seed = stableHash(`${playerId}-${key}`)
    const sameRole = champion.role === role
    const isSignature = signatureSet.has(normalizeKey(champion.id)) || signatureSet.has(normalizeKey(champion.name))

    if (isSignature) {
      acc[key] = 100
      return acc
    }

    acc[key] = sameRole ? 48 + (seed % 37) : 14 + (seed % 43)
    return acc
  }, {})
}

function buildInitialRosterProfiles(players) {
  return players.reduce((acc, player) => {
    const seed = PLAYER_PROFILE_SEED[player.joueur] ?? {}
    const profileKey = player.playerId ?? player.joueur
    const fallbackAge = 19 + (stableHash(profileKey) % 8)
    const actualAge = seed.age ?? fallbackAge
    const fallbackCondition = clamp(58 + (stableHash(`${profileKey}-condition`) % 28), 45, 90)

    // Hidden potential stat (roll based on age: younger players have more headroom)
    const potentialSeed = stableHash(`${profileKey}-potential`)
    const baseRoll = potentialSeed % 100
    // Under-21 prospects: 20% chance elite, 40% high
    // 21-24 pros: 5% chance elite, 35% high
    // 25+: mostly capped high or mid
    let potential
    if (actualAge <= 20) {
      potential = baseRoll < 20 ? POTENTIAL_BAND.elite : baseRoll < 60 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
    } else if (actualAge <= 24) {
      potential = baseRoll < 5 ? POTENTIAL_BAND.elite : baseRoll < 40 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
    } else {
      potential = baseRoll < 35 ? POTENTIAL_BAND.high : baseRoll < 70 ? POTENTIAL_BAND.mid : POTENTIAL_BAND.low
    }

    acc[profileKey] = {
      pseudo: seed.pseudo ?? player.joueur.toUpperCase(),
      realName: player.realName ?? player.joueur,
      age: actualAge,
      nationality: player.nationality ?? seed.nationality ?? 'France',
      marketValue: player.marketValue ? formatEuroValue(player.marketValue) : seed.marketValue ?? '€350K',
      moral: player.moral,
      condition: seed.condition ?? fallbackCondition,
      ladderLP: clamp(640 + (stableHash(`${profileKey}-lp`) % 520), 0, 1800),
      confident: false,
      teamfightBonus: 0,
      mechanicsBonus: 0,
      macroBonus: 0,
      visionBonus: 0,
      draftBonus: 0,
      synergyBonus: 0,
      potential,
      currentAbility: clamp((player.laning + player.teamfight + player.macro + player.mechanics) / 4, 40, 99),
      matchHistory: seed.matchHistory ?? ['V', 'D', 'V', 'V'],
      championMastery: buildInitialMasteryMap(profileKey, player.role, player.signatureChampions ?? []),
      traits: assignTraitsToPlayer(profileKey, { age: actualAge, role: player.role }),
    }

    return acc
  }, {})
}

function buildTransferMarketFromPool(activeTeamId, size = 8) {
  const pool = PRO_PLAYERS.filter((player) => player.team_id !== activeTeamId)
  if (!pool.length) return []

  const shuffled = pool
    .map((player) => ({ player, sortKey: stableHash(`market-${player.id}`) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.player)
    .slice(0, size)

  return shuffled.map((player) => {
    const age = player.age ?? 21
    // PRO_PLAYERS stats are FM-scale (1-20), averaging ~14 for a pro
    const mainStat = (player.stats.laning + player.stats.teamfight + player.stats.mechanics + player.stats.macro) / 4
    const askingPrice = Math.round(
      (player.value ?? 500_000) * 1.15 + Math.max(0, (mainStat - 14)) * 80_000,
    )

    const potentialSeed = stableHash(`market-pot-${player.id}`) % 100
    let potential
    if (age <= 20) {
      potential = potentialSeed < 25 ? POTENTIAL_BAND.elite : potentialSeed < 65 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
    } else if (age <= 24) {
      potential = potentialSeed < 8 ? POTENTIAL_BAND.elite : potentialSeed < 45 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
    } else {
      potential = potentialSeed < 30 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
    }

    return {
      id: player.id,
      pseudo: player.pseudo,
      realName: player.real_name,
      role: player.role,
      league: player.league ?? player.league_id,
      source: player.team_id,
      age,
      stats: player.stats,
      statsPreview: {
        laning: player.stats.laning,
        teamfight: player.stats.teamfight,
        mechanics: player.stats.mechanics,
      },
      signatureChampions: player.signature_champions ?? [],
      askingPrice: Math.max(200_000, askingPrice),
      potential,
      revealedPotential: null,
      signed: false,
    }
  })
}

function moraleFromCondition(condition) {
  if (condition >= 82) {
    return 'Excellent'
  }
  if (condition >= 65) {
    return 'Bon'
  }
  if (condition >= 45) {
    return 'Moyen'
  }
  return 'Fragile'
}

function getSoloQLadderLabel(lp) {
  if (lp >= 1200) {
    return `Challenger ${lp} LP (Top 10)`
  }
  if (lp >= 950) {
    return `Challenger ${lp} LP`
  }
  if (lp >= 700) {
    return `Grandmaster ${lp} LP`
  }
  if (lp >= 500) {
    return `Master ${lp} LP`
  }
  return `Diamond ${lp} LP`
}

function getMatchApproachById(approachId) {
  return MATCH_APPROACHES.find((approach) => approach.id === approachId) ?? MATCH_APPROACHES[0]
}

function computeOpponentPower(opponentName, standings) {
  const standingEntry = standings.find((team) => team.name === opponentName)

  if (!standingEntry) {
    return 72
  }

  const formDelta = (standingEntry.wins - standingEntry.losses) * 1.8
  return clamp(Math.round(56 + standingEntry.power * 0.38 + formDelta), 45, 92)
}

function computePreMatchPrediction({
  roster,
  synergy,
  draftBonus,
  aggressivite,
  rythmeJeu,
  prioriteObjectifs,
  opponentPower,
  approachId,
}) {
  if (!roster?.length) {
    return {
      baseWinRate: 50,
      projectedWinRate: 50,
      opponentPower,
      analystNote: 'Donnees insuffisantes pour un calcul fiable.',
    }
  }

  const approach = getMatchApproachById(approachId)
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length

  const teamEarly = average(roster.map((player) => player.laning * 0.55 + player.mechanics * 0.45))
  const teamLate = average(roster.map((player) => player.teamfight * 0.45 + player.macro * 0.55 + (player.mental ?? 14) * 5))
  const teamObjective = average(roster.map((player) => player.macro * 0.55 + player.teamfight * 0.25 + prioriteObjectifs * 0.2))

  const baselineTeamScore =
    teamEarly * 0.36 +
    teamLate * 0.44 +
    teamObjective * 0.2 +
    synergy * 0.22 +
    draftBonus * 0.9 +
    aggressivite * 0.08 +
    rythmeJeu * 0.06

  const adjustedTeamScore =
    (teamEarly * approach.laneMultiplier) * 0.36 +
    (teamLate * approach.lateMultiplier) * 0.44 +
    (teamObjective * approach.objectiveMultiplier) * 0.2 +
    synergy * 0.22 +
    draftBonus * 0.9 +
    aggressivite * 0.08 +
    rythmeJeu * 0.06 -
    approach.farmPenalty

  const baseWinRate = clamp(Math.round(50 + (baselineTeamScore - opponentPower) * 0.55), 15, 85)
  const projectedWinRate = clamp(Math.round(50 + (adjustedTeamScore - opponentPower) * 0.55), 12, 88)

  const analystNote =
    projectedWinRate >= baseWinRate + 4
      ? 'Le plan choisi augmente clairement la fenetre de victoire theorique.'
      : projectedWinRate <= baseWinRate - 4
        ? 'Le plan choisi expose des faiblesses structurelles avant la draft.'
        : 'Impact limite: la difference viendra surtout de la draft et de l execution.'

  return {
    baseWinRate,
    projectedWinRate,
    opponentPower,
    analystNote,
  }
}

function toChampionKey(champion) {
  if (!champion) {
    return null
  }

  return `${champion.id}-${champion.role}`
}

function getChampionImageUrl(champion) {
  if (!champion?.id) {
    return null
  }

  const ddragonId = CHAMPION_IMAGE_ID_OVERRIDES[champion.id] ?? champion.id
  return `https://ddragon.leagueoflegends.com/cdn/${CHAMPION_IMAGE_CDN_VERSION}/img/champion/${ddragonId}.png`
}

function _getItemImageUrl(itemLabel) {
  const itemId = ITEM_IMAGE_ID_BY_LABEL[itemLabel]
  if (!itemId) {
    return null
  }

  return `https://ddragon.leagueoflegends.com/cdn/${ITEM_IMAGE_CDN_VERSION}/img/item/${itemId}.png`
}

function getChampionByKey(championKey) {
  if (!championKey) {
    return null
  }

  const separatorIndex = championKey.lastIndexOf('-')
  if (separatorIndex === -1) {
    return null
  }

  const id = championKey.slice(0, separatorIndex)
  const role = championKey.slice(separatorIndex + 1)

  return CHAMPIONS_DB.find((champion) => champion.id === id && champion.role === role) ?? null
}

function hasAnyTag(champion, tags) {
  if (!champion || !Array.isArray(tags) || tags.length === 0) {
    return false
  }

  const championTagSet = new Set((champion.tags ?? []).map((tag) => normalizeKey(tag)))
  return tags.some((tag) => championTagSet.has(normalizeKey(tag)))
}

function getCounterTargetsForChampion(champion) {
  if (!champion?.tags?.length) {
    return []
  }

  const targets = new Set()

  champion.tags.forEach((tag) => {
    const counterTags = COUNTER_TAG_RULES[normalizeKey(tag)] ?? []
    counterTags.forEach((counterTag) => targets.add(counterTag))
  })

  return [...targets]
}

function findChampionForRoleByName(championName, role) {
  if (!championName || !role) {
    return null
  }

  const normalizedChampion = normalizeKey(championName)

  return (
    CHAMPIONS_DB.find(
      (champion) =>
        champion.role === role &&
        (normalizeKey(champion.id) === normalizedChampion || normalizeKey(champion.name) === normalizedChampion),
    ) ??
    CHAMPIONS_DB.find(
      (champion) =>
        normalizeKey(champion.id) === normalizedChampion || normalizeKey(champion.name) === normalizedChampion,
    ) ??
    null
  )
}

function createEmptyDraftState() {
  return {
    bans: [],
    playerPicks: {},
    enemyPicks: {},
    pickTurnIndex: 0,
  }
}

function buildPlayerComfortPool(roster, rosterProfiles, baseRosterProfiles) {
  if (!roster?.length) {
    return []
  }

  const comfortEntries = []

  roster.forEach((player) => {
    const profile = rosterProfiles[player.playerId] ?? baseRosterProfiles[player.playerId]
    const masteryEntries = Object.entries(profile?.championMastery ?? {})
      .filter(([, mastery]) => mastery >= 70)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    masteryEntries.forEach(([championKey, mastery]) => {
      const champion = getChampionByKey(championKey)
      if (!champion) {
        return
      }

      comfortEntries.push({
        key: championKey,
        championId: champion.id,
        championName: champion.name,
        role: champion.role,
        playerPseudo: player.joueur,
        mastery,
      })
    })
  })

  return comfortEntries
    .sort((a, b) => b.mastery - a.mastery)
    .filter((entry, index, array) => array.findIndex((value) => value.key === entry.key) === index)
}

function buildEnemyBansFromComfortPool(matchId, playerComfortPool, playerBans = [], draftState = createEmptyDraftState()) {
  const bannedByPlayer = new Set(playerBans)
  const targetCount = Math.min(playerBans.length, MAX_DRAFT_BANS)

  if (targetCount <= 0) {
    return []
  }

  const playerPickedChampions = Object.values(draftState?.playerPicks ?? {})
    .map((championKey) => getChampionByKey(championKey))
    .filter(Boolean)

  const pickedChampionIdSet = new Set(playerPickedChampions.map((champion) => champion.id))

  const tokenThreatMap = new Map()
  const addTokenThreat = (token, value) => {
    if (!token || value <= 0) {
      return
    }

    const key = normalizeKey(token)
    tokenThreatMap.set(key, (tokenThreatMap.get(key) ?? 0) + value)
  }

  playerComfortPool.forEach((entry) => {
    const champion = getChampionByKey(entry.key)
    if (!champion) {
      return
    }

    const masteryWeight = Math.max(2, Math.round(entry.mastery / 8))
    ;[...(champion.tags ?? []), ...(champion.synergies ?? [])].forEach((token) => {
      addTokenThreat(token, masteryWeight)
    })
  })

  playerPickedChampions.forEach((champion) => {
    ;[...(champion.tags ?? []), ...(champion.synergies ?? [])].forEach((token) => {
      addTokenThreat(token, 14)
    })
  })

  const computeStrategicBanScore = (entry) => {
    const champion = getChampionByKey(entry.key)
    if (!champion) {
      return 0
    }

    const tokenList = [...(champion.tags ?? []), ...(champion.synergies ?? [])]
    const synergyDenyScore = tokenList.reduce((sum, token) => sum + (tokenThreatMap.get(normalizeKey(token)) ?? 0), 0)

    const pickOverlap = playerPickedChampions.reduce((sum, pickedChampion) => {
      const sharedTags = (champion.tags ?? []).filter((tag) => hasAnyTag(pickedChampion, [tag])).length
      const sharedSynergy = (champion.synergies ?? []).filter((token) => (pickedChampion.synergies ?? []).includes(token)).length
      return sum + (sharedTags * 6) + (sharedSynergy * 8)
    }, 0)

    const masteryPressure = entry.mastery * 1.45
    const stylePressure =
      ((champion.stats?.cc ?? 0) * 1.4) +
      ((champion.stats?.burst ?? 0) * 1.25) +
      ((champion.stats?.scaling ?? 0) * 0.9)
    const seed = stableHash(`${matchId}-${entry.key}-enemy-ban`) % 9

    return masteryPressure + (synergyDenyScore * 0.72) + pickOverlap + stylePressure + seed
  }

  const primary = playerComfortPool
    .filter((entry) => !bannedByPlayer.has(entry.key) && !pickedChampionIdSet.has(entry.championId))
    .map((entry) => ({
      ...entry,
      strategicScore: computeStrategicBanScore(entry),
    }))
    .sort((a, b) => {
      if (b.strategicScore !== a.strategicScore) {
        return b.strategicScore - a.strategicScore
      }
      return b.mastery - a.mastery
    })

  if (primary.length >= targetCount) {
    return primary.slice(0, targetCount)
  }

  const usedKeys = new Set(primary.map((entry) => entry.key))
  const fillers = CHAMPIONS_DB
    .map((champion) => {
      const key = toChampionKey(champion)
      const tokenList = [...(champion.tags ?? []), ...(champion.synergies ?? [])]
      const denyScore = tokenList.reduce((sum, token) => sum + (tokenThreatMap.get(normalizeKey(token)) ?? 0), 0)
      const hardControlScore = ((champion.stats?.cc ?? 0) * 1.5) + ((champion.stats?.burst ?? 0) * 1.2)
      const seed = stableHash(`${matchId}-${champion.id}-enemy-ban-filler`) % 11

      return {
        key,
        championId: champion.id,
        championName: champion.name,
        role: champion.role,
        playerPseudo: 'Scouting IA',
        mastery: 65,
        strategicScore: denyScore + hardControlScore + seed,
      }
    })
    .filter((entry) => entry.key && !bannedByPlayer.has(entry.key) && !usedKeys.has(entry.key) && !pickedChampionIdSet.has(entry.championId))
    .sort((a, b) => b.strategicScore - a.strategicScore)

  return [...primary, ...fillers].slice(0, targetCount)
}

function buildOpponentComfortPool(opponentRoster) {
  if (!opponentRoster?.length) {
    return []
  }

  const seenKeys = new Set()
  const comfortPool = []

  opponentRoster.forEach((opponent) => {
    const signatures = (opponent.signature_champions ?? []).slice(0, 3)

    signatures.forEach((championName) => {
      const champion = findChampionForRoleByName(championName, opponent.role)
      if (!champion) {
        return
      }

      const championKey = toChampionKey(champion)
      if (!championKey || seenKeys.has(championKey)) {
        return
      }

      seenKeys.add(championKey)
      comfortPool.push({
        key: championKey,
        championId: champion.id,
        championName: champion.name,
        role: champion.role,
        playerPseudo: opponent.pseudo,
        mastery: 20,
      })
    })
  })

  return comfortPool
}

function pickEnemyCounterChampion({
  matchId,
  role,
  playerChampion,
  bannedIdSet,
  usedIdSet,
  opponentComfortIdSet,
}) {
  const candidateChampions = CHAMPIONS_DB.filter(
    (champion) => champion.role === role && !bannedIdSet.has(champion.id) && !usedIdSet.has(champion.id),
  )

  if (!candidateChampions.length) {
    return null
  }

  const desiredCounterTags = playerChampion ? getCounterTargetsForChampion(playerChampion) : []
  const fragileTarget = isFragileChampion(playerChampion)

  return [...candidateChampions]
    .sort((a, b) => {
      const scoreChampion = (champion) => {
        const seed = stableHash(`${matchId}-${role}-${playerChampion?.id ?? 'none'}-${champion.id}`) % 11
        const hasCounterTag = hasAnyTag(champion, desiredCounterTags)
        const comfortBoost = opponentComfortIdSet.has(champion.id) ? 10 : 0
        const statScore = Math.round((champion.stats.cc * 0.45) + (champion.stats.scaling * 0.35) + (champion.stats.waveclear * 0.2))
        const hardCcScore = (champion.stats?.cc ?? 0) >= 7 ? 18 : (champion.stats?.cc ?? 0) >= 5 ? 8 : 0
        const burstScore = (champion.stats?.burst ?? 0) >= 8 ? 16 : (champion.stats?.burst ?? 0) >= 6 ? 7 : 0
        const punishTagScore = hasAnyTag(champion, ['Assassin', 'Engage', 'Control', 'Diver', 'Pick']) ? 10 : 0
        const fragilePunishScore = fragileTarget ? (hardCcScore + burstScore + punishTagScore) : 0

        return (hasCounterTag ? 36 : 0) + comfortBoost + statScore + fragilePunishScore + seed
      }

      return scoreChampion(b) - scoreChampion(a)
    })[0]
}

function buildEnemyDraftPicks({
  matchId,
  playerPicks,
  bans,
  opponentComfortPool,
  existingEnemyPicks = {},
  rolesToFill = DRAFT_ROLES,
}) {
  const bannedIdSet = new Set(
    bans
      .map((championKey) => getChampionByKey(championKey)?.id)
      .filter(Boolean),
  )
  const usedIdSet = new Set([...bannedIdSet])
  const opponentComfortIdSet = new Set(opponentComfortPool.map((entry) => entry.championId))
  const nextEnemyPicks = { ...existingEnemyPicks }

  Object.values(playerPicks).forEach((championKey) => {
    const champion = getChampionByKey(championKey)
    if (champion) {
      usedIdSet.add(champion.id)
    }
  })

  Object.values(nextEnemyPicks).forEach((championKey) => {
    const champion = getChampionByKey(championKey)
    if (champion) {
      usedIdSet.add(champion.id)
    }
  })

  rolesToFill.forEach((role) => {
    if (nextEnemyPicks[role]) {
      return
    }

    const playerChampionKey = playerPicks[role]
    const playerChampion = getChampionByKey(playerChampionKey)
    const enemyChampion = pickEnemyCounterChampion({
      matchId,
      role,
      playerChampion,
      bannedIdSet,
      usedIdSet,
      opponentComfortIdSet,
    })

    if (!enemyChampion) {
      return
    }

    usedIdSet.add(enemyChampion.id)
    nextEnemyPicks[role] = toChampionKey(enemyChampion)
  })

  return nextEnemyPicks
}

function computeCounterPressure(sourceChampion, targetChampion) {
  if (!sourceChampion || !targetChampion) {
    return 0
  }

  const desiredTags = getCounterTargetsForChampion(targetChampion)
  if (!desiredTags.length) {
    return 0
  }

  return desiredTags.reduce((score, tag) => {
    return hasAnyTag(sourceChampion, [tag]) ? score + 1 : score
  }, 0)
}

function computeDraftNoLuckScore({
  draftState,
  opponentComfortPool,
  enemyBans,
  roster,
  rosterProfiles,
  baseRosterProfiles,
}) {
  const effectiveDraftState = draftState ?? createEmptyDraftState()
  const comfortIdSet = new Set(opponentComfortPool.map((entry) => entry.championId))
  const enemyBanIdSet = new Set(
    (enemyBans ?? [])
      .map((entry) => getChampionByKey(entry.key)?.id)
      .filter(Boolean),
  )

  const bannedIds = (effectiveDraftState.bans ?? [])
    .map((championKey) => getChampionByKey(championKey)?.id)
    .filter(Boolean)
  const comfortBanHits = bannedIds.filter((championId) => comfortIdSet.has(championId)).length
  const banImpact = comfortBanHits * 4
  const enemyBanHits = Object.entries(effectiveDraftState.playerPicks ?? {}).reduce((count, [, championKey]) => {
    const champion = getChampionByKey(championKey)
    return champion && enemyBanIdSet.has(champion.id) ? count + 1 : count
  }, 0)
  const enemyBanImpact = -enemyBanHits * 3

  const rosterByRole = roster.reduce((acc, player) => {
    if (!acc[player.role]) {
      acc[player.role] = player
    }
    return acc
  }, {})

  let comfortImpact = 0
  let counterImpact = 0
  let synergyImpact = 0
  const roleBreakdown = {}

  DRAFT_ROLES.forEach((role) => {
    const playerPickKey = effectiveDraftState.playerPicks?.[role]
    const enemyPickKey = effectiveDraftState.enemyPicks?.[role]
    let mastery = null
    let comfortDelta = 0
    let counterDelta = 0
    let playerPressure = 0
    let enemyPressure = 0

    if (playerPickKey) {
      const rosterPlayer = rosterByRole[role]
      if (rosterPlayer) {
        const profile = rosterProfiles[rosterPlayer.playerId] ?? baseRosterProfiles[rosterPlayer.playerId]
        mastery = profile?.championMastery?.[playerPickKey] ?? 35

        if (mastery >= 95) {
          comfortDelta = 4
        } else if (mastery >= 80) {
          comfortDelta = 2
        } else if (mastery >= 60) {
          comfortDelta = 1
        } else if (mastery < 20) {
          comfortDelta = -8
        } else if (mastery < 35) {
          comfortDelta = -5
        } else if (mastery < 50) {
          comfortDelta = -3
        }

        comfortImpact += comfortDelta
      }
    }

    if (playerPickKey && enemyPickKey) {
      const playerChampion = getChampionByKey(playerPickKey)
      const enemyChampion = getChampionByKey(enemyPickKey)

      playerPressure = computeCounterPressure(playerChampion, enemyChampion)
      enemyPressure = computeCounterPressure(enemyChampion, playerChampion)
      counterDelta = clamp((playerPressure - enemyPressure) * 3, -7, 7)
      counterImpact += counterDelta
    }

    roleBreakdown[role] = {
      mastery,
      comfortDelta,
      counterDelta,
      playerPressure,
      enemyPressure,
    }
  })

  const pickedChampions = DRAFT_ROLES
    .map((role) => getChampionByKey(effectiveDraftState.playerPicks?.[role]))
    .filter(Boolean)

  if (pickedChampions.length >= 3) {
    const hasFrontline = pickedChampions.some((champion) => hasAnyTag(champion, ['Tank', 'Juggernaut', 'Engage']))
    const hasDps = pickedChampions.some((champion) => hasAnyTag(champion, ['Marksman', 'Burst', 'AP Carry', 'Scaling']))
    const hasEngage = pickedChampions.some((champion) => hasAnyTag(champion, ['Engage', 'Diver']))
    const hasPeelOrControl = pickedChampions.some((champion) => hasAnyTag(champion, ['Control', 'Disengage', 'Peel']))
    const avgRange = pickedChampions.reduce((sum, champion) => sum + (champion.stats?.range ?? 2), 0) / pickedChampions.length
    const avgCc = pickedChampions.reduce((sum, champion) => sum + (champion.stats?.cc ?? 2), 0) / pickedChampions.length

    if (hasFrontline && hasDps) {
      synergyImpact += 3
    }
    if (hasEngage && hasPeelOrControl) {
      synergyImpact += 2
    }
    if (avgRange >= 5 && avgCc >= 5) {
      synergyImpact += 2
    }
    if (!hasFrontline && pickedChampions.length === 5) {
      synergyImpact -= 3
    }
  }

  const rawScore = banImpact + enemyBanImpact + comfortImpact + counterImpact + synergyImpact
  const score = clamp(rawScore, -35, 35)
  const isComplete = DRAFT_ROLES.every(
    (role) => Boolean(effectiveDraftState.playerPicks?.[role]) && Boolean(effectiveDraftState.enemyPicks?.[role]),
  )

  return {
    score,
    banImpact,
    enemyBanImpact,
    comfortImpact,
    counterImpact,
    synergyImpact,
    comfortBanHits,
    enemyBanHits,
    roleBreakdown,
    isComplete,
  }
}

function evaluateNoLuckTeamCombos(draftState) {
  const pickedIds = Object.values(draftState?.playerPicks ?? {})
    .map((key) => getChampionByKey(key)?.id)
    .filter(Boolean)
  if (!pickedIds.length) {
    return { activeCombos: [], bonusMacro: 0, bonusSurvive: 0 }
  }

  const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedSet = new Set(pickedIds.map(normalize))
  const activeCombos = (NO_LUCK_COMBOS ?? []).filter((combo) =>
    combo.requirements.every((req) => normalizedSet.has(normalize(req))),
  )

  let bonusMacro = 0
  let bonusSurvive = 0
  activeCombos.forEach((combo) => {
    if (combo.bonus.stat === 'macro') {
      bonusMacro += combo.bonus.value
    } else if (combo.bonus.stat === 'group_survivability') {
      bonusSurvive += combo.bonus.value
    }
  })

  return { activeCombos, bonusMacro, bonusSurvive }
}

function getRoleSpecificBonus(player, champion, phaseId) {
  if (!player || !champion) {
    return 0
  }

  if (player.role === 'Jungle' && champion.jungleStats) {
    const clear = Number(champion.jungleStats.ClearSpeed ?? 5)
    const gank = Number(champion.jungleStats.GankPressure ?? 5)
    const obj = Number(champion.jungleStats.ObjectiveControl ?? 5)
    if (phaseId === 'early') return (clear * 0.7 + gank * 0.9) - 8
    if (phaseId === 'mid') return (gank * 0.6 + obj * 0.8) - 7
    return (obj * 0.9 + clear * 0.3) - 6
  }

  if (player.role === 'Mid' && champion.midlaneStats) {
    const roam = Number(champion.midlaneStats.RoamPotential ?? 5)
    const prio = Number(champion.midlaneStats.LanePriority ?? 5)
    const mana = Number(champion.midlaneStats.ManaManagement ?? champion.midlaneStats.EnergyManagement ?? 5)
    if (phaseId === 'early') return (prio * 0.9 + mana * 0.4) - 6.5
    if (phaseId === 'mid') return (roam * 0.8 + prio * 0.5) - 6.5
    return (roam * 0.6 + prio * 0.4) - 5
  }

  return 0
}

function computeCarryCeiling(players, role, stat) {
  const rolePlayers = players.filter((player) => player.role === role)
  if (!rolePlayers.length) {
    return 0
  }
  return rolePlayers[0][stat] ?? 0
}

function computeMetaPatchPickBonus(pickKey, metaPatchInfluence) {
  if (!pickKey || !metaPatchInfluence) return 0
  const normalized = String(pickKey).toLowerCase().replace(/[^a-z0-9]/g, '')
  const boosted = (metaPatchInfluence.boostedChampions ?? []).map((id) =>
    String(id).toLowerCase().replace(/[^a-z0-9]/g, ''),
  )
  const nerfed = (metaPatchInfluence.nerfedChampions ?? []).map((id) =>
    String(id).toLowerCase().replace(/[^a-z0-9]/g, ''),
  )
  if (boosted.includes(normalized)) return 6
  if (nerfed.includes(normalized)) return -6
  return 0
}

function computePhaseNoLuckBattle({
  matchId,
  roster,
  opponentRoster,
  approachId,
  draftScore,
  draftState,
  draftPunishmentProfile,
  aggressivite,
  rythmeJeu,
  prioriteObjectifs,
  gameIndex = 0,
  metaPatchInfluence = null,
  sideEarlyBoost = 0,
}) {
  const phases = [
    { id: 'early', label: 'Early', startMinute: 0, endMinute: 15, laneWeight: 0.58, macroWeight: 0.18, tfWeight: 0.24 },
    { id: 'mid', label: 'Mid', startMinute: 15, endMinute: 25, laneWeight: 0.26, macroWeight: 0.36, tfWeight: 0.38 },
    { id: 'late', label: 'Late', startMinute: 25, endMinute: 30, laneWeight: 0.12, macroWeight: 0.36, tfWeight: 0.52 },
  ]

  const approach = getMatchApproachById(approachId)
  const safeOpponentRoster = opponentRoster?.length ? opponentRoster : []
  const rolePenaltyByRole = draftPunishmentProfile?.byRole ?? {}
  const averageDraftPenalty = draftPunishmentProfile?.averagePenalty ?? 0
  const combos = evaluateNoLuckTeamCombos(draftState)
  const comboMacroBoost = combos.bonusMacro * 18
  const comboSurviveBoost = combos.bonusSurvive * 14

  const computeTeamPower = (players, phase) => {
    if (!players.length) {
      return 72
    }

    const phaseRoleWeights = ROLE_PHASE_WEIGHTS[phase.id] ?? {}
    let total = 0

    players.forEach((player) => {
      const rolePenalty = rolePenaltyByRole[player.role]
      const statMultiplier = rolePenalty?.multiplier ?? 1
      const roleWeight = phaseRoleWeights[player.role] ?? 0.2
      const laneValue = (player.laning ?? 70) * statMultiplier
      const macroValue = (player.macro ?? 70) * statMultiplier
      const tfValue = (player.teamfight ?? 70) * statMultiplier
      const mechValue = (player.mechanics ?? 70) * statMultiplier
      const mentalFactor = ((player.mental ?? 14) - 12) * 0.8
      const base =
        (laneValue * phase.laneWeight) +
        (macroValue * phase.macroWeight) +
        (tfValue * phase.tfWeight) +
        (mechValue * 0.08) +
        mentalFactor
      total += base * (roleWeight * 5)

      // role-specific champion bonus from jungle/mid pathing stats
      const pickKey = draftState?.playerPicks?.[player.role]
      const champion = getChampionByKey(pickKey)
      total += getRoleSpecificBonus(player, champion, phase.id)

      // Meta patch influence: picks in boosted archetype gain bonus, nerfed lose
      total += computeMetaPatchPickBonus(pickKey, metaPatchInfluence)
    })

    // Carry ceiling bonus: best Mid/ADC late game pulls the average up
    if (phase.id === 'late') {
      const adcMech = computeCarryCeiling(players, 'ADC', 'mechanics')
      const midMech = computeCarryCeiling(players, 'Mid', 'mechanics')
      total += Math.max(0, (adcMech - 70) * 0.7) + Math.max(0, (midMech - 70) * 0.5)
    } else if (phase.id === 'early') {
      const jgMech = computeCarryCeiling(players, 'Jungle', 'mechanics')
      const topLane = computeCarryCeiling(players, 'Top', 'laning')
      total += Math.max(0, (jgMech - 70) * 0.5) + Math.max(0, (topLane - 70) * 0.4)
    }

    // Combo bonuses scale with phase
    if (phase.id === 'late') {
      total += comboMacroBoost + comboSurviveBoost * 1.2
    } else if (phase.id === 'mid') {
      total += comboMacroBoost * 0.7 + comboSurviveBoost
    } else {
      total += comboMacroBoost * 0.3 + comboSurviveBoost * 0.4
    }

    return total / players.length
  }

  const computeEnemyPower = (players, phase) => {
    if (!players.length) {
      return 74
    }

    const phaseRoleWeights = ROLE_PHASE_WEIGHTS[phase.id] ?? {}
    let total = 0

    players.forEach((player) => {
      const roleWeight = phaseRoleWeights[player.role] ?? 0.2
      const laneValue = player.stats.laning * 5
      const macroValue = player.stats.macro * 5
      const tfValue = player.stats.teamfight * 5
      const mechValue = player.stats.mechanics * 5
      const mentalFactor = (player.stats.mental - 12) * 0.8
      const base =
        (laneValue * phase.laneWeight) +
        (macroValue * phase.macroWeight) +
        (tfValue * phase.tfWeight) +
        (mechValue * 0.08) +
        mentalFactor
      total += base * (roleWeight * 5)

      // Meta patch influence on enemy picks
      const enemyPickKey = draftState?.enemyPicks?.[player.role]
      total += computeMetaPatchPickBonus(enemyPickKey, metaPatchInfluence)
    })

    return total / players.length
  }

  const phaseResults = phases.map((phase) => {
    const baseTeamPower = computeTeamPower(roster, phase)
    const baseEnemyPower = computeEnemyPower(safeOpponentRoster, phase)
    const approachMultiplier =
      phase.id === 'early' ? approach.laneMultiplier : phase.id === 'late' ? approach.lateMultiplier : 1

    const objectiveBoost = phase.id === 'mid' || phase.id === 'late' ? (approach.objectiveMultiplier - 1) * 10 : 0
    const tacticBoost = (aggressivite * 0.08) + (rythmeJeu * 0.06) + (prioriteObjectifs * 0.04)
    const draftBoost = draftScore * (phase.id === 'early' ? 0.8 : phase.id === 'mid' ? 1.05 : 1.2) * DRAFT_WINRATE_IMPACT_FACTOR
    const exploitBoost = averageDraftPenalty * (phase.id === 'early' ? 15 : phase.id === 'mid' ? 12 : 9)

    // Controlled variance from mental strength of team
    const teamMental = roster.length
      ? roster.reduce((sum, p) => sum + (p.mental ?? 14), 0) / roster.length
      : 14
    const enemyMental = safeOpponentRoster.length
      ? safeOpponentRoster.reduce((sum, p) => sum + p.stats.mental, 0) / safeOpponentRoster.length
      : 14
    const mentalVarianceRange = Math.max(3, 14 - teamMental) // weaker mental → more variance
    const varianceSeed = stableHash(`${matchId}-g${gameIndex}-${phase.id}-var`)
    const teamVariance = ((varianceSeed % (mentalVarianceRange * 2 + 1)) - mentalVarianceRange) * 0.8
    const enemyVarianceRange = Math.max(3, 14 - enemyMental)
    const enemyVariance =
      ((stableHash(`${matchId}-g${gameIndex}-${phase.id}-enemy`) % (enemyVarianceRange * 2 + 1)) - enemyVarianceRange) * 0.7

    const sideBoost = phase.id === 'early' ? sideEarlyBoost : 0
    const teamPower = (baseTeamPower * approachMultiplier) + objectiveBoost + tacticBoost + draftBoost - approach.farmPenalty + teamVariance + sideBoost
    const enemyPower = baseEnemyPower + enemyVariance + exploitBoost
    const diff = teamPower - enemyPower
    const goldSwing = clamp(Math.round(diff * 52), -4200, 4200)

    return {
      ...phase,
      teamPower: Number(teamPower.toFixed(2)),
      enemyPower: Number(enemyPower.toFixed(2)),
      diff: Number(diff.toFixed(2)),
      goldSwing,
      winner: goldSwing >= 0 ? 'team' : 'enemy',
      teamVariance: Number(teamVariance.toFixed(2)),
    }
  })

  const totalGoldAdv = phaseResults.reduce((sum, phase) => sum + phase.goldSwing, 0)
  return {
    phases: phaseResults,
    totalGoldAdv,
    winner: totalGoldAdv >= 0 ? 'team' : 'enemy',
    activeCombos: combos.activeCombos,
  }
}

const LIVE_DECISION_MINUTES = [6, 14, 22]

function generateLiveTimeline({ matchId, teamName, opponentName, phaseBattle, gameIndex = 0 }) {
  const eventMinutes = [3, 6, 9, 12, 15, 18, 22, 25, 28, 30]
  const eventsByPhase = {
    early: eventMinutes.filter((minute) => minute <= 15),
    mid: eventMinutes.filter((minute) => minute > 15 && minute <= 25),
    late: eventMinutes.filter((minute) => minute > 25),
  }

  const scoreboard = {
    team: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
    enemy: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
  }

  let currentGoldDiff = 0
  const timeline = eventMinutes.map((minute, index) => {
    const phase = phaseBattle.phases.find((entry) => minute <= entry.endMinute) ?? phaseBattle.phases[2]
    const phaseEventCount = eventsByPhase[phase.id]?.length ?? 1
    const targetSwing = Math.round(phase.goldSwing / phaseEventCount)
    const randomVariance = (stableHash(`${matchId}-g${gameIndex}-${minute}-variance`) % 501) - 250
    let deltaGold = targetSwing + randomVariance

    if (index === eventMinutes.length - 1) {
      deltaGold = phaseBattle.totalGoldAdv - currentGoldDiff
    }

    currentGoldDiff += deltaGold

    const teamWonEvent = deltaGold >= 0
    const killDelta = Math.max(1, Math.round(Math.abs(deltaGold) / 720))
    const towerDelta = Math.abs(deltaGold) > 1400 ? 1 : 0
    const dragonDelta = minute >= 6 && minute <= 25 && Math.abs(deltaGold) > 900 ? 1 : 0

    if (teamWonEvent) {
      scoreboard.team.kills += killDelta
      scoreboard.team.towers += towerDelta
      scoreboard.team.dragons += dragonDelta
    } else {
      scoreboard.enemy.kills += killDelta
      scoreboard.enemy.towers += towerDelta
      scoreboard.enemy.dragons += dragonDelta
    }

    scoreboard.team.gold = 50000 + Math.max(0, currentGoldDiff)
    scoreboard.enemy.gold = 50000 + Math.max(0, -currentGoldDiff)

    const eventText = teamWonEvent
      ? `${teamName} prend l'initiative (${deltaGold >= 1600 ? 'teamfight majeur' : 'avantage macro'}).`
      : `${opponentName} repond (${deltaGold <= -1600 ? 'engage decisif' : 'trade objectif'}).`

    const chatText = teamWonEvent
      ? [`chat: ${teamName} draft diff!`, 'chat: No luck executed.', 'chat: clean macro.']
      : [`chat: ${opponentName} is online now.`, 'chat: scaling gap...', 'chat: rough call there.']

    const decision = LIVE_DECISION_MINUTES.includes(minute)
      ? buildLiveDecisionForMinute({ matchId, gameIndex, minute, teamWonEvent, currentGoldDiff })
      : null

    return {
      minute,
      phaseId: phase.id,
      deltaGold,
      goldDiff: currentGoldDiff,
      scoreboard: {
        team: { ...scoreboard.team },
        enemy: { ...scoreboard.enemy },
      },
      commentary: eventText,
      chatLine: chatText[stableHash(`${matchId}-g${gameIndex}-${minute}-chat`) % chatText.length],
      decision,
    }
  })

  return timeline
}

function buildLiveDecisionForMinute({ matchId, gameIndex, minute, teamWonEvent, currentGoldDiff }) {
  const seed = stableHash(`${matchId}-g${gameIndex}-decision-${minute}`) % 3
  const ahead = currentGoldDiff > 500
  const behind = currentGoldDiff < -500

  if (minute === 6) {
    return {
      id: `${matchId}-g${gameIndex}-d${minute}`,
      minute,
      title: 'Early Skirmish',
      question: 'Contest le 1er drake ou reset safe ?',
      options: [
        {
          id: 'contest',
          label: 'Contest le drake',
          reward: teamWonEvent ? 900 : -600,
          commentary: 'Votre jungler fait le 50/50 sur le drake.',
        },
        {
          id: 'reset',
          label: 'Reset safe',
          reward: ahead ? 200 : -150,
          commentary: 'Vous rentrez en base pour un power spike propre.',
        },
      ],
    }
  }

  if (minute === 14) {
    return {
      id: `${matchId}-g${gameIndex}-d${minute}`,
      minute,
      title: 'Mid Game Play',
      question: seed === 0 ? 'Force le Herald ou trade top ?' : 'Rotate bot pour le plate ?',
      options: [
        {
          id: 'force',
          label: 'Force le play',
          reward: teamWonEvent ? 1100 : -800,
          commentary: 'Votre équipe choisit l engagement vertical.',
        },
        {
          id: 'macro',
          label: 'Joue la macro',
          reward: ahead ? 500 : behind ? -200 : 300,
          commentary: 'Vous priorisez la vision et les waves.',
        },
      ],
    }
  }

  return {
    id: `${matchId}-g${gameIndex}-d${minute}`,
    minute,
    title: 'Late Game Call',
    question: 'Nashor setup ou teamfight mid ?',
    options: [
      {
        id: 'nashor',
        label: 'Setup Nashor',
        reward: ahead ? 1400 : behind ? -900 : 600,
        commentary: 'Vous installez la vision autour du Baron.',
      },
      {
        id: 'fight',
        label: 'Teamfight mid',
        reward: teamWonEvent ? 1200 : -1000,
        commentary: 'Vous cherchez le catch et la percee ouverte.',
      },
    ],
  }
}

function buildRoleOrderKda(players, keyPrefix) {
  const roleOrder = { Top: 1, Jungle: 2, Mid: 3, ADC: 4, Support: 5 }
  return [...players]
    .sort((a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99))
    .map((player, index) => ({
      player: {
        ...player,
        playerId: player.playerId ?? null,
      },
      seedKey: `${keyPrefix}-${index}-${player.role}-${player.joueur ?? player.pseudo}`,
    }))
}

function computePlayerRating({ kills, deaths, assists, teamKills, teamWon, role, playerMental, mastery }) {
  // Performance rating on a 0-10 scale inspired by Football Manager match ratings.
  let rating = 6.5
  const kdaRatio = (kills + assists) / Math.max(1, deaths)
  rating += kills * 0.35
  rating += assists * 0.12
  rating -= deaths * 0.3
  rating += (kdaRatio >= 5 ? 1 : kdaRatio >= 3 ? 0.6 : kdaRatio >= 2 ? 0.3 : kdaRatio >= 1 ? 0 : -0.4)

  if (teamKills > 0) {
    const contribution = (kills + assists) / Math.max(1, teamKills)
    if (contribution >= 0.6) rating += 0.8
    else if (contribution >= 0.4) rating += 0.4
    else if (contribution <= 0.1) rating -= 0.4
  }

  if (teamWon) rating += 0.3
  else rating -= 0.2

  if (role === 'ADC' && kills >= 6) rating += 0.4
  if (role === 'Support' && assists >= 12) rating += 0.5
  if (role === 'Jungle' && kdaRatio >= 4) rating += 0.3
  if (role === 'Mid' && kdaRatio >= 4) rating += 0.3

  if (typeof playerMental === 'number') {
    rating += (playerMental - 14) * 0.04
  }
  if (typeof mastery === 'number') {
    rating += (mastery - 50) * 0.008
  }

  return clamp(Number(rating.toFixed(1)), 1, 10)
}

function distributeKdaRows(rows, teamKills, teamWon, fatalRiskByRole = {}, extraContext = {}) {
  const remaining = { kills: teamKills, assists: teamKills * 2 }
  const { rosterProfiles = {}, baseRosterProfiles = {}, draftState = null, isEnemy = false } = extraContext

  return rows.map(({ player, seedKey }) => {
    const killWeight = player.role === 'ADC' || player.role === 'Mid' ? 1.35 : player.role === 'Jungle' ? 1.2 : 0.85
    const assistWeight = player.role === 'Support' ? 1.45 : player.role === 'Jungle' ? 1.25 : 0.95

    const kills = clamp(Math.round((stableHash(`${seedKey}-k`) % 5) * killWeight), 0, Math.max(0, remaining.kills))
    remaining.kills -= kills

    const assists = clamp(Math.round((stableHash(`${seedKey}-a`) % 8) * assistWeight), 0, Math.max(0, remaining.assists))
    remaining.assists -= assists

    const deathBase = teamWon ? 1 : 3
    const baseDeaths = clamp((stableHash(`${seedKey}-d`) % 4) + deathBase, 0, 12)
    const fatalRisk = clamp(fatalRiskByRole[player.role] ?? 0.08, 0.05, 0.95)
    const fatalTrigger = (stableHash(`${seedKey}-fatal`) % 100) < Math.round(fatalRisk * 100)
    let fatalDeaths = 0

    if (fatalTrigger) {
      const intensity = fatalRisk >= 0.75 ? 4 : fatalRisk >= 0.5 ? 3 : 2
      fatalDeaths = intensity + (stableHash(`${seedKey}-fatal-burst`) % 3)
    }

    const deaths = clamp(baseDeaths + fatalDeaths, 0, 16)

    let mastery = null
    if (!isEnemy && draftState && player.playerId) {
      const profile = rosterProfiles[player.playerId] ?? baseRosterProfiles[player.playerId]
      const pickKey = draftState.playerPicks?.[player.role]
      if (profile && pickKey) {
        mastery = profile.championMastery?.[pickKey] ?? 40
      }
    }

    const rating = computePlayerRating({
      kills,
      deaths,
      assists,
      teamKills,
      teamWon,
      role: player.role,
      playerMental: player.mental,
      mastery,
    })

    return {
      playerName: player.joueur ?? player.pseudo,
      role: player.role,
      playerId: player.playerId ?? null,
      kills,
      deaths,
      assists,
      kda: Number(((kills + assists) / Math.max(1, deaths)).toFixed(2)),
      rating,
      mastery,
    }
  })
}

function getMvpFromRows(rows) {
  if (!rows?.length) {
    return null
  }

  return [...rows].sort((a, b) => b.kda - a.kda || (b.kills + b.assists) - (a.kills + a.assists))[0]
}

function buildDefeatReason({ phaseBattle, draftScore, totalGoldDiff }) {
  if (totalGoldDiff >= 0) {
    return 'Victoire controlee: la draft et l execution ont maintenu l avantage jusqu au late game.'
  }

  const earlyPhase = phaseBattle.phases.find((phase) => phase.id === 'early')
  const latePhase = phaseBattle.phases.find((phase) => phase.id === 'late')

  if ((earlyPhase?.goldSwing ?? 0) < -1500) {
    return 'Votre retard aux Golds en Early etait trop grand pour revenir proprement.'
  }

  if ((latePhase?.goldSwing ?? 0) < -1200) {
    return 'Leur scaling en Late Game a pris le dessus malgre une phase mid correcte.'
  }

  if (draftScore <= -5) {
    return 'La draft et les contre-picks adverses ont limite vos options de teamfight.'
  }

  return 'La macro adverse a creuse un ecart progressif sur les objectifs neutres.'
}

function simulateSingleGame({
  matchId,
  gameIndex,
  teamName,
  opponentName,
  roster,
  opponentRoster,
  draftState,
  draftScore,
  draftPunishmentProfile,
  rosterProfiles,
  baseRosterProfiles,
  approachId,
  aggressivite,
  rythmeJeu,
  prioriteObjectifs,
  metaPatchInfluence = null,
  teamSide = 'blue',
}) {
  // Side bonus: blue side has first pick priority (+1 early lane), red side has last pick counter (+1 draft vs enemy carry)
  const sideDraftScore = teamSide === 'blue' ? draftScore + 1 : draftScore + 2
  const sideEarlyBoost = teamSide === 'blue' ? 1.5 : 0  // blue gets a small early advantage

  const phaseBattle = computePhaseNoLuckBattle({
    matchId: `${matchId}-g${gameIndex}-${teamSide}`,
    roster,
    opponentRoster,
    approachId,
    draftScore: sideDraftScore,
    draftState,
    draftPunishmentProfile,
    aggressivite,
    rythmeJeu,
    prioriteObjectifs,
    gameIndex,
    metaPatchInfluence,
    sideEarlyBoost,
  })

  const timeline = generateLiveTimeline({
    matchId: `${matchId}-g${gameIndex}`,
    teamName,
    opponentName,
    phaseBattle,
    gameIndex,
  })

  const finalEvent = timeline[timeline.length - 1]
  const teamWon = (finalEvent?.goldDiff ?? phaseBattle.totalGoldAdv) >= 0
  const teamRows = distributeKdaRows(
    buildRoleOrderKda(roster, `${matchId}-g${gameIndex}-team`),
    finalEvent?.scoreboard.team.kills ?? 9,
    teamWon,
    draftPunishmentProfile.fatalRiskByRole,
    { rosterProfiles, baseRosterProfiles, draftState, isEnemy: false },
  )
  const enemyRows = distributeKdaRows(
    buildRoleOrderKda(
      (opponentRoster?.length ? opponentRoster : []).map((player) => ({
        joueur: player.pseudo,
        role: player.role,
        mental: player.stats?.mental ?? 14,
      })),
      `${matchId}-g${gameIndex}-enemy`,
    ),
    finalEvent?.scoreboard.enemy.kills ?? 9,
    !teamWon,
    {},
    { isEnemy: true },
  )

  return {
    gameIndex,
    phaseBattle,
    timeline,
    finalScoreboard: finalEvent?.scoreboard ?? {
      team: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
      enemy: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
    },
    goldDiff: finalEvent?.goldDiff ?? phaseBattle.totalGoldAdv,
    teamWon,
    teamRows,
    enemyRows,
    activeCombos: phaseBattle.activeCombos ?? [],
    mvp: getMvpFromRows(teamWon ? teamRows : enemyRows),
  }
}

function buildMatchSimulationEngine({
  matchId,
  teamName,
  opponentName,
  roster,
  opponentRoster,
  draftState,
  rosterProfiles,
  baseRosterProfiles,
  approachId,
  draftScore,
  seriesType = 'BO1',
  mentalCoachLevel = 0,
  isHighPressureMatch = false,
  aggressivite,
  rythmeJeu,
  prioriteObjectifs,
  metaPatchInfluence = null,
  approachByGame = null,
}) {
  const draftPunishmentProfile = applyMentalCoachToPunishmentProfile(
    computeDraftPunishmentProfile({
      draftState,
      roster,
      rosterProfiles,
      baseRosterProfiles,
    }),
    mentalCoachLevel,
    isHighPressureMatch,
  )

  const winsNeeded = seriesType === 'BO5' ? 3 : seriesType === 'BO3' ? 2 : 1
  const games = []
  let teamWins = 0
  let enemyWins = 0
  let gameIndex = 0

  // Ban pool reserved between games (acts like "target bans" carrying the meta-read across the series)
  const reservedBans = new Set(draftState?.bans ?? [])

  while (teamWins < winsNeeded && enemyWins < winsNeeded) {
    // Derive per-game draft state: carry bans, rotate picks to reflect adaptation after the first game.
    const thisGameDraft = {
      bans: Array.from(reservedBans),
      playerPicks: { ...(draftState?.playerPicks ?? {}) },
      enemyPicks: { ...(draftState?.enemyPicks ?? {}) },
      pickTurnIndex: draftState?.pickTurnIndex ?? 0,
    }

    // Approach may differ per game if approachByGame is provided, otherwise fall back to the global approachId
    const gameApproachId = approachByGame?.[gameIndex] ?? approachId

    // Side swap across games: game 1 = blue, game 2 = red, game 3 = blue...
    const teamSide = gameIndex % 2 === 0 ? 'blue' : 'red'

    const game = simulateSingleGame({
      matchId,
      gameIndex,
      teamName,
      opponentName,
      roster,
      opponentRoster,
      draftState: thisGameDraft,
      draftScore,
      draftPunishmentProfile,
      rosterProfiles,
      baseRosterProfiles,
      approachId: gameApproachId,
      aggressivite,
      rythmeJeu,
      prioriteObjectifs,
      metaPatchInfluence,
      teamSide,
    })
    game.teamSide = teamSide

    games.push(game)
    if (game.teamWon) {
      teamWins += 1
    } else {
      enemyWins += 1
    }
    gameIndex += 1
  }

  const seriesWon = teamWins > enemyWins
  const lastGame = games[games.length - 1]
  const finalGame = lastGame ?? {
    phaseBattle: { phases: [], totalGoldAdv: 0 },
    timeline: [],
    finalScoreboard: {
      team: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
      enemy: { kills: 0, gold: 50000, towers: 0, dragons: 0 },
    },
    goldDiff: 0,
    teamWon: false,
    teamRows: [],
    enemyRows: [],
    mvp: null,
  }

  // Series-level aggregated rows (average ratings across games) for the roster progression logic.
  const seriesRowsByPlayerId = {}
  games.forEach((game) => {
    game.teamRows.forEach((row) => {
      if (!row.playerId) return
      const entry = seriesRowsByPlayerId[row.playerId] ?? {
        playerId: row.playerId,
        playerName: row.playerName,
        role: row.role,
        kills: 0,
        deaths: 0,
        assists: 0,
        ratingSum: 0,
        gamesPlayed: 0,
      }
      entry.kills += row.kills
      entry.deaths += row.deaths
      entry.assists += row.assists
      entry.ratingSum += row.rating ?? 6.5
      entry.gamesPlayed += 1
      seriesRowsByPlayerId[row.playerId] = entry
    })
  })

  const seriesRows = Object.values(seriesRowsByPlayerId).map((entry) => ({
    ...entry,
    rating: Number((entry.ratingSum / Math.max(1, entry.gamesPlayed)).toFixed(1)),
  }))

  return {
    phaseBattle: finalGame.phaseBattle,
    timeline: finalGame.timeline,
    finalScoreboard: finalGame.finalScoreboard,
    goldDiff: finalGame.goldDiff,
    teamWon: seriesWon,
    teamRows: finalGame.teamRows,
    enemyRows: finalGame.enemyRows,
    draftPunishmentProfile,
    mvp: finalGame.mvp ?? getMvpFromRows(seriesWon ? finalGame.teamRows : finalGame.enemyRows),
    defeatReason: buildDefeatReason({
      phaseBattle: finalGame.phaseBattle,
      draftScore,
      totalGoldDiff: finalGame.goldDiff,
    }),
    games,
    seriesRows,
    seriesScore: `${teamWins}-${enemyWins}`,
    seriesWon,
    teamWins,
    enemyWins,
  }
}

function buildEuropeSoloQRanking(players, profileOverrides = {}) {
  const ranking = players
    .filter((player) => player.league_id === 'LEC' || player.league_id === 'LFL')
    .map((player) => {
      const seed = stableHash(`soloq-${player.id}`)
      const baseLp =
        500 +
        player.stats.mechanics * 22 +
        player.stats.mental * 16 +
        player.stats.macro * 8 +
        (seed % 220)

      const override = profileOverrides[player.id]
      const lp = clamp(Math.round(override?.ladderLP ?? baseLp), 0, 1800)
      const confident = override?.confident ?? lp >= 1200

      return {
        id: player.id,
        pseudo: player.pseudo,
        teamId: player.team_id,
        leagueId: player.league_id,
        role: player.role,
        lp,
        ladderLabel: getSoloQLadderLabel(lp),
        confident,
      }
    })
    .sort((a, b) => b.lp - a.lp)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }))

  return ranking
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="fm-panel">
      <header className="mb-3 flex items-end justify-between gap-3 border-b border-[var(--border-strong)] pb-2">
        <div>
          <h2 className="font-heading text-[1.05rem] uppercase tracking-[0.07em] text-[var(--text-main)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  )
}

function DecisionEventModal({ decision, onResolve }) {
  if (!decision) return null

  const formatEffect = (fx = {}) => {
    const bits = []
    if (fx.budgetDelta) bits.push(`${fx.budgetDelta > 0 ? '+' : ''}${(fx.budgetDelta / 1000).toFixed(0)}k€`)
    if (fx.moralDelta)  bits.push(`${fx.moralDelta > 0 ? '+' : ''}${fx.moralDelta} moral`)
    if (fx.conditionDelta) bits.push(`${fx.conditionDelta > 0 ? '+' : ''}${fx.conditionDelta} forme`)
    if (fx.reputationDelta) bits.push(`${fx.reputationDelta > 0 ? '+' : ''}${fx.reputationDelta} image`)
    if (fx.ladderLpDelta) bits.push(`${fx.ladderLpDelta > 0 ? '+' : ''}${fx.ladderLpDelta} LP`)
    if (fx.stats?.mechanics) bits.push(`+${fx.stats.mechanics} méca`)
    if (fx.stats?.teamfight) bits.push(`+${fx.stats.teamfight} TF`)
    if (fx.stats?.macro) bits.push(`+${fx.stats.macro} macro`)
    return bits.join(' · ')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--border-soft)] px-5 py-4">
          <span className="text-3xl leading-none">{decision.icon}</span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Décision manageriale requise</p>
            <h2 className="font-heading text-lg uppercase tracking-[0.04em] text-[var(--text-main)]">{decision.headline}</h2>
          </div>
        </header>

        <div className="px-5 py-4">
          <p className="text-sm text-[var(--text-soft)]">{decision.prompt}</p>
        </div>

        <div className="grid gap-2 border-t border-[var(--border-soft)] p-4">
          {decision.choices.map((choice) => {
            const effectLine = formatEffect(choice.effects)
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => onResolve(choice.id)}
                className="group rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-3)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-heading text-sm uppercase tracking-wide text-[var(--text-main)] group-hover:text-[var(--accent)]">
                    {choice.label}
                  </p>
                  {effectLine ? (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{effectLine}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--text-soft)]">{choice.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NewsFeedPanel({ newsFeed = [] }) {
  if (!newsFeed.length) {
    return (
      <Panel title="Actualités" subtitle="News de l'équipe">
        <p className="text-sm text-[var(--text-soft)]">Aucune news. Avance le temps pour voir ton équipe vivre.</p>
      </Panel>
    )
  }

  return (
    <Panel title="Actualités" subtitle={`${newsFeed.length} événement${newsFeed.length > 1 ? 's' : ''} récents`}>
      <ul className="space-y-2">
        {newsFeed.slice(0, 8).map((evt) => {
          const borderColor = evt.category === 'positive'
            ? 'border-l-green-500'
            : evt.category === 'negative'
              ? 'border-l-red-500'
              : 'border-l-slate-500'
          return (
            <li key={evt.id} className={`rounded border border-[var(--border-soft)] border-l-[3px] ${borderColor} bg-[var(--surface-2)] px-3 py-2`}>
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{evt.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-main)]">{evt.headline}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">{evt.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Semaine {evt.weekIndex + 1}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function MailboxPage({ mails, selectedMailId, onSelectMail, onMarkAllRead, onOpenPage }) {
  const [filter, setFilter] = useState('all')

  const filteredMails = useMemo(() => {
    if (filter === 'unread') return mails.filter((mail) => mail.unread)
    if (filter === 'priority') return mails.filter((mail) => mail.priority === 'urgent' || mail.priority === 'high')
    return mails
  }, [mails, filter])

  const selectedMail = mails.find((mail) => mail.id === selectedMailId) ?? filteredMails[0] ?? null
  const unreadCount = mails.filter((mail) => mail.unread).length
  const hasUnread = unreadCount > 0

  const priorityStyles = {
    urgent: 'border-red-500/60 bg-red-500/15 text-red-200',
    high: 'border-amber-400/60 bg-amber-500/15 text-amber-200',
    normal: 'border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-soft)]',
  }
  const priorityLabels = {
    urgent: 'Urgent',
    high: 'Important',
    normal: 'Info',
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Boite mail" subtitle={`${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Tout' },
            { id: 'unread', label: 'Non lus' },
            { id: 'priority', label: 'Priorite' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`rounded border px-2 py-1 text-xs uppercase tracking-[0.08em] transition ${
                filter === option.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-soft)] hover:border-[var(--accent)]'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={!hasUnread}
            className="ml-auto rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Tout lire
          </button>
        </div>

        {!filteredMails.length ? (
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
            Aucun message pour ce filtre.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {filteredMails.map((mail) => {
              const isSelected = selectedMail?.id === mail.id
              const priorityClass = priorityStyles[mail.priority] ?? priorityStyles.normal
              const priorityLabel = priorityLabels[mail.priority] ?? priorityLabels.normal
              return (
                <button
                  key={mail.id}
                  type="button"
                  onClick={() => onSelectMail(mail.id)}
                  className={`w-full rounded border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                      : 'border-[var(--border-soft)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="pt-0.5 text-base leading-none">{mail.icon ?? '✉️'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm ${mail.unread ? 'font-semibold text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                          {mail.subject}
                        </p>
                        {mail.unread ? <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{mail.from}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-soft)]">{mail.preview}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${priorityClass}`}>
                          {priorityLabel}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{mail.dateLabel}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title="Lecture" subtitle={selectedMail ? selectedMail.from : 'Selectionne un message'}>
        {selectedMail ? (
          <div className="space-y-3">
            <div>
              <p className="font-heading text-2xl uppercase tracking-[0.05em] text-[var(--text-main)]">{selectedMail.subject}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{selectedMail.dateLabel}</p>
            </div>

            <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--text-soft)]">
              {selectedMail.body ?? selectedMail.preview}
            </div>

            {selectedMail.targetPage ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPage(selectedMail.targetPage)}
                  className="rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-[var(--accent)] transition hover:bg-[var(--surface-2)]"
                >
                  {selectedMail.ctaLabel ?? 'Ouvrir l ecran'}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
            Rien a afficher. Avance le temps pour recevoir des messages.
          </p>
        )}
      </Panel>
    </div>
  )
}

function DashboardPage({ effectif, onOpenPlayerProfile, onOpenSoloQLadder, soloQPreview, matchDayInsights, newsFeed, activeTeamName }) {
  return (
    <div className="space-y-4">
      {matchDayInsights ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Match Prediction" subtitle="Lecture analyste pre-draft (stats pures)">
            <div className="space-y-2 text-sm text-[var(--text-soft)]">
              <p>
                Prediction brute: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.baseWinRate}%</span>
              </p>
              <p>
                Projection avec plan: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.projectedWinRate}%</span>
              </p>
              <p>
                Niveau adverse estime: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.opponentPower}</span>
              </p>
            </div>
            <p className="mt-2 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
              {matchDayInsights.analystNote}
            </p>
          </Panel>

          <Panel title="Score de Draft" subtitle="Bonus/Malus final applique au match">
            <div className="space-y-2 text-sm text-[var(--text-soft)]">
              <p>
                Score Draft No Luck: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftScoreCard.score >= 0 ? '+' : ''}{matchDayInsights.draftScoreCard.score}</span>
              </p>
              <p>
                Impact bans: <span className="font-semibold text-[var(--text-main)]">+{matchDayInsights.draftScoreCard.banImpact}</span> ({matchDayInsights.draftScoreCard.comfortBanHits} comfort picks bloques)
              </p>
              <p>
                Confort de tes picks: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftScoreCard.comfortImpact >= 0 ? '+' : ''}{matchDayInsights.draftScoreCard.comfortImpact}</span>
              </p>
              <p>
                Counter dynamique: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftScoreCard.counterImpact >= 0 ? '+' : ''}{matchDayInsights.draftScoreCard.counterImpact}</span>
              </p>
              <p>
                Synergie compo: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftScoreCard.synergyImpact >= 0 ? '+' : ''}{matchDayInsights.draftScoreCard.synergyImpact}</span>
              </p>
              <p>
                Impact bans IA: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftScoreCard.enemyBanImpact >= 0 ? '+' : ''}{matchDayInsights.draftScoreCard.enemyBanImpact}</span>
              </p>
              <p>
                Projection finale (avec draft): <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.draftProjectedWinRate}%</span>
              </p>
            </div>

            {!matchDayInsights.draftScoreCard.isComplete ? (
              <p className="mt-2 rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
                Draft incomplete: complete les 5 roles pour maximiser ton edge No Luck.
              </p>
            ) : null}
          </Panel>

          <Panel title="Etat pre-match" subtitle="Indice de preparation">
            <p className="text-sm text-[var(--text-soft)]">
              Readiness score: <span className="font-semibold text-[var(--text-main)]">{matchDayInsights.readinessScore}</span>
            </p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">{matchDayInsights.readinessLabel}</p>
          </Panel>

          <Panel title="Plan express" subtitle="Rappels tactiques">
            <ul className="space-y-2 text-sm text-[var(--text-soft)]">
              <li>1. Ouvrir avec un tempo controle sur les 8 premieres minutes.</li>
              <li>2. Conserver la priorite vision avant chaque objectif neutre.</li>
              <li>3. Utiliser le focus {matchDayInsights.focusJoueur} pour provoquer une erreur cle.</li>
            </ul>
          </Panel>
        </div>
      ) : null}

      <NewsFeedPanel newsFeed={newsFeed} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
        <Panel title="Prochain adversaire" subtitle="LFL Spring - Week 8">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 md:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Match principal</p>
              <p className="mt-1 font-heading text-2xl uppercase tracking-[0.05em]">{activeTeamName} vs Nova Prime</p>
              <p className="text-sm text-[var(--text-soft)]">Vendredi 19:00 - Patch 14.7</p>
            </article>
            <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Prediction interne</p>
              <p className="mt-1 font-heading text-2xl uppercase tracking-[0.05em]">58%</p>
              <p className="text-sm text-[var(--text-soft)]">Objectif: first drake</p>
            </article>
          </div>
        </Panel>

        <Panel title="Derniers resultats" subtitle="Forme recente">
          <table className="fm-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Adversaire</th>
                <th>Resultat</th>
                <th>Score</th>
                <th>Note equipe</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['08 Avr', 'Titan Forge', 'Victoire', '2-1', '8.1'],
                ['05 Avr', 'Rektory', 'Victoire', '2-0', '8.4'],
                ['02 Avr', 'Orion 9', 'Defaite', '1-2', '7.2'],
                ['29 Mar', 'Eclipse 5', 'Victoire', '2-0', '8.0'],
              ].map((row) => (
                <tr key={row[0] + row[1]}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

        <div className="space-y-4">
          <Panel title="Moral global" subtitle="Etat du vestiaire">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Moral equipe: <span className="font-semibold text-[var(--text-main)]">Bon</span>
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Confiance shotcall: <span className="font-semibold text-[var(--text-main)]">Elevee</span>
            </p>
            <p className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[var(--warn-text)]">
              Vigilance fatigue: Rook + Naru
            </p>
          </div>
        </Panel>

          <Panel title="Messages" subtitle="News importantes">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Nouveau patch dans 5 jours: adaptation des priorites bot lane.
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Le board demande une qualification en demi-finale des playoffs.
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Scout report: 2 profils mid lane qualifies en ERL.
            </p>
          </div>
        </Panel>

          <Panel title="Roster rapide" subtitle="Acces direct fiche joueur">
          <div className="space-y-2">
            {effectif.map((player) => (
              <button
                key={player.playerId}
                type="button"
                onClick={() => onOpenPlayerProfile(player.playerId)}
                className="flex w-full items-center justify-between rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm transition hover:border-[var(--accent)]"
              >
                <span className="font-semibold text-[var(--text-main)]">{player.joueur}</span>
                <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{player.role}</span>
              </button>
            ))}
          </div>
        </Panel>

          <Panel title="Classement SoloQ Europe" subtitle="LEC + LFL melanges">
          <div className="space-y-2">
            {soloQPreview.map((player) => (
              <div
                key={`preview-${player.id}`}
                className="flex items-center justify-between rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm"
              >
                <span className="font-semibold text-[var(--text-main)]">
                  #{player.rank} {player.pseudo}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{player.lp} LP</span>
              </div>
            ))}
          </div>

            <button
            type="button"
            onClick={onOpenSoloQLadder}
            className="mt-3 w-full rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.24)]"
          >
            Ouvrir le classement complet
            </button>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function EffectifPage({ effectif, activeLeague, activeTeamName, onOpenPlayerProfile, schedule, currentDate }) {
  const todayKey = toDateKey(currentDate)
  const upcomingMatches = (schedule ?? [])
    .filter((match) => match.status === 'upcoming')
    .slice(0, 6)
  const playedMatches = (schedule ?? [])
    .filter((match) => match.status === 'played')
    .slice(-3)
    .reverse()

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Panel
        title="Effectif"
        subtitle={`Stats joueurs, forme physique et contrats - ${activeLeague.name} (${activeLeague.region}) - ${activeTeamName}`}
      >
        <table className="fm-data-table">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Role</th>
              <th>Laning</th>
              <th>Teamfight</th>
              <th>Macro</th>
              <th>Mechanics</th>
              <th>Moral</th>
              <th>Forme</th>
              <th>Contrat</th>
            </tr>
          </thead>
          <tbody>
            {effectif.map((row) => (
              <tr key={row.playerId}>
                <td>
                  <button
                    type="button"
                    onClick={() => onOpenPlayerProfile(row.playerId)}
                    className="rounded px-1 py-0.5 text-left text-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
                  >
                    {row.joueur}
                  </button>
                  <TraitList traitIds={row.traits} size="sm" showLabel={false} className="mt-0.5" />
                </td>
                <td>{row.role}</td>
                <td>{row.laning}</td>
                <td>{row.teamfight}</td>
                <td>{row.macro}</td>
                <td>{row.mechanics}</td>
                <td>{row.moral}</td>
                <td>{row.forme}</td>
                <td>{row.contrat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="space-y-4">
        <Panel title="Niveau de ligue" subtitle="Impact No Luck par tier">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>
              Ligue: <span className="font-semibold text-[var(--text-main)]">{activeLeague.name}</span>
            </p>
            <p>
              Tier: <span className={`tier-badge ${activeLeague.tier === 1 ? 'tier-badge--t1' : 'tier-badge--t2'}`}>Tier {activeLeague.tier}</span>
            </p>
            <p>
              Bonus stats de base applique: <span className="font-semibold text-[var(--text-main)]">+{activeLeague.tier === 1 ? 6 : 1}</span>
            </p>
          </div>
        </Panel>

        <Panel title="Etat physique" subtitle="Charge recente">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>Charge moyenne: 73%</p>
            <p>Risque eleve: 1 joueur</p>
            <p>Recuperation recommandee: 2 blocs</p>
          </div>
        </Panel>

        <Panel title="Contrats sensibles" subtitle="Actions manager">
          <p className="text-sm text-[var(--text-soft)]">Rook expire en 2026: proposer extension avant la semaine 10.</p>
        </Panel>

        <Panel title="Calendrier equipe" subtitle="Prochains matchs et derniers resultats">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">A venir</p>
              {upcomingMatches.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {upcomingMatches.map((match) => (
                    <div
                      key={`upcoming-${match.id}`}
                      className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1.5"
                    >
                      <p className="text-[var(--text-main)]">
                        {formatDateLong(match.date)} - vs {match.opponent}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {match.stage ?? 'Saison reguliere'} • {match.seriesType ?? 'BO3'}
                        {match.dateKey === todayKey ? ' • Aujourd hui' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[var(--text-soft)]">Aucun match a venir.</p>
              )}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Derniers joues</p>
              {playedMatches.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {playedMatches.map((match) => (
                    <div
                      key={`played-${match.id}`}
                      className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1.5"
                    >
                      <p className="text-[var(--text-main)]">
                        {formatDateLong(match.date)} - vs {match.opponent}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {match.result ?? '-'} • {match.stage ?? 'Saison reguliere'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[var(--text-soft)]">Aucun resultat enregistre.</p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function getFmColorClass(value) {
  if (value >= 15) {
    return 'text-lime-300'
  }
  if (value >= 10) {
    return 'text-amber-300'
  }
  if (value >= 7) {
    return 'text-zinc-300'
  }
  return 'text-rose-300'
}

function toFmFromHundred(value) {
  return clamp(Math.round((value / 100) * 20), 1, 20)
}

function TraitBadge({ traitId, size = 'md', showLabel = true }) {
  const trait = getTrait(traitId)
  if (!trait) return null
  const sz = size === 'sm'
    ? 'h-5 px-1.5 text-[9px] gap-1'
    : size === 'lg'
      ? 'h-8 px-3 text-xs gap-2'
      : 'h-6 px-2 text-[10px] gap-1.5'
  const iconSz = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-[var(--surface-2)] font-semibold uppercase tracking-wide ${sz}`}
      style={{ borderColor: trait.color, color: trait.color }}
      title={trait.description}
    >
      <span className={iconSz}>{trait.icon}</span>
      {showLabel ? <span>{trait.name}</span> : null}
    </span>
  )
}

function TraitList({ traitIds, size = 'md', showLabel = true, className = '' }) {
  if (!traitIds?.length) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {traitIds.map((id) => <TraitBadge key={id} traitId={id} size={size} showLabel={showLabel} />)}
    </div>
  )
}

function PlayerProfilePage({ player, profile, onBackToRoster, onTrainChampion }) {
  const [poolSearch, setPoolSearch] = useState('')

  if (!player || !profile) {
    return (
      <Panel title="Profil Joueur" subtitle="Aucun joueur selectionne">
        <p className="text-sm text-[var(--text-soft)]">Selectionne un joueur depuis l'onglet Effectif.</p>
      </Panel>
    )
  }

  const attributeRows = [
    { label: 'Laning', value: toFmFromHundred(player.laning) },
    { label: 'Teamfight', value: toFmFromHundred(player.teamfight) },
    { label: 'Mechanics', value: toFmFromHundred(player.mechanics) },
    { label: 'Macro', value: toFmFromHundred(player.macro) },
  ]

  const normalizedPoolQuery = poolSearch.trim().toLowerCase()

  const filteredPool = CHAMPIONS_DB.map((champion) => {
    const key = `${champion.id}-${champion.role}`
    return {
      key,
      id: champion.id,
      name: champion.name,
      role: champion.role,
      mastery: profile.championMastery[key] ?? 10,
    }
  })
    .filter((entry) => {
      if (!normalizedPoolQuery) {
        return true
      }

      const haystack = `${entry.name} ${entry.id} ${entry.role}`.toLowerCase()
      return haystack.includes(normalizedPoolQuery)
    })
    .sort((a, b) => b.mastery - a.mastery)

  return (
    <section className="space-y-4">
      <article className="rounded border border-[var(--border-strong)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-[var(--border-soft)] bg-[var(--surface-3)] font-heading text-xl tracking-[0.06em]">
              {profile.pseudo.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.09em] text-[var(--text-muted)]">Profil joueur</p>
              <h2 className="truncate font-heading text-2xl uppercase tracking-[0.05em]">{profile.pseudo}</h2>
              <p className="text-sm text-[var(--text-soft)]">
                {profile.realName} - {player.role} - {profile.age} ans - {profile.nationality}
              </p>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Team ID: {player.teamId}</p>
              <TraitList traitIds={profile.traits} size="md" className="mt-2" />
            </div>
          </div>

          <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.09em] text-[var(--text-muted)]">Valeur marchande</p>
            <p className="font-heading text-xl tracking-[0.04em] text-[var(--text-main)]">{profile.marketValue}</p>
          </div>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.45fr_0.95fr]">
        <Panel title="Attributs" subtitle="Bloc gauche - FM 1 a 20">
          <div className="space-y-3">
            {attributeRows.map((attribute) => (
              <div key={attribute.label} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-[var(--text-soft)]">{attribute.label}</span>
                  <span className={`font-semibold ${getFmColorClass(attribute.value)}`}>{attribute.value}/20</span>
                </div>
                <div className="h-2 rounded bg-[var(--surface-1)]">
                  <div className="h-2 rounded bg-[var(--accent)]" style={{ width: `${attribute.value * 5}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Champion Pool" subtitle={`Bloc central - Filtrage sur ${CHAMPIONS_DB.length} champions`}>
          <div className="mb-2">
            <input
              type="text"
              value={poolSearch}
              onChange={(event) => setPoolSearch(event.target.value)}
              placeholder="Rechercher un champion..."
              className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            />
          </div>

          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {filteredPool.map((entry) => {
              const championImageUrl = getChampionImageUrl(entry)

              return (
                <div key={entry.key} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-[var(--border-soft)] bg-[var(--surface-3)]">
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                          {entry.name.slice(0, 2)}
                        </span>
                        {championImageUrl ? (
                          <img
                            src={championImageUrl}
                            alt={entry.name}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{entry.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{entry.role}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onTrainChampion(player.playerId, entry.key)}
                      className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)]"
                    >
                      Entrainer
                    </button>
                  </div>
                  <div className="mb-1 h-1.5 rounded bg-[var(--surface-1)]">
                    <div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${entry.mastery}%` }} />
                  </div>
                  <p className="text-xs text-[var(--text-soft)]">Maitrise: {entry.mastery}/100</p>
                </div>
              )
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Info & Moral" subtitle="Bloc droit - Etat joueur">
            <div className="space-y-2 text-sm text-[var(--text-soft)]">
              <p>
                Moral actuel: <span className="font-semibold text-[var(--text-main)]">{profile.moral}</span>
              </p>
              <p>
                Condition physique: <span className="font-semibold text-[var(--text-main)]">{profile.condition}%</span>
              </p>
              <div className="h-2 rounded bg-[var(--surface-1)]">
                <div
                  className={`h-2 rounded ${profile.condition < 50 ? 'bg-[var(--danger-text)]' : 'bg-[var(--accent)]'}`}
                  style={{ width: `${profile.condition}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Regle No Luck: si condition {'<'} 50%, baisse de performance en match.
              </p>
            </div>
          </Panel>

          <Panel title="Derniers matchs" subtitle="Historique recent">
            <div className="flex flex-wrap gap-2">
              {profile.matchHistory.map((result, index) => (
                <span
                  key={`${result}-${index}`}
                  className={`rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                    result === 'V'
                      ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] text-[var(--text-main)]'
                      : 'border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]'
                  }`}
                >
                  {result}
                </span>
              ))}
            </div>
          </Panel>

          <button
            type="button"
            onClick={onBackToRoster}
            className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)]"
          >
            Retour a l'effectif
          </button>
        </div>
      </div>
    </section>
  )
}

function ChampionnatPage({ activeLeague, standings, schedule, currentDate, onOpenTeamRoster }) {
  const isLec = activeLeague.id === 'LEC'
  const lecStageContext = isLec ? getLecStageContext(schedule, currentDate) : null
  const stageLabel = lecStageContext?.activeStage ?? 'Saison reguliere'
  const versusProgress = lecStageContext?.progressByStage?.['LEC Versus'] ?? { total: 0, played: 0, upcoming: 0 }
  const springProgress = lecStageContext?.progressByStage?.Printemps ?? { total: 0, played: 0, upcoming: 0 }
  const summerProgress = lecStageContext?.progressByStage?.Ete ?? { total: 0, played: 0, upcoming: 0 }
  const versusBracket = isLec ? buildLecVersusBracketProjection(standings) : null
  const topTeams = standings.slice(0, 3)
  const slots = {
    firstStand: versusBracket?.champion?.name ?? standings[0]?.name ?? 'A determiner',
    msi: topTeams.slice(0, 2).map((team) => team.name),
    worlds: topTeams.map((team) => team.name),
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Panel title="Championnat" subtitle={`Classement dynamique - ${activeLeague.name}`}>
        {isLec ? (
          <p className="mb-2 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-soft)]">
            Stage actif: <span className="font-semibold text-[var(--text-main)]">{stageLabel}</span>
          </p>
        ) : null}

        <table className="fm-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipe</th>
              <th>V</th>
              <th>D</th>
              <th>Points</th>
              <th>Power</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => (
              <tr key={team.name}>
                <td>{team.rank}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onOpenTeamRoster(activeLeague.id, team.name)}
                    className="rounded px-1 py-0.5 text-left text-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
                  >
                    {team.name}
                  </button>
                </td>
                <td>{team.wins}</td>
                <td>{team.losses}</td>
                <td>{team.points}</td>
                <td>{team.power}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="space-y-4">
        {isLec ? (
          <Panel title="Format LEC 2026" subtitle="LEC Versus + Printemps + Ete">
            <div className="space-y-2 text-sm text-[var(--text-soft)]">
              <p>LEC Versus: 12 equipes, BO1 round robin, top 8 en playoffs.</p>
              <p>Le vainqueur du LEC Versus se qualifie au First Stand.</p>
              <p>Printemps: BO3 round robin, top 2 qualifies au MSI.</p>
              <p>Ete: BO3 round robin, top 3 qualifies aux Worlds.</p>
              <p>Roadtrips LEC 2026: retour et extension des evenements live.</p>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-[var(--text-soft)] md:grid-cols-3">
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                LEC Versus: <span className="font-semibold text-[var(--text-main)]">{versusProgress.played}/{versusProgress.total}</span>
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                Printemps: <span className="font-semibold text-[var(--text-main)]">{springProgress.played}/{springProgress.total}</span>
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                Ete: <span className="font-semibold text-[var(--text-main)]">{summerProgress.played}/{summerProgress.total}</span>
              </p>
            </div>
          </Panel>
        ) : null}

        {isLec ? (
          <Panel title="Playoffs LEC Versus" subtitle="Simulation bracket double elimination">
            <div className="space-y-2 text-xs text-[var(--text-soft)]">
              <p className="uppercase tracking-[0.08em] text-[var(--text-muted)]">Upper Bracket R1 (BO3)</p>
              {versusBracket?.upperRound1?.map((match) => (
                <p key={match.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                  {match.teamA?.rank}. {match.teamA?.name} vs {match.teamB?.rank}. {match.teamB?.name} ({match.score}) -
                  {' '}
                  <span className="font-semibold text-[var(--text-main)]">Gagnant: {match.winner?.name}</span>
                </p>
              ))}

              <p className="pt-1 uppercase tracking-[0.08em] text-[var(--text-muted)]">Upper Bracket R2 (BO3)</p>
              {versusBracket?.upperRound2?.map((match) => (
                <p key={match.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                  {match.teamA?.name} vs {match.teamB?.name} ({match.score}) -
                  {' '}
                  <span className="font-semibold text-[var(--text-main)]">Gagnant: {match.winner?.name}</span>
                </p>
              ))}

              <p className="pt-1 uppercase tracking-[0.08em] text-[var(--text-muted)]">Lower Bracket R1/R2 (BO3)</p>
              {versusBracket?.lowerRound1?.map((match) => (
                <p key={match.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                  {match.teamA?.name} vs {match.teamB?.name} ({match.score}) -
                  {' '}
                  <span className="font-semibold text-[var(--text-main)]">Gagnant: {match.winner?.name}</span>
                </p>
              ))}
              {versusBracket?.lowerRound2?.map((match) => (
                <p key={match.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                  {match.teamA?.name} vs {match.teamB?.name} ({match.score}) -
                  {' '}
                  <span className="font-semibold text-[var(--text-main)]">Gagnant: {match.winner?.name}</span>
                </p>
              ))}

              <p className="pt-1 uppercase tracking-[0.08em] text-[var(--text-muted)]">Lower Finals (BO3/BO5)</p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                LB R3: {versusBracket?.lowerRound3?.teamA?.name} vs {versusBracket?.lowerRound3?.teamB?.name} ({versusBracket?.lowerRound3?.score})
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                LB Final: {versusBracket?.lowerFinal?.teamA?.name} vs {versusBracket?.lowerFinal?.teamB?.name} ({versusBracket?.lowerFinal?.score})
              </p>

              <p className="pt-1 uppercase tracking-[0.08em] text-[var(--text-muted)]">Finales (BO5)</p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5">
                UB Final: {versusBracket?.upperFinal?.teamA?.name} vs {versusBracket?.upperFinal?.teamB?.name} ({versusBracket?.upperFinal?.score})
              </p>
              <p className="rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] px-2 py-1.5">
                Grand Final simulee: {versusBracket?.grandFinal?.teamA?.name} vs {versusBracket?.grandFinal?.teamB?.name} ({versusBracket?.grandFinal?.score})
                {' '}
                <span className="font-semibold text-[var(--text-main)]">- Champion: {versusBracket?.champion?.name}</span>
              </p>
            </div>
          </Panel>
        ) : null}

        {isLec ? (
          <Panel title="Slots Internationaux" subtitle="Visualisation qualification 2026">
            <div className="space-y-2 text-sm text-[var(--text-soft)]">
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                First Stand (vainqueur LEC Versus): <span className="font-semibold text-[var(--text-main)]">{slots.firstStand}</span>
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                MSI (Top 2 Printemps):
                {' '}
                <span className="font-semibold text-[var(--text-main)]">{slots.msi.join(' / ') || 'A determiner'}</span>
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                Worlds (Top 3 Ete):
                {' '}
                <span className="font-semibold text-[var(--text-main)]">{slots.worlds.join(' / ') || 'A determiner'}</span>
              </p>
            </div>
          </Panel>
        ) : null}

        <Panel title="Profil de ligue" subtitle="Meta et economie">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>
              Region: <span className="font-semibold text-[var(--text-main)]">{activeLeague.region}</span>
            </p>
            <p>
              Prestige: <span className="font-semibold text-[var(--text-main)]">{'★'.repeat(activeLeague.prestige)}</span>
            </p>
            <p>
              Multiplicateur salaire: <span className="font-semibold text-[var(--text-main)]">x{activeLeague.salaryMultiplier}</span>
            </p>
            <p>
              Tier:
              {' '}
              <span className={`tier-badge ${activeLeague.tier === 1 ? 'tier-badge--t1' : 'tier-badge--t2'}`}>
                Tier {activeLeague.tier}
              </span>
            </p>
          </div>
        </Panel>

        <Panel title="Top contender" subtitle="Equipe la plus dangereuse">
          <p className="text-sm text-[var(--text-soft)]">
            {standings[0]?.name} domine actuellement {activeLeague.name} avec un indice de puissance de {standings[0]?.power}.
          </p>
          {standings[0] ? (
            <button
              type="button"
              onClick={() => onOpenTeamRoster(activeLeague.id, standings[0].name)}
              className="mt-2 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)]"
            >
              Voir l'effectif
            </button>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}

function MondePage({ worldRanking, onOpenTeamRoster }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
      <Panel title="Monde" subtitle="Top 10 power ranking toutes ligues">
        <table className="fm-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipe</th>
              <th>Ligue</th>
              <th>Tier</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {worldRanking.map((team) => (
              <tr key={`${team.leagueId}-${team.name}`}>
                <td>{team.rank}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onOpenTeamRoster(team.leagueId, team.name)}
                    className="rounded px-1 py-0.5 text-left text-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
                  >
                    {team.name}
                  </button>
                </td>
                <td>{team.leagueName}</td>
                <td>
                  <span className={`tier-badge ${team.tier === 1 ? 'tier-badge--t1' : 'tier-badge--t2'}`}>
                    Tier {team.tier}
                  </span>
                </td>
                <td>{team.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Lecture analyste" subtitle="Hierarchie mondiale">
        <p className="text-sm leading-6 text-[var(--text-soft)]">
          Les equipes Tier 1 restent structurellement devant via leur niveau mecanique moyen et leur rythme strategique. Cette vue sert de reference pour evaluer un transfert ou un objectif continental.
        </p>
      </Panel>
    </div>
  )
}

function SoloQEuropePage({ ranking, onOpenPlayerProfileFromLadder }) {
  const lecCount = ranking.filter((player) => player.leagueId === 'LEC').length
  const lflCount = ranking.filter((player) => player.leagueId === 'LFL').length
  const avgLp = ranking.length ? Math.round(ranking.reduce((sum, player) => sum + player.lp, 0) / ranking.length) : 0

  return (
    <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr]">
      <Panel title="SoloQ Europe" subtitle="Classement fusionne LEC + LFL">
        <table className="fm-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th>Role</th>
              <th>Equipe</th>
              <th>Ligue</th>
              <th>Rang SoloQ</th>
              <th>Trait</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player) => (
              <tr key={player.id}>
                <td>{player.rank}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => onOpenPlayerProfileFromLadder(player)}
                    className="rounded px-1 py-0.5 text-left text-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]"
                  >
                    {player.pseudo}
                  </button>
                </td>
                <td>{player.role}</td>
                <td>{player.teamId}</td>
                <td>{player.leagueId}</td>
                <td>{player.ladderLabel}</td>
                <td>
                  {player.confident ? (
                    <span className="rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-main)]">
                      Confident
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="space-y-4">
        <Panel title="Metrique Ladder" subtitle="Vue rapide">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>
              Joueurs scannes: <span className="font-semibold text-[var(--text-main)]">{ranking.length}</span>
            </p>
            <p>
              LEC: <span className="font-semibold text-[var(--text-main)]">{lecCount}</span>
            </p>
            <p>
              LFL: <span className="font-semibold text-[var(--text-main)]">{lflCount}</span>
            </p>
            <p>
              LP moyen: <span className="font-semibold text-[var(--text-main)]">{avgLp}</span>
            </p>
          </div>
        </Panel>

        <Panel title="Top 3" subtitle="Reference macro-meca">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            {ranking.slice(0, 3).map((player) => (
              <p key={`top-${player.id}`} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                #{player.rank} {player.pseudo} ({player.leagueId}) - {player.lp} LP
              </p>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function TactiquesPage({
  aggressivite,
  onChangeAggressivite,
  rythmeJeu,
  onChangeRythmeJeu,
  prioriteObjectifs,
  onChangePrioriteObjectifs,
  focusJoueur,
  onChangeFocusJoueur,
  onSaveTactique,
  saveMessage,
}) {
  const bonusGold15 = Math.round((aggressivite / 100) * 500)
  const risqueCounterPlay = Math.round(18 + (aggressivite / 100) * 62)
  const tempoScrims = rythmeJeu < 40 ? 'Controle' : rythmeJeu < 70 ? 'Cadence standard' : 'Haute intensite'
  const orientationObjectifs =
    prioriteObjectifs < 35 ? 'Priorite Dragons' : prioriteObjectifs < 65 ? 'Equilibre Dragons/Tours' : 'Priorite Tours'
  const joueurFocus = focusJunglerTargets.find((joueur) => joueur.joueur === focusJoueur)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <div className="space-y-4">
        <Panel title="Tactique" subtitle="Pilotage technique avant match">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <span>Agressivite</span>
                <span>{aggressivite}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                <span>Prudence</span>
                <span>Risque</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={aggressivite}
                onChange={(event) => onChangeAggressivite(Number(event.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <div className="mt-2 h-2 rounded bg-[var(--surface-3)]">
                <div
                  className="h-full rounded bg-[var(--accent)]"
                  style={{ width: `${aggressivite}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Plus l'agressivite est elevee, plus tu peux gagner du gold tot, mais le risque de counter-play augmente.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <span>Rythme de jeu</span>
                <span>{rythmeJeu}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                <span>Lent et controle</span>
                <span>Rapide et explosif</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={rythmeJeu}
                onChange={(event) => onChangeRythmeJeu(Number(event.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <div className="mt-2 h-2 rounded bg-[var(--surface-3)]">
                <div className="h-full rounded bg-[var(--accent)]" style={{ width: `${rythmeJeu}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <span>Priorite aux objectifs</span>
                <span>{prioriteObjectifs}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-soft)]">
                <span>Dragons</span>
                <span>Tours</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={prioriteObjectifs}
                onChange={(event) => onChangePrioriteObjectifs(Number(event.target.value))}
                className="w-full accent-[var(--accent)]"
              />
              <div className="mt-2 h-2 rounded bg-[var(--surface-3)]">
                <div className="h-full rounded bg-[var(--accent)]" style={{ width: `${prioriteObjectifs}%` }} />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Focus Jungler" subtitle="Joueur a aider en priorite">
          <div className="space-y-2">
            {focusJunglerTargets.map((cible) => (
              <button
                key={cible.joueur}
                type="button"
                onClick={() => onChangeFocusJoueur(cible.joueur)}
                className={`w-full rounded border px-3 py-2 text-left transition ${
                  focusJoueur === cible.joueur
                    ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-2)] hover:border-[var(--accent)]/60'
                }`}
              >
                <p className="font-heading text-lg uppercase tracking-[0.04em]">{cible.joueur}</p>
                <p className="text-xs text-[var(--text-soft)]">{cible.role}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Synthese tactique" subtitle="Lecture immediate des reglages">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>Agressivite: <span className="font-semibold text-[var(--text-main)]">{aggressivite}</span></p>
            <p>Rythme de jeu: <span className="font-semibold text-[var(--text-main)]">{tempoScrims}</span></p>
            <p>Priorite objectifs: <span className="font-semibold text-[var(--text-main)]">{orientationObjectifs}</span></p>
            <p>Focus jungler: <span className="font-semibold text-[var(--text-main)]">{joueurFocus?.joueur}</span></p>
            <p>Gain de gold estime @15: <span className="font-semibold text-[var(--text-main)]">+{bonusGold15}</span></p>
            <p>Risque de counter-play: <span className="font-semibold text-[var(--text-main)]">{risqueCounterPlay}%</span></p>
          </div>

          <button
            type="button"
            onClick={onSaveTactique}
            className="mt-4 w-full rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.2)] px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-main)] transition hover:bg-[color:rgba(200,170,110,0.32)]"
          >
            Sauvegarder la Tactique
          </button>
          {saveMessage ? <p className="mt-2 text-xs text-[var(--text-muted)]">{saveMessage}</p> : null}
        </Panel>
      </div>
    </div>
  )
}

function RapportAnalystePage({ aggressivite, rythmeJeu, prioriteObjectifs, focusJoueur }) {
  const pressionEarly = Math.round((aggressivite * 0.55) + (rythmeJeu * 0.35) + ((100 - prioriteObjectifs) * 0.1))
  const bonusFocusMid = focusJoueur === 'Miro' ? 18 : 6
  const scoreNoLuck = Math.round(
    (pressionEarly * 0.48) +
      (rapportAdversaire.faiblesses.earlyGame * 0.37) +
      (bonusFocusMid * 0.15),
  )
  const victoireMathematique =
    aggressivite >= 65 &&
    rythmeJeu >= 58 &&
    rapportAdversaire.faiblesses.earlyGame >= 70

  return (
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <div className="space-y-4">
        <Panel title="Rapport d'Analyste" subtitle={`Scouting pre-match - ${rapportAdversaire.equipe} (Patch ${rapportAdversaire.patch})`}>
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Faiblesse Early Game: <span className="font-semibold text-[var(--text-main)]">{rapportAdversaire.faiblesses.earlyGame}/100</span>
            </p>
            <p className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[var(--warn-text)]">
              Leur Midlaner a un score Mental faible: <span className="font-semibold">{rapportAdversaire.faiblesses.mentalMid}/100</span>. Le focus jungle mid est recommande.
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Vision de riviere insuffisante: <span className="font-semibold text-[var(--text-main)]">{rapportAdversaire.faiblesses.visionRiver}/100</span>
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
              Conversion des avantages instable: <span className="font-semibold text-[var(--text-main)]">{rapportAdversaire.faiblesses.conversionLead}/100</span>
            </p>
          </div>
        </Panel>

        <Panel title="Plan recommande" subtitle="Execution No Luck">
          <table className="fm-data-table">
            <thead>
              <tr>
                <th>Levier</th>
                <th>Valeur actuelle</th>
                <th>Lecture analyste</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Agressivite</td>
                <td>{aggressivite}</td>
                <td>{aggressivite >= 65 ? 'Exploit optimal de leur early faible' : 'Monter au-dessus de 65 recommande'}</td>
              </tr>
              <tr>
                <td>Rythme de jeu</td>
                <td>{rythmeJeu}</td>
                <td>{rythmeJeu >= 58 ? 'Tempo assez haut pour punir' : 'Accelerer le tempo early'}</td>
              </tr>
              <tr>
                <td>Focus Jungler</td>
                <td>{focusJoueur}</td>
                <td>{focusJoueur === 'Miro' ? 'Excellent: pression mentale sur le Mid adverse' : 'Focus Mid conseille pour casser leur mental'}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Moteur No Luck" subtitle="Avantage mathematique previsionnel">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>Pression early calculee: <span className="font-semibold text-[var(--text-main)]">{pressionEarly}</span></p>
            <p>Score No Luck: <span className="font-semibold text-[var(--text-main)]">{scoreNoLuck}</span></p>
            <p>
              Projection de victoire: <span className="font-semibold text-[var(--text-main)]">{Math.min(92, Math.max(42, scoreNoLuck))}%</span>
            </p>
          </div>

          <div className={`mt-3 rounded border px-3 py-2 text-sm ${
            victoireMathematique
              ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] text-[var(--text-main)]'
              : 'border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]'
          }`}>
            {victoireMathematique
              ? 'Signal fort: adversaire faible en early + tactique agressive. Victoire mathematique attendue si execution propre.'
              : 'Signal prudent: la combinaison actuelle n exploite pas encore pleinement les faiblesses early adverses.'}
          </div>
        </Panel>

        <Panel title="Action manager" subtitle="Avant le lancement du match">
          <p className="text-sm text-[var(--text-soft)]">
            Verifie que l agressivite reste elevee et que le jungler aide en priorite le Mid pour provoquer les erreurs mentales adverses.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function EntrainementPage({
  roster,
  activeLeague,
  activeTeamName,
  onApplyWeeklyResults,
  trainingPlan,
  onTrainingPlanChange,
}) {
  return (
    <TrainingView
      roster={roster}
      activeLeague={activeLeague}
      activeTeamName={activeTeamName}
      onApplyWeeklyResults={onApplyWeeklyResults}
      trainingPlan={trainingPlan}
      onTrainingPlanChange={onTrainingPlanChange}
    />
  )
}

function CalendrierPage({ currentDate, schedule, metaPatch, onResolveMatch, leagueTeamCalendars, activeTeamId }) {
  const todayKey = toDateKey(currentDate)
  const upcomingMatches = schedule.filter((match) => match.status === 'upcoming')
  const playedMatches = schedule.filter((match) => match.status === 'played')
  const rivalCalendars = (leagueTeamCalendars ?? []).filter((teamCalendar) => teamCalendar.teamId !== activeTeamId)
  const [selectedRivalTeamId, setSelectedRivalTeamId] = useState(null)
  const selectedRivalCalendar =
    rivalCalendars.find((teamCalendar) => teamCalendar.teamId === selectedRivalTeamId) ?? rivalCalendars[0] ?? null
  const selectedRivalSchedule = selectedRivalCalendar?.schedule ?? []
  const selectedRivalUpcoming = selectedRivalSchedule.filter((match) => match.status === 'upcoming').length
  const selectedRivalPlayed = selectedRivalSchedule.filter((match) => match.status === 'played').length

  return (
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <Panel title="Calendrier" subtitle="Matchs passes et a venir">
        <table className="fm-data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Segment</th>
              <th>Format</th>
              <th>Adversaire</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((match) => (
              <tr key={match.id}>
                <td>{formatDateLong(match.date)}</td>
                <td>{match.stage ?? 'Saison reguliere'}</td>
                <td>{match.seriesType ?? 'BO3'}</td>
                <td>vs {match.opponent}</td>
                <td>
                  {match.status === 'played' ? (
                    <span className="text-xs text-[var(--text-soft)]">Joue ({match.result})</span>
                  ) : match.dateKey === todayKey ? (
                    <span className="text-xs text-[var(--warn-text)]">Aujourd'hui - Match imminent</span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">A venir</span>
                  )}
                  {match.stake ? (
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{match.stake}</p>
                  ) : null}
                </td>
                <td>
                  {match.status === 'upcoming' && match.dateKey === todayKey ? (
                    <button
                      type="button"
                      onClick={() => onResolveMatch(match.id)}
                      className="rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.24)]"
                    >
                      Resoudre
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Alerte patch" subtitle="Impact strategie">
        <div className="space-y-2 text-sm text-[var(--text-soft)]">
          <p>
            Date actuelle: <span className="font-semibold text-[var(--text-main)]">{formatDateLong(currentDate)}</span>
          </p>
          <p>
            Patch meta actif: <span className="font-semibold text-[var(--text-main)]">{metaPatch}</span>
          </p>
          <p>
            Matchs joues: <span className="font-semibold text-[var(--text-main)]">{playedMatches.length}</span>
          </p>
          <p>
            Matchs a venir: <span className="font-semibold text-[var(--text-main)]">{upcomingMatches.length}</span>
          </p>
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <Panel title="Calendrier des autres equipes" subtitle="Suivi des rivaux de la ligue">
          {rivalCalendars.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Equipe suivie</span>
                <select
                  value={selectedRivalCalendar?.teamId ?? ''}
                  onChange={(event) => setSelectedRivalTeamId(event.target.value)}
                  className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-main)]"
                >
                  {rivalCalendars.map((teamCalendar) => (
                    <option key={teamCalendar.teamId} value={teamCalendar.teamId}>
                      {teamCalendar.teamName}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-[var(--text-soft)]">
                  Joues: <span className="font-semibold text-[var(--text-main)]">{selectedRivalPlayed}</span>
                  {'  '}
                  A venir: <span className="font-semibold text-[var(--text-main)]">{selectedRivalUpcoming}</span>
                </span>
              </div>

              <table className="fm-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Segment</th>
                    <th>Format</th>
                    <th>Adversaire</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRivalSchedule.map((match) => (
                    <tr key={match.id}>
                      <td>{formatDateLong(match.date)}</td>
                      <td>{match.stage ?? 'Saison reguliere'}</td>
                      <td>{match.seriesType ?? 'BO3'}</td>
                      <td>vs {match.opponent}</td>
                      <td>
                        {match.status === 'played' ? (
                          <span className="text-xs text-[var(--text-soft)]">Joue ({match.result})</span>
                        ) : match.dateKey === todayKey ? (
                          <span className="text-xs text-[var(--warn-text)]">Aujourd'hui - Match programme</span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">A venir</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-soft)]">Aucune autre equipe disponible sur cette ligue.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function MatchDayPage({
  match,
  synergy,
  draftBonus,
  approachOptions,
  selectedApproachId,
  onSelectApproach,
  opponentComfortPool,
  enemyBans,
  draftState,
  draftScoreCard,
  draftProjectedWinRate,
  flowStep,
  onPrevStep,
  onNextStep,
  onToggleDraftBan,
  onSelectDraftPick,
  onSwapDraftRoles,
  onStartLiveMatch,
  onOpenCalendar,
}) {
  const [swapFromRole, setSwapFromRole] = useState('Top')
  const [swapToRole, setSwapToRole] = useState('Jungle')
  const [pendingSwap, setPendingSwap] = useState(null)
  const [banSearch, setBanSearch] = useState('')
  const [banRoleFilter, setBanRoleFilter] = useState('ALL')
  const [pickSearch, setPickSearch] = useState('')

  if (!match) {
    return (
      <Panel title="Match Day" subtitle="Aucun match aujourd'hui">
        <p className="text-sm text-[var(--text-soft)]">
          Aucun match n est programme sur cette date. Tu peux continuer le temps ou verifier le calendrier.
        </p>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="mt-3 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)]"
        >
          Ouvrir le calendrier
        </button>
      </Panel>
    )
  }

  const selectedApproach = getMatchApproachById(selectedApproachId)
  const step = clamp(flowStep ?? 1, 1, MATCH_DAY_STEP_COUNT)
  const selectedBans = draftState?.bans ?? []
  const playerPicks = draftState?.playerPicks ?? {}
  const enemyPicks = draftState?.enemyPicks ?? {}
  const pickTurnIndex = draftState?.pickTurnIndex ?? 0
  const currentTurn = DRAFT_PICK_SEQUENCE[pickTurnIndex] ?? null
  const currentBlueRoles = currentTurn?.side === 'blue' ? currentTurn.roles : []
  const hasAllPicks = DRAFT_ROLES.every((role) => Boolean(playerPicks[role]))
  const isDraftOrderComplete = pickTurnIndex >= DRAFT_PICK_SEQUENCE.length && hasAllPicks
  const isSecondBanPhase = pickTurnIndex >= SECOND_BAN_TRIGGER_PICK_INDEX && !isDraftOrderComplete
  const requiredBanCount = isSecondBanPhase || isDraftOrderComplete ? MAX_DRAFT_BANS : FIRST_BAN_PHASE_COUNT
  const isBanPhaseLocked = selectedBans.length >= requiredBanCount
  const currentBanNumber = clamp(selectedBans.length + 1, 1, MAX_DRAFT_BANS)
  const currentBanTurnLabel = isBanPhaseLocked
    ? 'Phase de bans completee. Passe a l etape suivante.'
    : `Tour actuel: Blue ban ${currentBanNumber} / Red reponse ${currentBanNumber}`
  const isWaitingSecondBanPhase =
    pickTurnIndex >= SECOND_BAN_TRIGGER_PICK_INDEX &&
    pickTurnIndex < DRAFT_PICK_SEQUENCE.length &&
    selectedBans.length < MAX_DRAFT_BANS
  const draftTurnLabel =
    currentTurn
      ? `${currentTurn.side === 'blue' ? 'Blue' : 'Red'} pick ${currentTurn.roles.join(' + ')}`
      : 'Draft verrouillee - phase de swap active'
  const comfortChampionIds = new Set((opponentComfortPool ?? []).map((entry) => entry.championId))
  const normalizedBanSearch = banSearch.trim().toLowerCase()
  const normalizedPickSearch = pickSearch.trim().toLowerCase()
  const enemyDraftBanKeys = (enemyBans?.length ? enemyBans : (match.draftState?.bans?.enemy ?? []))
    .map((entry) => (typeof entry === 'string' ? entry : entry?.key))
    .filter(Boolean)
  const seen = new Set()

  const uniqueChampionOptions = CHAMPIONS_DB.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    })

  const allChampionBanOptions = uniqueChampionOptions
    .filter((champion) => {
      if (banRoleFilter !== 'ALL' && champion.role !== banRoleFilter) {
        return false
      }

      if (!normalizedBanSearch) {
        return true
      }

      const haystack = `${champion.name} ${champion.id} ${champion.role} ${(champion.tags ?? []).join(' ')}`.toLowerCase()
      return haystack.includes(normalizedBanSearch)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const allChampionPickOptions = uniqueChampionOptions
    .filter((champion) => {
      if (!normalizedPickSearch) {
        return true
      }

      const haystack = `${champion.name} ${champion.id} ${champion.role} ${(champion.tags ?? []).join(' ')}`.toLowerCase()
      return haystack.includes(normalizedPickSearch)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const canGoNext =
    step === 1
      ? Boolean(selectedApproach)
      : step === 2
        ? selectedBans.length >= requiredBanCount
        : step === 3
          ? (isDraftOrderComplete || isWaitingSecondBanPhase)
          : false
  const nextBluePickRole = currentBlueRoles.find((role) => !playerPicks[role]) ?? currentBlueRoles[0] ?? null

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col bg-[#050505] text-white">
        {/* Top Banner */}
        <div className="flex min-h-[90px] shrink-0 items-center justify-between border-b border-gray-800 bg-[#0a0a0c] px-6 py-2 shadow-md z-20">
          <div className="flex flex-1 items-center gap-6">
            <div className="text-2xl font-bold uppercase tracking-wider text-blue-400">{match.player_team}</div>
            {(step === 2 || step === 3 || step === 4) && (
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const banKey = selectedBans[i]
                  const champ = CHAMPIONS_DB.find(c => toChampionKey(c) === banKey)
                  const img = champ ? getChampionImageUrl(champ) : null
                  return (
                    <div key={'bb'+i} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-gray-700 bg-gray-900 border-b-2 border-b-blue-500">
                      {img ? (
                        <div className="relative h-full w-full">
                          <img src={img} className="h-full w-full object-cover grayscale brightness-50" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-[2px] w-full rotate-45 bg-[#c8aa6e]"></div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="text-xl font-bold tracking-[0.1em] text-white">
              {step === 1 ? 'PRE-MATCH BRIEFING' : step === 4 ? 'VERROUILLAGE ROSTER' : 'PHASE DE DRAFT'}
            </div>
            {step === 2 || step === 3 ? (
              <div className="text-[12px] uppercase tracking-widest text-[#c8aa6e] bg-[#1e1e1e] border border-[#c8aa6e]/30 px-4 py-1 rounded-full mt-1">
                {step === 2 ? 'PHASE DE BANS' : 'PHASE DE PICKS'}
              </div>
            ) : null}
            {step === 2 || step === 3 ? (
              <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">
                {step === 2 ? currentBanTurnLabel : draftTurnLabel}
              </div>
            ) : null}
            {isWaitingSecondBanPhase ? (
               <div className="text-[10px] uppercase tracking-wider text-amber-400">Attente de la 2eme phase de bans</div>
            ) : null}
            {step === 1 && (
               <div className="mt-1 text-[10px] uppercase tracking-wider text-[#c8aa6e]">
                 {match.stage ?? 'Saison reguliere'} - {match.seriesType ?? 'BO3'}
               </div>
            )}
          </div>

          <div className="flex flex-1 items-center justify-end gap-6">
            {(step === 2 || step === 3 || step === 4) && (
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const banKey = enemyDraftBanKeys[i]
                  const champ = CHAMPIONS_DB.find(c => toChampionKey(c) === banKey)
                  const img = champ ? getChampionImageUrl(champ) : null
                  return (
                    <div key={'rb'+i} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-gray-700 bg-gray-900 border-b-2 border-b-red-600">
                      {img ? (
                        <div className="relative h-full w-full">
                          <img src={img} className="h-full w-full object-cover grayscale brightness-50" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-[2px] w-full -rotate-45 bg-[#c8aa6e]"></div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="text-2xl font-bold uppercase tracking-wider text-red-500">{match.opponent}</div>
          </div>
        </div>

        {/* Step 1: Briefing */}
        {step === 1 ? (
          <div className="relative flex flex-1 overflow-hidden bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Azir_0.jpg')] bg-cover bg-center before:absolute before:inset-0 before:bg-black/95">
             <div className="relative z-10 flex w-full flex-col items-center justify-center p-8 overflow-y-auto">
                
                <div className="flex w-full max-w-5xl gap-8 flex-col md:flex-row">
                  {/* Left Column: Match Info */}
                  <div className="flex flex-1 flex-col gap-6">
                     <div className="rounded-xl border border-gray-800 bg-black/80 p-6 shadow-2xl backdrop-blur-md">
                        <h2 className="text-2xl font-black uppercase tracking-widest text-[#c8aa6e] mb-4">LE CHOC DU JOUR</h2>
                        <div className="flex items-center justify-center gap-8 py-6">
                           <div className="text-4xl font-black text-blue-400">{match.player_team}</div>
                           <div className="text-2xl font-black text-gray-500">VS</div>
                           <div className="text-4xl font-black text-red-500">{match.opponent}</div>
                        </div>
                        {match.stake && (
                          <div className="text-center text-sm font-bold uppercase tracking-widest text-amber-500">Enjeu: {match.stake}</div>
                        )}
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-800 bg-black/80 p-5 backdrop-blur-md">
                           <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Synergie equipe</div>
                           <div className="text-3xl font-black text-white">{synergy}%</div>
                        </div>
                        <div className="rounded-xl border border-gray-800 bg-black/80 p-5 backdrop-blur-md">
                           <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Bonus draft initial</div>
                           <div className="text-3xl font-black text-[#c8aa6e]">+{draftBonus}</div>
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Strategy Selection */}
                  <div className="flex flex-1 flex-col rounded-xl border border-gray-800 bg-black/80 p-6 shadow-2xl backdrop-blur-md">
                     <h2 className="text-lg font-black uppercase tracking-widest text-[#c8aa6e] mb-4">PLAN DE JEU COACH</h2>
                     
                     <div className="flex flex-col gap-3">
                        {approachOptions.map((approach) => {
                          const isSelected = selectedApproach.id === approach.id
                          return (
                            <button
                              key={approach.id}
                              type="button"
                              onClick={() => onSelectApproach(approach.id)}
                              className={`group relative overflow-hidden rounded border px-4 py-4 text-left transition-all ${
                                isSelected
                                  ? 'border-[#c8aa6e] bg-[#c8aa6e]/10'
                                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-500'
                              }`}
                            >
                              {isSelected && <div className="absolute left-0 top-0 h-full w-1 bg-[#c8aa6e]"></div>}
                              <div className="text-base font-bold text-white group-hover:text-[#c8aa6e] uppercase tracking-wider">{approach.label}</div>
                              <div className="mt-1 text-xs text-gray-400">{approach.summary}</div>
                            </button>
                          )
                        })}
                     </div>

                     <div className="mt-auto pt-6 flex justify-end">
                       <button
                         type="button"
                         onClick={onNextStep}
                         className="rounded bg-[#c8aa6e] px-8 py-3 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_15px_rgba(200,170,110,0.4)] transition hover:bg-[#d4b982] hover:shadow-[0_0_25px_rgba(200,170,110,0.6)]"
                       >
                         ENTRER DANS LA DRAFT
                       </button>
                     </div>
                  </div>
                </div>
             </div>
          </div>
        ) : null}

        {/* Step 2 & 3: Draft Arena */}
        {(step === 2 || step === 3) ? (
          <div className="relative flex flex-1 flex-col overflow-hidden bg-[#060b19]">
                
                {/* Top Center / Champion Pick Grid */}
                <div className="relative z-10 flex flex-1 flex-col items-center p-4">
                   <div className="flex w-full xl:w-[95%] max-w-[1400px] flex-col gap-2 p-2">
                     
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-bold uppercase tracking-widest text-[#c8aa6e]">
                        {step === 2 ? 'Phase de Bannissement' : (currentBlueRoles.length > 0 ? `À vous ! (${currentBlueRoles.join(', ')})` : '')}
                       </span>
                       <div className="flex gap-3">
                         <button type="button" onClick={onPrevStep} className="text-xs uppercase text-gray-400 hover:text-white transition-colors">Retour</button>
                         <button
                           type="button"
                           onClick={onNextStep}
                           disabled={!canGoNext}
                           className={`rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${canGoNext ? 'bg-[#c8aa6e] text-black shadow-[0_0_10px_rgba(200,170,110,0.5)] hover:bg-[#d4b982]' : 'cursor-not-allowed bg-gray-800 text-gray-500'}`}
                         >
                            {step === 3 && isWaitingSecondBanPhase ? 'Passer aux bans 2' : 'Valider la phase'}
                         </button>
                       </div>
                     </div>

                     {step === 3 && nextBluePickRole ? (
                       <div className="text-[10px] uppercase tracking-[0.08em] text-gray-300">
                         Role a lock maintenant: <span className="font-semibold text-[#c8aa6e]">{nextBluePickRole}</span>
                       </div>
                     ) : null}

                     <div className="flex flex-wrap items-center gap-2">
                       {step === 2 ? (
                         <select
                           value={banRoleFilter}
                           onChange={(event) => setBanRoleFilter(event.target.value)}
                           className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs uppercase tracking-wider text-gray-200"
                         >
                           <option value="ALL">Tous les roles</option>
                           {DRAFT_ROLES.map((role) => (
                             <option key={`filter-${role}`} value={role}>{role}</option>
                           ))}
                         </select>
                       ) : null}
                       <input
                         type="text"
                         value={step === 2 ? banSearch : pickSearch}
                         onChange={(event) => {
                           if (step === 2) {
                             setBanSearch(event.target.value)
                           } else {
                             setPickSearch(event.target.value)
                           }
                         }}
                         placeholder={step === 2 ? 'Rechercher un ban...' : 'Rechercher un pick...'}
                         className="min-w-[220px] flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 placeholder:text-gray-500"
                       />
                     </div>
                     
                     <div className="h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                       <div className="grid grid-cols-12 sm:grid-cols-14 md:grid-cols-16 xl:grid-cols-20 gap-1.5 md:gap-2">
                         {(step === 2 ? allChampionBanOptions : allChampionPickOptions).map(champion => {
                           const img = getChampionImageUrl(champion)
                           const isComfort = comfortChampionIds.has(champion.id)
                           
                           const isBanned = selectedBans.includes(toChampionKey(champion)) || enemyDraftBanKeys.includes(toChampionKey(champion))
                           const isPicked = Object.values(playerPicks).includes(toChampionKey(champion)) || Object.values(enemyPicks).includes(toChampionKey(champion))
                           const isLocked = isBanned || isPicked

                           return (
                             <button 
                               key={'opt-'+toChampionKey(champion)} 
                               disabled={isLocked && step === 3}
                               onClick={() => {
                                 if (step === 2) {
                                   if (selectedBans.includes(toChampionKey(champion))) {
                                     onToggleDraftBan(match.id, toChampionKey(champion))
                                   } else if (selectedBans.length < requiredBanCount) {
                                     onToggleDraftBan(match.id, toChampionKey(champion))
                                   }
                                 }
                                 if (step === 3 && nextBluePickRole) {
                                   onSelectDraftPick(match.id, nextBluePickRole, toChampionKey(champion))
                                 }
                               }}
                               className={`group relative aspect-square overflow-hidden rounded border transition-all ${isLocked ? 'border-red-900/50 opacity-20 grayscale' : 'border-gray-700 hover:border-[#c8aa6e] hover:scale-105'}`}
                             >
                               {img ? <img src={img} className="absolute inset-0 h-full w-full object-cover" /> : null}
                               {isComfort ? <div className="absolute left-0.5 top-0.5 rounded bg-amber-500/85 px-1 py-0.5 text-[7px] xl:text-[8px] font-black uppercase text-black z-10">C</div> : null}
                               <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-center text-[7px] xl:text-[9px] font-bold text-white group-hover:text-[#c8aa6e] truncate">{champion.name}</div>
                             </button>
                           )
                         })}
                       </div>
                     </div>
                   </div>
                </div>

                {/* Bottom Horizontal Roster Bar */}
                <div className="relative z-20 flex h-[280px] w-full bg-black border-t-2 border-[#1a1a1a] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
                  
                  {/* Left Side (Blue) */}
                  <div className="flex flex-1">
                    {DRAFT_ROLES.map(role => {
                      const champKey = playerPicks[role]
                      const champ = CHAMPIONS_DB.find(c => toChampionKey(c) === champKey)
                      const isPickingRow = step === 3 && currentBlueRoles.includes(role)
                      return (
                        <div key={'blue-'+role} className={`relative flex flex-1 flex-col overflow-hidden border-r border-[#1a1a1a] bg-[#0a0a0c] ${isPickingRow ? 'border-t-4 border-t-[#00ffcc] animate-pulse duration-1000' : 'border-t-4 border-t-transparent'}`}>
                           {champ ? (
                             <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${CHAMPION_IMAGE_ID_OVERRIDES[champ.id] ?? champ.id}_0.jpg`} className="absolute inset-0 h-full w-full object-cover object-center opacity-80 mix-blend-screen" />
                           ) : null}
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                           <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/10 to-transparent w-[30%]" />
                           
                           {/* Normal Champion name at bottom */}
                           <div className="absolute left-0 right-0 bottom-4 text-center text-[10px] md:text-sm font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                             {champ ? champ.name : ''}
                           </div>

                           {/* Rotated Role Text aligned strictly to left */}
                           <div className="absolute left-1 top-4 bottom-4 flex items-center justify-center w-6">
                             <div className="-rotate-90 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#00ffcc] drop-shadow-[0_2px_2px_rgba(0,0,0,1)] whitespace-nowrap">
                               {role}
                             </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Center Panel (Logos & Match Info) */}
                  <div className="flex w-[200px] xl:w-[260px] flex-col items-center justify-center border-x border-[#1a1a1a] bg-[#050505] p-4 relative z-30">
                     <div className="text-xs font-bold text-gray-500 mb-6 uppercase tracking-widest">PATCH 26.3</div>
                     <div className="flex w-full items-center justify-center gap-6">
                       <div className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{(match?.player_team || '???').substring(0, 3).toUpperCase()}</div>
                       <img src="https://lol.fandom.com/load.php?lang=en&ext=fandom&mw=1&url=https%3A%2F%2Fgamepedia.cursecdn.com%2Flolesports_gamepedia_en%2Fa%2Fa5%2FVS_Icon.png%3Fversion%3D307dc5fc1b6f00ab39bcf72c3b88d8b6" className="h-8 opacity-50" onError={(e) => e.target.style.display='none'} alt="VS"/>
                       <div className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{(match?.opponent || '???').substring(0, 3).toUpperCase()}</div>
                     </div>
                  </div>

                  {/* Right Side (Red) */}
                  <div className="flex flex-1">
                    {DRAFT_ROLES.map(role => {
                      const champKey = enemyPicks[role]
                      const champ = CHAMPIONS_DB.find(c => toChampionKey(c) === champKey)
                      return (
                        <div key={'red-'+role} className="relative flex flex-1 flex-col overflow-hidden border-l border-[#1a1a1a] bg-[#0a0a0c] border-t-4 border-t-transparent">
                           {champ ? (
                             <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${CHAMPION_IMAGE_ID_OVERRIDES[champ.id] ?? champ.id}_0.jpg`} className="absolute inset-0 h-full w-full object-cover object-center opacity-80 scale-x-[-1] mix-blend-screen" />
                           ) : null}
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                           <div className="absolute top-0 right-0 bottom-0 bg-gradient-to-l from-black/90 via-black/10 to-transparent w-[30%]" />
                           
                           {/* Normal Champion name at bottom */}
                           <div className="absolute left-0 right-0 bottom-4 text-center text-[10px] md:text-sm font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                             {champ ? champ.name : ''}
                           </div>

                           {/* Rotated Role Text aligned strictly to right */}
                           <div className="absolute right-1 top-4 bottom-4 flex items-center justify-center w-6">
                             <div className="rotate-90 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#ff3333] drop-shadow-[0_2px_2px_rgba(0,0,0,1)] whitespace-nowrap">
                               {role}
                             </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
          </div>
        ) : null}

        {/* Step 4: Swap & Lock-in */}
        {step === 4 ? (
          <div className="relative flex flex-1 overflow-hidden bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Pantheon_0.jpg')] bg-cover bg-center before:absolute before:inset-0 before:bg-black/95">
             <div className="relative z-10 flex w-full flex-col items-center justify-center p-8 overflow-y-auto">
                <div className="flex w-full max-w-7xl flex-col gap-6">
                   <div className="text-center">
                      <h2 className="text-3xl font-black uppercase tracking-widest text-white drop-shadow-lg">COMPOSITION VERROUILLÉE</h2>
                      <div className="mt-2 text-sm font-bold uppercase tracking-wider text-[#c8aa6e]">Ajustement Final (Swap)</div>
                   </div>

                   {/* Roster Showcase */}
                   <div className="flex justify-center gap-4 mt-4 flex-wrap pb-4">
                      {DRAFT_ROLES.map(role => {
                        const champKey = playerPicks[role]
                        const champ = CHAMPIONS_DB.find(c => toChampionKey(c) === champKey)
                        return (
                          <div key={'final-blue-'+role} className="relative flex h-[35vh] w-[180px] flex-col justify-end overflow-hidden rounded-lg border-2 border-blue-900/50 bg-gray-900 shadow-2xl">
                             {champ ? (
                               <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${CHAMPION_IMAGE_ID_OVERRIDES[champ.id] ?? champ.id}_0.jpg`} className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-1000 hover:scale-105" />
                             ) : null}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/100 via-black/40 to-transparent" />
                             <div className="relative z-10 p-4 text-center">
                               <div className="text-xs font-black uppercase tracking-widest text-[#c8aa6e]">{role}</div>
                               <div className="text-xl font-black text-white drop-shadow-md">{champ ? champ.name : '?'}</div>
                             </div>
                          </div>
                        )
                      })}
                   </div>

                   {/* Stats & Swap Panel */}
                   <div className="mt-2 flex gap-6 justify-center flex-wrap">
                      <div className="flex w-[400px] flex-col rounded-xl border border-gray-800 bg-black/80 p-5 backdrop-blur-md">
                         <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#c8aa6e] text-center">PROJECTIONS</div>
                         <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-3">
                            <span className="text-sm text-gray-400">Score Draft:</span>
                            <span className="text-lg font-black text-white">{draftScoreCard.score >= 0 ? '+' : ''}{draftScoreCard.score}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-3">
                            <span className="text-sm text-gray-400">Plan selectionne:</span>
                            <span className="text-sm font-bold text-white text-right max-w-[200px] truncate">{selectedApproach.label}</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Win Rate Estime:</span>
                            <span className="text-2xl font-black text-green-400">{draftProjectedWinRate}%</span>
                         </div>
                      </div>

                      <div className="flex flex-1 max-w-[500px] flex-col rounded-xl border border-gray-800 bg-black/80 p-5 backdrop-blur-md">
                         <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[#c8aa6e] text-center">SWAP JOUEURS</div>
                         <div className="flex gap-4 items-end justify-center mt-2">
                            <div className="flex flex-col gap-1 w-[120px]">
                               <label className="text-[10px] uppercase text-gray-500">De</label>
                               <select
                                 value={swapFromRole}
                                 onChange={(event) => setSwapFromRole(event.target.value)}
                                 className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-bold text-white"
                               >
                                 {DRAFT_ROLES.map((role) => (
                                   <option key={`from-${role}`} value={role}>{role}</option>
                                 ))}
                               </select>
                            </div>
                            <div className="pb-2 text-gray-500">↔</div>
                            <div className="flex flex-col gap-1 w-[120px]">
                               <label className="text-[10px] uppercase text-gray-500">Vers</label>
                               <select
                                 value={swapToRole}
                                 onChange={(event) => setSwapToRole(event.target.value)}
                                 className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-bold text-white"
                               >
                                 {DRAFT_ROLES.map((role) => (
                                   <option key={`to-${role}`} value={role}>{role}</option>
                                 ))}
                               </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                 if (swapFromRole === swapToRole) return
                                 setPendingSwap({ fromRole: swapFromRole, toRole: swapToRole })
                              }}
                              className="rounded bg-gray-800 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-gray-700 h-[38px] transition-colors cursor-pointer"
                            >
                              Proposer
                            </button>
                         </div>

                         {pendingSwap && (
                           <div className="mt-4 flex flex-col items-center rounded bg-gray-900/50 p-3 border border-gray-700/50">
                              <div className="text-xs text-amber-400 mb-2 font-semibold">Demande d'echange: {pendingSwap.fromRole} vers {pendingSwap.toRole}</div>
                              <div className="flex gap-3">
                                 <button
                                   onClick={() => {
                                     const accepted = onSwapDraftRoles(match.id, pendingSwap.fromRole, pendingSwap.toRole)
                                     if (accepted) setPendingSwap(null)
                                   }}
                                   className="rounded bg-green-900/40 border border-green-500/50 px-4 py-1 text-xs font-bold text-green-400 hover:bg-green-800/60 cursor-pointer"
                                 >
                                   Confirmer ✅
                                 </button>
                                 <button
                                   onClick={() => setPendingSwap(null)}
                                   className="rounded bg-red-900/40 border border-red-500/50 px-4 py-1 text-xs font-bold text-red-400 hover:bg-red-800/60 cursor-pointer"
                                 >
                                   Annuler ❌
                                 </button>
                              </div>
                           </div>
                         )}

                         <div className="mt-auto pt-6 flex flex-col justify-end items-center gap-4">
                           <button
                             type="button"
                             onClick={() => onStartLiveMatch(match.id)}
                             className="rounded bg-red-600 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] transition hover:bg-red-500 hover:shadow-[0_0_25px_rgba(220,38,38,0.8)] w-full"
                           >
                             LANCER LE MATCH EN DIRECT
                           </button>
                           <button
                             type="button"
                             onClick={onPrevStep}
                             className="text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:text-white"
                           >
                             RETOUR A LA DRAFT
                           </button>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        ) : null}
      </div>
  )

}

function MatchLivePage({
  liveSession,
  onAdvance,
  onSkip,
  onFinish,
  onResolveDecision,
}) {
  const LIVE_SPEED_BASE_DELAY_MS = 2600

  const ROLE_FARM_PER_MINUTE = {
    Top: 7,
    Jungle: 6,
    Mid: 8,
    ADC: 8.5,
    Support: 2,
  }

  const ROLE_ITEM_POOLS = {
    Top: ['Black Cleaver', 'Shojin', 'Sterak', 'Death Dance', 'Maw', 'GA'],
    Jungle: ['Sundered Sky', 'Titanic', 'Sterak', 'JakSho', 'GA', 'Maw'],
    Mid: ['Ludens', 'Shadowflame', 'Zhonyas', 'Rabadon', 'Void Staff', 'Banshee'],
    ADC: ['Infinity Edge', 'Rapid Firecannon', 'LDR', 'BT', 'GA', 'Mercurial'],
    Support: ['Solstice Sleigh', 'Locket', 'Mikaels', 'Redemption', 'Shurelya', 'Wardstone'],
  }

  const [autoSpeedMultiplier, setAutoSpeedMultiplier] = useState(1)
  const [isAutoPaused, setIsAutoPaused] = useState(false)

  const maxIndex = liveSession ? liveSession.timeline.length - 1 : 0
  const currentIndex = liveSession ? clamp(liveSession.currentEventIndex, 0, maxIndex) : 0
  const currentEvent = liveSession ? liveSession.timeline[currentIndex] : null
  const eventsShown = liveSession ? liveSession.timeline.slice(0, currentIndex + 1) : []
  const recentComments = eventsShown.slice(-4).reverse()
  const decisionAdjustments = liveSession?.decisionAdjustments ?? {}
  const pendingDecision =
    currentEvent?.decision && !decisionAdjustments[currentEvent.decision.id] ? currentEvent.decision : null
  const totalDecisionReward = Object.values(decisionAdjustments).reduce((sum, entry) => sum + (entry?.reward ?? 0), 0)
  const baseScoreboard = currentEvent?.scoreboard ?? liveSession?.finalScoreboard ?? {
    team: { kills: 0, gold: 0, towers: 0, dragons: 0 },
    enemy: { kills: 0, gold: 0, towers: 0, dragons: 0 },
  }
  const scoreboard = {
    team: {
      ...baseScoreboard.team,
      gold: baseScoreboard.team.gold + Math.max(0, totalDecisionReward),
    },
    enemy: {
      ...baseScoreboard.enemy,
      gold: baseScoreboard.enemy.gold + Math.max(0, -totalDecisionReward),
    },
  }
  const liveMinute = currentEvent?.minute ?? 0
  const progressionRatio = clamp(liveMinute / 30, 0, 1)
  const isFinished = liveSession ? currentIndex >= maxIndex : false
  const autoAdvanceDelayMs = Math.max(500, Math.round(LIVE_SPEED_BASE_DELAY_MS / autoSpeedMultiplier))

  const deriveKillEvent = (event) => {
    if (!event || Math.abs(event.deltaGold ?? 0) < 350) {
      return null
    }

    const winnerSide = (event.deltaGold ?? 0) >= 0 ? 'team' : 'enemy'
    const loserSide = winnerSide === 'team' ? 'enemy' : 'team'
    const killerRole = DRAFT_ROLES[stableHash(`${event.minute}-killer`) % DRAFT_ROLES.length]
    let victimRole = DRAFT_ROLES[stableHash(`${event.minute}-victim`) % DRAFT_ROLES.length]

    if (victimRole === killerRole) {
      victimRole = DRAFT_ROLES[(DRAFT_ROLES.indexOf(victimRole) + 1) % DRAFT_ROLES.length]
    }

    return {
      winnerSide,
      loserSide,
      killerRole,
      victimRole,
    }
  }

  const buildLiveItems = (role, seedKey, minute) => {
    const pool = ROLE_ITEM_POOLS[role] ?? []
    if (!pool.length) {
      return []
    }

    const itemCount = clamp(Math.floor(minute / 5), 0, 6)
    if (itemCount <= 0) {
      return []
    }

    const startIndex = stableHash(`${seedKey}-${role}-items`) % pool.length
    const picked = []

    for (let i = 0; i < itemCount; i += 1) {
      picked.push(pool[(startIndex + i) % pool.length])
    }

    return picked
  }

  const buildLiveRowsBySide = (side) => {
    const sourceRows = side === 'team' ? (liveSession?.teamRows ?? []) : (liveSession?.enemyRows ?? [])
    const picksByRole = side === 'team'
      ? (liveSession?.draftState?.playerPicks ?? {})
      : (liveSession?.draftState?.enemyPicks ?? {})

    const rowsByRole = sourceRows.reduce((acc, row) => {
      acc[row.role] = row
      return acc
    }, {})

    return DRAFT_ROLES.map((role) => {
      const row = rowsByRole[role] ?? { playerName: role, kills: 0, deaths: 0, assists: 0 }
      const champion = getChampionByKey(picksByRole[role])
      const farmBase = ROLE_FARM_PER_MINUTE[role] ?? 6
      const farmJitter = (stableHash(`${side}-${row.playerName}-${role}-${liveMinute}-farm`) % 19) - 9
      const farm = Math.max(0, Math.round((farmBase * liveMinute) + farmJitter))

      return {
        role,
        playerName: row.playerName,
        championName: champion?.name ?? 'Non lock',
        kills: Math.min(row.kills ?? 0, Math.round((row.kills ?? 0) * progressionRatio)),
        farm,
        items: buildLiveItems(role, `${side}-${row.playerName}`, liveMinute),
      }
    })
  }

  const teamLiveRows = buildLiveRowsBySide('team')
  const enemyLiveRows = buildLiveRowsBySide('enemy')

  const findLiveRowByRole = (rows, role) => rows.find((row) => row.role === role)

  const killEvent = deriveKillEvent(currentEvent)
  const killAnnouncement = killEvent
    ? (() => {
        const killerRows = killEvent.winnerSide === 'team' ? teamLiveRows : enemyLiveRows
        const victimRows = killEvent.loserSide === 'team' ? teamLiveRows : enemyLiveRows
        const killer = findLiveRowByRole(killerRows, killEvent.killerRole)
        const victim = findLiveRowByRole(victimRows, killEvent.victimRole)

        if (!killer || !victim) {
          return null
        }

        return {
          winnerSide: killEvent.winnerSide,
          killerName: killer.playerName,
          killerChampion: killer.championName,
          victimName: victim.playerName,
          victimChampion: victim.championName,
        }
      })()
    : null

  useEffect(() => {
    if (!liveSession || isAutoPaused || pendingDecision) {
      return undefined
    }

    if (isFinished) {
      const finishTimeoutId = setTimeout(() => {
        onFinish()
      }, 900)

      return () => {
        clearTimeout(finishTimeoutId)
      }
    }

    const advanceTimeoutId = setTimeout(() => {
      onAdvance()
    }, autoAdvanceDelayMs)

    return () => {
      clearTimeout(advanceTimeoutId)
    }
  }, [liveSession, isFinished, onAdvance, onFinish, isAutoPaused, autoAdvanceDelayMs, pendingDecision])

  if (!liveSession) {
    return (
      <Panel title="Live Match" subtitle="Aucune simulation active">
        <p className="text-sm text-[var(--text-soft)]">Lance un match depuis l ecran Match Day.</p>
      </Panel>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col bg-[#d9d9d9] text-[#1f2937]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black/35 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border-2 border-black/70 bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]">
            {liveSession.teamName}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#1d4ed8]">
            {scoreboard.team.kills} K · {scoreboard.team.towers} T · {scoreboard.team.dragons} D
          </span>
          <span className="text-xs font-mono text-[#475569]">{(scoreboard.team.gold / 1000).toFixed(1)}k</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="text-xl font-black tracking-[0.15em]">{String(liveMinute).padStart(2, '0')}:00</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4b5563]">
            {isFinished ? 'Fin de match' : isAutoPaused ? 'Pause' : 'Live'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#475569]">{(scoreboard.enemy.gold / 1000).toFixed(1)}k</span>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#b91c1c]">
            {scoreboard.enemy.kills} K · {scoreboard.enemy.towers} T · {scoreboard.enemy.dragons} D
          </span>
          <span className="rounded-lg border-2 border-black/70 bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]">
            {liveSession.opponentName}
          </span>
        </div>
      </div>

      {killAnnouncement ? (
        <div className="px-5 pt-3">
          <div className={`mx-auto flex w-fit items-center gap-2 rounded-lg border-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${killAnnouncement.winnerSide === 'team' ? 'border-[#1d4ed8]/50 bg-[#dbeafe]' : 'border-[#b91c1c]/50 bg-[#fee2e2]'}`}>
            <span>Kill</span>
            <span>{killAnnouncement.killerName}</span>
            <span>{'>'}</span>
            <span>{killAnnouncement.victimName}</span>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-5 px-5 py-5 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="mx-auto h-12 w-12 rotate-45 rounded-xl border-2 border-black/75 bg-white/75" />
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {teamLiveRows.map((row) => (
              <div key={`blue-${row.role}`} className="rounded-2xl border-2 border-black/70 bg-white/85 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1d4ed8]">{row.role}</p>
                <p className="mt-1 truncate text-sm font-bold text-[#111827]">{row.playerName}</p>
                <p className="truncate text-xs text-[#374151]">{row.championName}</p>
                <p className="mt-1 text-[11px] font-mono text-[#4b5563]">{row.kills}K · {row.farm}CS</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-0 border-x-2 border-black/70 px-4">
          <div className="mx-auto flex h-full max-w-[920px] flex-col items-center justify-center gap-4">
            <div className="w-full max-w-[860px]">
              <MatchMap
                liveSession={liveSession}
                currentIndex={currentIndex}
                aggressivite={58}
                variant="wireframe2d"
              />
            </div>

            <div className="w-full max-w-[860px] rounded-xl border-2 border-black/70 bg-white/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#374151]">Play by Play</span>
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  {!isFinished ? (
                    <>
                      {[1, 2, 4].map((s) => (
                        <button
                          key={`speed-${s}`}
                          type="button"
                          onClick={() => setAutoSpeedMultiplier(s)}
                          className={`rounded border px-2 py-0.5 ${autoSpeedMultiplier === s ? 'border-black/70 bg-black text-white' : 'border-black/40 bg-white text-[#374151]'}`}
                        >
                          x{s}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsAutoPaused(!isAutoPaused)}
                        className="rounded border border-black/40 bg-white px-2 py-0.5 text-[#374151]"
                      >
                        {isAutoPaused ? 'Play' : 'Pause'}
                      </button>
                      <button
                        type="button"
                        onClick={onSkip}
                        className="rounded border border-black/40 bg-white px-2 py-0.5 text-[#374151]"
                      >
                        Skip
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onFinish}
                      className="rounded border border-black/70 bg-black px-2.5 py-0.5 text-white"
                    >
                      Resultats
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 text-sm">
                {recentComments.map((event, idx) => (
                  <div key={`evt-${event.minute}-${idx}`} className={`flex items-start gap-3 ${idx === 0 ? 'text-[#111827]' : 'text-[#6b7280]'}`}>
                    <span className="w-9 shrink-0 text-right font-mono text-xs">{event.minute}'</span>
                    <span className="text-xs sm:text-sm">{event.commentary}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {pendingDecision ? (
            <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-xl border-2 border-black/70 bg-white p-5 shadow-2xl">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#374151]">Decision Coach - Minute {pendingDecision.minute}</p>
                <h3 className="mt-1 text-lg font-bold uppercase tracking-[0.06em] text-[#111827]">{pendingDecision.title}</h3>
                <p className="mt-2 text-sm text-[#374151]">{pendingDecision.question}</p>
                <div className="mt-4 flex flex-col gap-2">
                  {pendingDecision.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onResolveDecision && onResolveDecision(pendingDecision.id, option)}
                      className="flex flex-col items-start rounded-lg border border-black/35 bg-white px-3 py-2 text-left transition hover:border-black/65"
                    >
                      <span className="text-sm font-semibold text-[#111827]">{option.label}</span>
                      <span className="mt-0.5 text-[11px] text-[#4b5563]">{option.commentary}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="mx-auto h-12 w-12 rotate-45 rounded-xl border-2 border-black/75 bg-white/75" />
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {enemyLiveRows.map((row) => (
              <div key={`red-${row.role}`} className="rounded-2xl border-2 border-black/70 bg-white/85 px-4 py-3 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b91c1c]">{row.role}</p>
                <p className="mt-1 truncate text-sm font-bold text-[#111827]">{row.playerName}</p>
                <p className="truncate text-xs text-[#374151]">{row.championName}</p>
                <p className="mt-1 text-[11px] font-mono text-[#4b5563]">{row.kills}K · {row.farm}CS</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchResultPage({
  report,
  onBackToCalendar,
  onBackToMatchDay,
}) {
  if (!report) {
    return (
      <Panel title="Fin de Match" subtitle="Aucun rapport disponible">
        <p className="text-sm text-[var(--text-soft)]">Lance et termine un live match pour afficher ce rapport.</p>
      </Panel>
    )
  }

  const resultLabel = report.teamWon ? 'Victoire' : 'Defaite'
  const roleDraftRows = report.draftRoleReport ?? []
  const scoreExplanation = report.draftScoreExplanation ?? []
  const analystLevel = clamp(report.analystLevel ?? 0, 0, STAFF_MAX_LEVEL)
  const postMatchBreakdown = report.postMatchBreakdown ?? {
    goldDiffAt15: 0,
    damageShare: [],
    adcShare: 0,
    draftImpactPercent: 0,
    draftImpactNote: 'Donnees indisponibles.',
  }
  const seriesScore = report.seriesScore ?? null
  const activeCombos = report.activeCombos ?? []
  const decisionAdjustments = report.decisionAdjustments ?? {}
  const decisionEntries = Object.values(decisionAdjustments)
  const prizeMoney = report.prizeMoney ?? 0
  const games = report.games ?? []
  const seriesRows = report.seriesRows ?? []
  const teamRowsToDisplay = seriesRows.length > 0
    ? seriesRows.filter((row) => row.team === 'team' || row.team === undefined)
    : report.teamRows
  const enemyRowsToDisplay = seriesRows.length > 0
    ? seriesRows.filter((row) => row.team === 'enemy')
    : report.enemyRows

  return (
    <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
      <Panel title="Fin de Match" subtitle={`${report.teamName} vs ${report.opponentName} - ${resultLabel}${seriesScore ? ` (${seriesScore})` : ''}`}>
        <div className="mb-3 grid gap-2 text-sm text-[var(--text-soft)] md:grid-cols-4">
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
            Serie: <span className="font-semibold text-[var(--text-main)]">{seriesScore ?? '-'}</span>
          </p>
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
            Kills: <span className="font-semibold text-[var(--text-main)]">{report.finalScoreboard.team.kills} - {report.finalScoreboard.enemy.kills}</span>
          </p>
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
            Draft Score: <span className="font-semibold text-[var(--text-main)]">{report.draftScore >= 0 ? '+' : ''}{report.draftScore}</span>
          </p>
          <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
            Prime: <span className={`font-semibold ${prizeMoney >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatBudgetShort(prizeMoney)}
            </span>
          </p>
        </div>

        {games.length > 1 ? (
          <div className="mb-3 grid gap-2 md:grid-cols-5">
            {games.map((game, index) => (
              <div
                key={`game-${index}`}
                className={`rounded border px-2 py-1 text-center text-xs ${
                  game.teamWon ? 'border-green-700 bg-green-950/40 text-green-200' : 'border-red-700 bg-red-950/40 text-red-200'
                }`}
              >
                G{index + 1}: {game.teamWon ? 'V' : 'D'}
              </div>
            ))}
          </div>
        ) : null}

        {activeCombos.length > 0 ? (
          <div className="mb-3 rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.1)] p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--accent)]">Combos No Luck actives</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeCombos.map((combo) => (
                <span
                  key={`combo-${combo.id}`}
                  className="rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] px-2 py-1 text-xs text-[var(--text-main)]"
                >
                  {combo.label} (+{combo.bonus?.value ?? 0}% {combo.bonus?.stat ?? ''})
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {decisionEntries.length > 0 ? (
          <div className="mb-3 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] p-3">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Decisions live de la serie</p>
            <div className="mt-2 space-y-1">
              {decisionEntries.map((entry) => (
                <div key={`decision-${entry.id}`} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-soft)]">{entry.label ?? 'Decision'}</span>
                  <span className={entry.reward >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {entry.reward >= 0 ? '+' : ''}{entry.reward}g
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <table className="fm-data-table">
          <thead>
            <tr>
              <th>Equipe</th>
              <th>Role</th>
              <th>Joueur</th>
              <th>KDA</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {teamRowsToDisplay.map((row) => {
              const rating = row.rating ?? null
              const ratingClass = rating === null
                ? 'text-[var(--text-soft)]'
                : rating >= 8
                  ? 'text-green-400 font-bold'
                  : rating >= 7
                    ? 'text-green-300'
                    : rating >= 6
                      ? 'text-[var(--text-main)]'
                      : rating >= 5
                        ? 'text-amber-300'
                        : 'text-red-400'
              return (
                <tr key={`team-${row.playerName}-${row.role}`}>
                  <td>{report.teamName}</td>
                  <td>{row.role}</td>
                  <td>{row.playerName}</td>
                  <td>{row.kills}/{row.deaths}/{row.assists}</td>
                  <td className={ratingClass}>{rating !== null ? rating.toFixed(1) : '-'}</td>
                </tr>
              )
            })}
            {enemyRowsToDisplay.map((row) => (
              <tr key={`enemy-${row.playerName}-${row.role}`}>
                <td>{report.opponentName}</td>
                <td>{row.role}</td>
                <td>{row.playerName}</td>
                <td>{row.kills}/{row.deaths}/{row.assists}</td>
                <td className="text-[var(--text-soft)]">-</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] p-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Rapport post-draft detaille</p>

          {analystLevel === 0 ? (
            <p className="mt-2 rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
              Analyste Data non recrute: le detail reste approximatif. Recrute-le pour des diagnostics plus precis.
            </p>
          ) : null}

          <div className="mt-2 overflow-x-auto">
            <table className="fm-data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Matchup</th>
                  <th>Lecture</th>
                  <th>Malus stats</th>
                  <th>Risque erreur fatale</th>
                </tr>
              </thead>
              <tbody>
                {roleDraftRows.map((row) => (
                  <tr key={`draft-role-${row.role}`}>
                    <td>{row.role}</td>
                    <td>
                      <span className="text-xs text-[var(--text-soft)]">{row.playerChampionLabel} vs {row.enemyChampionLabel}</span>
                    </td>
                    <td>
                      <div className="text-xs text-[var(--text-soft)]">
                        <p className="font-semibold text-[var(--text-main)]">{row.status} ({row.roleImpact >= 0 ? '+' : ''}{row.roleImpact})</p>
                        <p>Comfort {row.comfortDelta >= 0 ? '+' : ''}{row.comfortDelta} / Counter {row.counterDelta >= 0 ? '+' : ''}{row.counterDelta}</p>
                        <p>Maitrise: {row.mastery ?? '-'}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold ${row.statMalusPct >= 30 ? 'text-[var(--warn-text)]' : 'text-[var(--text-main)]'}`}>
                        -{row.statMalusPct}%
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold ${row.fatalRiskPct >= 45 ? 'text-[var(--warn-text)]' : 'text-[var(--text-main)]'}`}>
                        {row.fatalRiskPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {roleDraftRows.map((row) => (
              <div key={`draft-reason-${row.role}`} className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2.5 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-main)]">{row.role}</p>
                {row.reasons.map((reason, index) => (
                  <p key={`reason-${row.role}-${index}`} className="mt-1 text-xs text-[var(--text-soft)]">- {reason}</p>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-3 rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Pourquoi le Draft Score monte/descend</p>
            {scoreExplanation.map((line, index) => (
              <p key={`score-explain-${index}`} className="mt-1 text-xs text-[var(--text-soft)]">- {line}</p>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] p-3">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Post-Match Breakdown (No Luck)</p>

          <div className="mt-2 grid gap-2 text-sm text-[var(--text-soft)] md:grid-cols-3">
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-3 py-2">
              Gold Diff @15: <span className={`font-semibold ${postMatchBreakdown.goldDiffAt15 >= 0 ? 'text-[var(--text-main)]' : 'text-[var(--warn-text)]'}`}>
                {postMatchBreakdown.goldDiffAt15 >= 0 ? '+' : ''}{postMatchBreakdown.goldDiffAt15}
              </span>
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-3 py-2">
              Damage Share ADC: <span className="font-semibold text-[var(--text-main)]">{postMatchBreakdown.adcShare}%</span>
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-3 py-2">
              Draft Impact: <span className={`font-semibold ${postMatchBreakdown.draftImpactPercent >= 0 ? 'text-[var(--text-main)]' : 'text-[var(--warn-text)]'}`}>
                {postMatchBreakdown.draftImpactPercent >= 0 ? '+' : ''}{postMatchBreakdown.draftImpactPercent}%
              </span>
            </p>
          </div>

          <p className="mt-2 rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-soft)]">
            {postMatchBreakdown.draftImpactNote}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="fm-data-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Joueur</th>
                  <th>Damage Share</th>
                </tr>
              </thead>
              <tbody>
                {postMatchBreakdown.damageShare.map((entry) => (
                  <tr key={`damage-${entry.role}-${entry.playerName}`}>
                    <td>{entry.role}</td>
                    <td>{entry.playerName}</td>
                    <td>{entry.sharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="MVP" subtitle="Performance cle du match">
          <p className="text-sm text-[var(--text-soft)]">
            {report.mvp?.playerName ?? 'N/A'} ({report.mvp?.role ?? '-'})
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            KDA: {report.mvp?.kills ?? 0}/{report.mvp?.deaths ?? 0}/{report.mvp?.assists ?? 0}
          </p>
        </Panel>

        {!report.teamWon ? (
          <Panel title="Analyse de defaite" subtitle="Lecture No Luck">
            <p className="text-sm text-[var(--warn-text)]">{report.defeatReason}</p>
          </Panel>
        ) : (
          <Panel title="Lecture de victoire" subtitle="Execution validee">
            <p className="text-sm text-[var(--text-soft)]">{report.defeatReason}</p>
          </Panel>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onBackToCalendar}
            className="rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.26)]"
          >
            Retour calendrier
          </button>
          <button
            type="button"
            onClick={onBackToMatchDay}
            className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)]"
          >
            Retour match day
          </button>
        </div>
      </div>
    </div>
  )
}

function RecrutementPage({
  staffTeam,
  onUpgradeStaff,
  transferMarket = [],
  onSignPlayer,
  budget = 0,
  scoutingQueue = [],
  onLaunchScout,
  headScoutLevel = 0,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Panel title="Marche des transferts" subtitle={`Tresorerie: ${formatBudgetShort(budget)}`}>
        {transferMarket.length === 0 ? (
          <p className="text-sm text-[var(--text-soft)]">Aucun joueur disponible cette fenetre. Reviens plus tard.</p>
        ) : (
          <table className="fm-data-table">
            <thead>
              <tr>
                <th>Pseudo</th>
                <th>Role</th>
                <th>Ligue</th>
                <th>Stats clefs</th>
                <th>Potentiel</th>
                <th>Prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transferMarket.map((target) => {
                const canAfford = budget >= (target.askingPrice ?? 0)
                const potentialLabel = target.revealedPotential
                  ? `${target.revealedPotential}`
                  : headScoutLevel >= 2 ? `~${Math.round(target.potential / 10) * 10}` : '???'
                return (
                  <tr key={`market-${target.id}`}>
                    <td className="font-semibold text-[var(--text-main)]">{target.pseudo}</td>
                    <td>{target.role}</td>
                    <td className="text-xs text-[var(--text-soft)]">{target.league ?? target.source}</td>
                    <td className="text-xs text-[var(--text-soft)]">
                      Lane {target.statsPreview?.laning ?? '?'} / TF {target.statsPreview?.teamfight ?? '?'} / Mech {target.statsPreview?.mechanics ?? '?'}
                    </td>
                    <td className="text-xs">{potentialLabel}</td>
                    <td className={`font-mono text-xs ${canAfford ? 'text-[var(--text-main)]' : 'text-red-400'}`}>
                      {formatBudgetShort(target.askingPrice ?? 0)}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onSignPlayer?.(target.id)}
                        disabled={!canAfford || target.signed}
                        className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide ${
                          canAfford && !target.signed
                            ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.28)]'
                            : 'cursor-not-allowed border-[var(--border-soft)] bg-[var(--surface-3)] text-[var(--text-muted)] opacity-70'
                        }`}
                      >
                        {target.signed ? 'Signe' : canAfford ? 'Signer' : 'Fonds KO'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Scouting en cours" subtitle={`Head Scout niveau ${headScoutLevel}`}>
          <div className="space-y-2 text-xs">
            {scoutingQueue.length === 0 ? (
              <p className="text-[var(--text-soft)]">File de scouting vide.</p>
            ) : (
              scoutingQueue.map((task, index) => (
                <div key={`scout-${index}`} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-main)]">{task.player}</span>
                    <span className="text-[var(--text-soft)]">{task.league}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-soft)]">
                    {task.daysRemaining > 0 ? `${task.daysRemaining}j restants` : 'Rapport pret - Arrivera sur le marche'}
                  </div>
                </div>
              ))
            )}
            {onLaunchScout ? (
              <button
                type="button"
                onClick={onLaunchScout}
                className="mt-2 w-full rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] px-2 py-1.5 text-[10px] uppercase tracking-wide text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.28)]"
              >
                Lancer un scout (3j)
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel title="Objectif mercato" subtitle="Fenetre en cours">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>Priorite 1: Mid remplaçant U21</p>
            <p>Priorite 2: Support vocal lead</p>
            <p>Budget disponible: {formatBudgetShort(budget)}</p>
          </div>
        </Panel>

        <Panel title="Recruter ton staff" subtitle="L equipe derriere l equipe">
          <div className="space-y-2">
            {Object.entries(STAFF_CATALOG).map(([staffId, config]) => {
              const level = clamp(staffTeam?.[staffId] ?? 0, 0, STAFF_MAX_LEVEL)
              const nextLevel = clamp(level + 1, 0, STAFF_MAX_LEVEL)
              const canUpgrade = level < STAFF_MAX_LEVEL
              const nextCost = config.monthlyCostByLevel[nextLevel] ?? config.monthlyCostByLevel[level] ?? 0

              return (
                <div key={`staff-recruit-${staffId}`} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--text-main)]">{config.label} - Niveau {level}/{STAFF_MAX_LEVEL}</p>
                  <p className="text-xs text-[var(--text-soft)]">{config.role}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {canUpgrade ? `Prochaine masse salariale: $${Math.round(nextCost / 1000)}K/mois` : 'Niveau maximum atteint'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpgradeStaff(staffId)}
                      disabled={!canUpgrade}
                      className={`rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${
                        canUpgrade
                          ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.28)]'
                          : 'cursor-not-allowed border-[var(--border-soft)] bg-[var(--surface-3)] text-[var(--text-muted)] opacity-70'
                      }`}
                    >
                      {canUpgrade ? 'Recruter / Upgrade' : 'Max'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function StaffFinancesPage({
  staffTeam,
  staffMonthlyCost,
  budget,
  financeLedger,
  sponsorContracts,
  boardObjectives,
  playerCount,
}) {
  const staffRows = Object.entries(STAFF_CATALOG).map(([staffId, config]) => {
    const level = clamp(staffTeam?.[staffId] ?? 0, 0, STAFF_MAX_LEVEL)
    return {
      department: config.label,
      lead: level > 0 ? `Niveau ${level}` : 'Non recrute',
      levelLabel: `${level}/${STAFF_MAX_LEVEL}`,
      cost: `${Math.round((config.monthlyCostByLevel[level] ?? 0) / 1000)}k€`,
    }
  })

  const totalSalaries = (playerCount ?? 0) * DEFAULT_PLAYER_SALARY
  const totalSponsors = (sponsorContracts ?? [])
    .filter((sponsor) => sponsor.status !== 'ended')
    .reduce((sum, sponsor) => sum + (sponsor.monthly ?? 0), 0)
  const monthlyDelta = totalSponsors - staffMonthlyCost - totalSalaries
  const runwayMonths = monthlyDelta < 0 ? Math.floor(budget / Math.abs(monthlyDelta)) : null

  return (
    <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
      <Panel title="Staff & Finances" subtitle="Budget, sponsors et encadrement">
        <table className="fm-data-table">
          <thead>
            <tr>
              <th>Departement</th>
              <th>Responsable</th>
              <th>Niveau</th>
              <th>Cout mensuel</th>
            </tr>
          </thead>
          <tbody>
            {staffRows.map((row) => (
              <tr key={row.department}>
                <td>{row.department}</td>
                <td>{row.lead}</td>
                <td>{row.levelLabel}</td>
                <td>{row.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">Dernieres operations</h3>
          <table className="fm-data-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {(financeLedger ?? []).slice(0, 12).map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.label}</td>
                  <td className={`text-right font-mono ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.amount >= 0 ? '+' : ''}{formatBudgetShort(entry.amount)}
                  </td>
                </tr>
              ))}
              {(financeLedger ?? []).length === 0 ? (
                <tr><td colSpan={2} className="text-center text-[var(--text-soft)]">Aucune operation enregistree.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Synthese budget" subtitle="Tresorerie live">
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p className="text-base">
              Tresorerie: <span className="font-semibold text-[var(--text-main)]">{formatBudgetShort(budget)}</span>
            </p>
            <p>Salaires joueurs: <span className="text-[var(--text-main)]">{formatBudgetShort(totalSalaries)}/mois</span></p>
            <p>Masse salariale staff: <span className="text-[var(--text-main)]">{formatBudgetShort(staffMonthlyCost)}/mois</span></p>
            <p>Revenus sponsors: <span className="text-green-400">{formatBudgetShort(totalSponsors)}/mois</span></p>
            <p className={monthlyDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
              Solde mensuel: {monthlyDelta >= 0 ? '+' : ''}{formatBudgetShort(monthlyDelta)}
            </p>
            {runwayMonths !== null ? (
              <p className="text-xs text-red-300">Survie estimee: {runwayMonths} mois sans primes</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Sponsors actifs" subtitle="Contrats et objectifs">
          <div className="space-y-2 text-sm">
            {(sponsorContracts ?? []).map((sponsor) => (
              <div key={sponsor.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-main)]">{sponsor.label}</span>
                  <span className="text-xs text-green-400">{formatBudgetShort(sponsor.monthly)}/mois</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  Objectif: {sponsor.target?.type === 'winrate'
                    ? `${sponsor.target.value}% winrate`
                    : `Top ${sponsor.target?.value}`} - Bonus {formatBudgetShort(sponsor.target?.bonus ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Objectifs board" subtitle="Attentes des proprietaires">
          <div className="space-y-2 text-sm">
            {(boardObjectives ?? []).map((objective) => (
              <div key={objective.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-main)]">{objective.label}</span>
                  <span className={`text-xs ${objective.status === 'done' ? 'text-green-400' : objective.status === 'failed' ? 'text-red-400' : 'text-amber-300'}`}>
                    {objective.status === 'done' ? 'Accomplie' : objective.status === 'failed' ? 'Echouee' : 'En cours'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Recompense: {formatBudgetShort(objective.reward ?? 0)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function DataHubPage({ lastMatchReport, staffTeam }) {
  const analystLevel = clamp(staffTeam?.dataAnalyst ?? 0, 0, STAFF_MAX_LEVEL)
  const breakdown = lastMatchReport?.postMatchBreakdown
  const hasBreakdown = Boolean(breakdown)

  const indicatorRows = hasBreakdown
    ? [
        ['Gold Diff @15', `${breakdown.goldDiffAt15 >= 0 ? '+' : ''}${breakdown.goldDiffAt15}`, breakdown.goldDiffAt15 >= 0 ? 'Early game domine' : 'Early game subi'],
        ['Damage Share ADC', `${breakdown.adcShare}%`, breakdown.adcShare >= 28 ? 'Carry bien alimente' : 'Impact ADC insuffisant'],
        ['Draft Impact', `${breakdown.draftImpactPercent >= 0 ? '+' : ''}${breakdown.draftImpactPercent}%`, breakdown.draftImpactNote],
      ]
    : [
        ['Winrate avec 1er Dragon', '80%', 'Condition de victoire majeure'],
        ['Winrate sans 1er Dragon', '20%', 'Deficit de tempo'],
        ['Moyenne gold @15', '+1240', 'Early game solide'],
        ['Taux de conversion Nashor', '71%', 'Bonne discipline macro'],
      ]

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Panel title="Centre de donnees" subtitle="Pourquoi on gagne ou on perd">
        {analystLevel === 0 ? (
          <p className="mb-3 rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
            Analyste Data non recrute: les indicateurs avances restent approximatifs.
          </p>
        ) : null}

        <table className="fm-data-table">
          <thead>
            <tr>
              <th>Indicateur</th>
              <th>Valeur</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {indicatorRows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Signal fort" subtitle="Lecture rapide">
        <div className="space-y-3 text-sm text-[var(--text-soft)]">
          {hasBreakdown ? (
            <>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                Gold diff @15: {breakdown.goldDiffAt15 >= 0 ? 'vous aviez le tempo early.' : 'vous etiez sous pression en early.'}
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                {breakdown.draftImpactNote}
              </p>
            </>
          ) : (
            <>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                6 defaites sur 7 quand la bot lane est derriere de 800g a 12 min.
              </p>
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                75% de victoire quand Miro obtient un counter pick.
              </p>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}

const PROFILE_NATIONALITIES = [
  'France',
  'Coree du Sud',
  'Chine',
  'Suede',
  'Danemark',
  'Allemagne',
  'Espagne',
  'Pologne',
  'Turquie',
  'Canada',
]

const MORALE_TIERS = [
  { label: 'Fragile', tiltBase: 38, state: 'Bas' },
  { label: 'Moyen', tiltBase: 52, state: 'Instable' },
  { label: 'Bon', tiltBase: 66, state: 'Stable' },
  { label: 'Excellent', tiltBase: 78, state: 'Solide' },
  { label: 'Elite', tiltBase: 89, state: 'Tres solide' },
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function stableHash(text) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
}

function formatBudgetShort(amount) {
  const sign = amount < 0 ? '-' : ''
  const value = Math.abs(Math.round(amount))
  if (value >= 1_000_000) {
    return `${sign}${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M€`
  }
  if (value >= 1_000) {
    return `${sign}${(value / 1_000).toFixed(0)}k€`
  }
  return `${sign}${value}€`
}

function buildChampionIdentity(champion, activeLeague) {
  const seed = stableHash(`${champion.id}-${champion.role}`)
  const morale = MORALE_TIERS[(seed >>> 3) % MORALE_TIERS.length]
  const age = 17 + (seed % 13)
  const defaultNationality = PROFILE_NATIONALITIES[(seed >>> 1) % PROFILE_NATIONALITIES.length]
  const nationality = seed % 3 === 0 ? activeLeague.region : defaultNationality
  const pseudo = `${champion.id.toUpperCase()}-${String((seed % 90) + 10).padStart(2, '0')}`

  const condition = clamp(42 + ((seed >>> 2) % 59), 35, 100)
  const conditionMultiplier = condition < 50 ? clamp(1 - (50 - condition) * 0.012, 0.72, 0.99) : 1
  const tiltResistance = clamp(Math.round(morale.tiltBase + (condition - 50) * 0.35), 30, 99)

  return {
    pseudo,
    age,
    nationality,
    morale,
    tiltResistance,
    condition,
    conditionMultiplier,
  }
}

function buildNoLuckProjection(champion, activeLeague, identity) {
  const coreValues = Object.values(champion.stats)
  const basePower = coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length

  const moraleCoef = 0.84 + identity.tiltResistance / 500
  const tierCoef = activeLeague.tier === 1 ? 1.05 : 1.01
  const finalScore = basePower * moraleCoef * identity.conditionMultiplier * tierCoef

  return {
    basePower: Number(basePower.toFixed(2)),
    moraleCoef: Number(moraleCoef.toFixed(2)),
    conditionCoef: Number(identity.conditionMultiplier.toFixed(2)),
    tierCoef: Number(tierCoef.toFixed(2)),
    finalScore: Number(finalScore.toFixed(2)),
    conditionPenaltyPercent: Math.round((1 - identity.conditionMultiplier) * 100),
  }
}

function toFmStat(value) {
  return clamp(Math.round(value * 2), 1, 20)
}

function buildPlayerAttributes(champion, identity) {
  const roleMentalBonus = {
    Top: 0.3,
    Jungle: 0.9,
    Mid: 0.6,
    ADC: 0.2,
    Support: 1.1,
  }

  const roleTechniqueBonus = {
    Top: 0.4,
    Jungle: 0.5,
    Mid: 0.8,
    ADC: 1.0,
    Support: 0.2,
  }

  const mentalBase = roleMentalBonus[champion.role] ?? 0.4
  const techBase = roleTechniqueBonus[champion.role] ?? 0.4

  const shotcalling10 = clamp(
    champion.stats.waveclear * 0.35 + champion.stats.scaling * 0.35 + champion.stats.cc * 0.2 + mentalBase,
    1,
    10,
  )
  const gameVision10 = clamp(
    champion.stats.range * 0.3 + champion.stats.cc * 0.3 + champion.stats.waveclear * 0.2 + mentalBase,
    1,
    10,
  )
  const sangFroid10 = clamp(identity.tiltResistance / 10 + identity.condition / 25, 1, 10)

  const lastHit10 = clamp(
    champion.stats.scaling * 0.45 + champion.stats.range * 0.25 + champion.stats.waveclear * 0.2 + techBase,
    1,
    10,
  )
  const dodge10 = clamp(
    champion.stats.mobility * 0.55 + champion.stats.range * 0.15 + champion.stats.cc * 0.1 + techBase,
    1,
    10,
  )
  const comboSpeed10 = clamp(champion.stats.burst * 0.6 + champion.stats.mobility * 0.3 + techBase, 1, 10)

  const mental = {
    Shotcalling: toFmStat(shotcalling10),
    VisionDeJeu: toFmStat(gameVision10),
    SangFroid: toFmStat(sangFroid10),
  }

  const technique = {
    LastHit: toFmStat(lastHit10),
    Dodge: toFmStat(dodge10),
    ComboSpeed: toFmStat(comboSpeed10),
  }

  const radar = {
    Agressivite: clamp((champion.stats.burst + champion.stats.mobility + comboSpeed10) / 3, 1, 10),
    SafePlay: clamp((sangFroid10 + gameVision10 + champion.stats.range * 0.7) / 2.7, 1, 10),
    Macro: clamp((shotcalling10 + gameVision10 + champion.stats.waveclear) / 3, 1, 10),
    Mecanique: clamp((lastHit10 + dodge10 + comboSpeed10) / 3, 1, 10),
    Discipline: clamp((identity.condition / 10 + sangFroid10) / 2, 1, 10),
    Adaptation: clamp((champion.stats.scaling + champion.stats.waveclear + gameVision10) / 3, 1, 10),
  }

  const styleLabel =
    radar.Agressivite >= radar.SafePlay + 1 ? 'Profil agressif' : radar.SafePlay >= radar.Agressivite + 1 ? 'Profil safe / controle' : 'Profil hybride'

  return {
    mental,
    technique,
    radar,
    styleLabel,
  }
}

function buildChampionPool(champion) {
  const statKeys = ['range', 'burst', 'cc', 'mobility', 'waveclear', 'scaling']

  const candidates = CHAMPIONS_DB.filter(
    (candidate) => !(candidate.id === champion.id && candidate.role === champion.role),
  ).map((candidate) => {
    const statDistance = statKeys.reduce(
      (sum, key) => sum + Math.abs((candidate.stats[key] ?? 5) - (champion.stats[key] ?? 5)),
      0,
    )
    const statCloseness = 1 - statDistance / 54

    const sharedTags = candidate.tags.filter((tag) => champion.tags.includes(tag)).length
    const tagAffinity = sharedTags / Math.max(champion.tags.length, 1)

    const sameRoleBonus = candidate.role === champion.role ? 1 : 0

    const score = clamp(Math.round(statCloseness * 55 + tagAffinity * 25 + sameRoleBonus * 20), 1, 99)

    let reason = 'Profil complementaire a explorer'
    if (candidate.role === champion.role && sharedTags >= 1) {
      reason = `Meme role + ${sharedTags} tag(s) commun(s)`
    } else if (candidate.role === champion.role) {
      reason = 'Meme role, execution transferable'
    } else if (sharedTags >= 2) {
      reason = `Cross-role avec ${sharedTags} tags communs`
    }

    return {
      key: `${candidate.id}-${candidate.role}`,
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      score,
      reason,
    }
  })

  const sorted = candidates.sort((a, b) => b.score - a.score)

  const favoris = [
    {
      key: `${champion.id}-${champion.role}-main`,
      id: champion.id,
      name: champion.name,
      role: champion.role,
      score: 100,
      reason: 'Champion signature',
    },
    ...sorted.filter((entry) => entry.role === champion.role).slice(0, 5),
  ]

  const maitrises = sorted.filter((entry) => entry.score >= 72).slice(0, 10)

  const apprendreBase = sorted.filter((entry) => entry.score >= 45 && entry.score < 72).slice(0, 10)
  const missing = 10 - apprendreBase.length
  const apprendre =
    missing > 0
      ? [...apprendreBase, ...sorted.filter((entry) => !apprendreBase.some((item) => item.key === entry.key)).slice(0, missing)]
      : apprendreBase

  return {
    favoris,
    maitrises,
    apprendre,
  }
}

function RadarChart({ metrics }) {
  const labels = Object.keys(metrics)
  const size = 280
  const center = size / 2
  const radius = 92

  const getPoint = (index, ratio = 1) => {
    const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / labels.length
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    }
  }

  const levels = [0.25, 0.5, 0.75, 1]
  const valuePolygon = labels
    .map((label, index) => {
      const ratio = clamp(metrics[label], 0, 10) / 10
      const point = getPoint(index, ratio)
      return `${point.x},${point.y}`
    })
    .join(' ')

  return (
    <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Radar Chart - Profil de jeu</p>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[310px]">
        {levels.map((level) => {
          const ringPoints = labels
            .map((_, index) => {
              const point = getPoint(index, level)
              return `${point.x},${point.y}`
            })
            .join(' ')

          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="rgba(226, 213, 186, 0.35)"
              strokeWidth="1"
            />
          )
        })}

        {labels.map((label, index) => {
          const edgePoint = getPoint(index, 1)
          const labelPoint = getPoint(index, 1.14)

          return (
            <g key={label}>
              <line
                x1={center}
                y1={center}
                x2={edgePoint.x}
                y2={edgePoint.y}
                stroke="rgba(226, 213, 186, 0.35)"
                strokeWidth="1"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text-soft)"
              >
                {label}
              </text>
            </g>
          )
        })}

        <polygon points={valuePolygon} fill="rgba(128, 155, 118, 0.24)" stroke="var(--accent)" strokeWidth="2" />
      </svg>
    </div>
  )
}

function AttributeGroup({ title, attributes }) {
  return (
    <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</p>
      <div className="space-y-2">
        {Object.entries(attributes).map(([label, value]) => (
          <div key={label}>
            <div className="mb-0.5 flex items-center justify-between text-xs text-[var(--text-soft)]">
              <span>{label}</span>
              <span className="font-semibold text-[var(--text-main)]">{value}/20</span>
            </div>
            <div className="h-1.5 rounded bg-[var(--surface-1)]">
              <div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${value * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function StatBlock({ title, stats }) {
  if (!stats) {
    return null
  }

  return (
    <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2 py-1.5 text-sm">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{key}</p>
            <p className="font-semibold text-[var(--text-main)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChampionProfileCard({ champion, activeLeague, onClose }) {
  const [activePoolTab, setActivePoolTab] = useState('favoris')

  if (!champion) {
    return null
  }

  const identity = buildChampionIdentity(champion, activeLeague)
  const projection = buildNoLuckProjection(champion, activeLeague, identity)
  const attributes = buildPlayerAttributes(champion, identity)
  const championPool = buildChampionPool(champion)
  const conditionIsLow = identity.condition < 50

  const poolTabs = [
    { id: 'favoris', label: 'Favoris', data: championPool.favoris },
    { id: 'maitrises', label: 'Maitrises', data: championPool.maitrises },
    { id: 'apprendre', label: 'A apprendre', data: championPool.apprendre },
  ]

  const activePool = poolTabs.find((tab) => tab.id === activePoolTab)?.data ?? championPool.favoris

  return (
    <Panel title={`Fiche Champion - ${champion.name}`} subtitle={`Role: ${champion.role}`}>
      <div className="mb-3 grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Bloc A - Identite & Physique</p>
          <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--text-soft)]">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Nom</dt>
              <dd className="font-semibold text-[var(--text-main)]">{champion.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Pseudo</dt>
              <dd className="font-semibold text-[var(--text-main)]">{identity.pseudo}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Age</dt>
              <dd className="font-semibold text-[var(--text-main)]">{identity.age} ans</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Nationalite</dt>
              <dd className="font-semibold text-[var(--text-main)]">{identity.nationality}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Moral</dt>
              <dd className="font-semibold text-[var(--text-main)]">{identity.morale.label}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Resistance au tilt</dt>
              <dd className="font-semibold text-[var(--text-main)]">{identity.tiltResistance}/99 ({identity.morale.state})</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Condition</dt>
              <dd>
                <div className="mt-1 rounded border border-[var(--border-soft)] bg-[var(--surface-3)] p-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-soft)]">
                    <span>Fatigue accumulee</span>
                    <span className="font-semibold text-[var(--text-main)]">{identity.condition}%</span>
                  </div>
                  <div className="h-2 rounded bg-[var(--surface-1)]">
                    <div
                      className={`h-2 rounded ${conditionIsLow ? 'bg-[var(--danger-text)]' : 'bg-[var(--accent)]'}`}
                      style={{ width: `${identity.condition}%` }}
                    />
                  </div>
                </div>
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">No Luck - Pourquoi il performe</p>
          <div className="space-y-2 text-sm text-[var(--text-soft)]">
            <p>
              Puissance brute (moyenne stats core): <span className="font-semibold text-[var(--text-main)]">{projection.basePower}</span>
            </p>
            <p>
              Coeff moral: <span className="font-semibold text-[var(--text-main)]">x{projection.moraleCoef}</span>
            </p>
            <p>
              Coeff condition: <span className="font-semibold text-[var(--text-main)]">x{projection.conditionCoef}</span>
            </p>
            <p>
              Coeff ligue ({activeLeague.name}): <span className="font-semibold text-[var(--text-main)]">x{projection.tierCoef}</span>
            </p>
            <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2 py-1.5">
              Indice performance match: <span className="font-semibold text-[var(--text-main)]">{projection.finalScore}</span>
            </p>

            {conditionIsLow ? (
              <p className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-2 py-1.5 text-[var(--warn-text)]">
                Condition sous 50%: malus direct de -{projection.conditionPenaltyPercent}% en match.
              </p>
            ) : (
              <p className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2 py-1.5 text-[var(--text-soft)]">
                Condition {'>='} 50%: aucun malus de fatigue applique.
              </p>
            )}
          </div>
        </article>
      </div>

      <div className="mb-3 grid gap-3 xl:grid-cols-[1.2fr_1.1fr]">
        <article className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Bloc B - Attributs FM</p>
          <div className="grid gap-3 md:grid-cols-2">
            <AttributeGroup title="Mental" attributes={attributes.mental} />
            <AttributeGroup title="Technique" attributes={attributes.technique} />
          </div>
          <p className="mt-2 rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2 py-1.5 text-xs text-[var(--text-soft)]">
            Lecture FM: {attributes.styleLabel}
          </p>
        </article>

        <RadarChart metrics={attributes.radar} />
      </div>

      <article className="mb-3 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
        <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Bloc C - Champion Pool</p>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {poolTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivePoolTab(tab.id)}
              className={`rounded border px-2.5 py-1 text-xs uppercase tracking-[0.08em] transition ${
                activePoolTab === tab.id
                  ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] text-[var(--text-main)]'
                  : 'border-[var(--border-soft)] bg-[var(--surface-3)] text-[var(--text-soft)] hover:border-[var(--accent)]'
              }`}
            >
              {tab.label} ({tab.data.length})
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activePool.map((entry) => (
            <div key={entry.key} className="rounded border border-[var(--border-soft)] bg-[var(--surface-3)] px-2.5 py-2">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-main)]">{entry.name}</p>
                <span className="rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {entry.role}
                </span>
              </div>
              <div className="mb-1 h-1.5 rounded bg-[var(--surface-1)]">
                <div className="h-1.5 rounded bg-[var(--accent)]" style={{ width: `${entry.score}%` }} />
              </div>
              <p className="text-xs text-[var(--text-soft)]">Maitrise estimee: {entry.score}/100</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{entry.reason}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {champion.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)]"
        >
          Fermer la fiche
        </button>
      </div>

      {champion.supportArchetype ? (
        <p className="mb-3 text-sm text-[var(--text-soft)]">
          Archetype support: <span className="font-semibold text-[var(--text-main)]">{champion.supportArchetype}</span>
        </p>
      ) : null}

      <div className="space-y-3">
        <StatBlock title="Stats core" stats={champion.stats} />
        <StatBlock title="Stats jungle" stats={champion.jungleStats} />
        <StatBlock title="Stats midlane" stats={champion.midlaneStats} />
        <StatBlock title="Stats adc" stats={champion.adcStats} />
        <StatBlock title="Stats support" stats={champion.supportStats} />
      </div>

      <div className="mt-3 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Synergies</span>
        <p className="mt-1 text-[var(--text-main)]">{champion.synergies.join(' • ')}</p>
      </div>
    </Panel>
  )
}

function StartScreen({ onStart, onContinue, hasSave }) {
  const [phase, setPhase] = useState('league')
  const [leagueId, setLeagueId] = useState(null)

  const leagueList = Object.values(LEAGUES)
  const teamList = leagueId ? (TEAMS_BY_LEAGUE[leagueId] ?? []) : []

  const handlePickLeague = (id) => {
    setLeagueId(id)
    setPhase('team')
  }

  const handlePickTeam = (teamName) => {
    const teamId = findTeamIdForLeague(leagueId, teamName) ?? normalizeKey(teamName)
    onStart(leagueId, teamId)
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--bg-app)] px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sky-500 opacity-[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Saison 2026</p>
          <h1 className="font-heading text-6xl font-black uppercase tracking-[0.06em] text-[var(--text-main)] md:text-8xl">
            Esport Director
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--text-soft)]">League of Legends Manager</p>
        </div>

        {phase === 'league' ? (
          <>
            <p className="mb-5 text-center text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Choisis ta ligue
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {leagueList.map((league) => {
                const hasRealData = league.id === 'LEC' || league.id === 'LFL'
                return (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => handlePickLeague(league.id)}
                    className="group flex flex-col items-center gap-3 rounded border border-[var(--border-soft)] bg-[var(--surface-1)] px-3 py-6 transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      hasRealData
                        ? 'bg-[rgba(200,170,110,0.18)] text-[var(--accent)]'
                        : 'bg-[rgba(100,116,139,0.15)] text-slate-400'
                    }`}>
                      {hasRealData ? 'Reel' : 'Fictif'}
                    </span>
                    <p className="font-heading text-xl uppercase tracking-widest text-[var(--text-main)]">{league.id}</p>
                    <p className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-soft)]">{league.region}</p>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPhase('league')}
                className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)] transition hover:text-[var(--text-soft)]"
              >
                &larr; Ligues
              </button>
              <span className="text-[var(--border-strong)]">·</span>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {LEAGUES[leagueId]?.name} &mdash; Choisis ton equipe
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {teamList.map((team) => (
                <button
                  key={team.name}
                  type="button"
                  onClick={() => handlePickTeam(team.name)}
                  className="group flex flex-col gap-2 rounded border border-[var(--border-soft)] bg-[var(--surface-1)] px-4 py-5 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                >
                  <p className="font-heading text-base uppercase leading-tight tracking-[0.04em] text-[var(--text-main)]">{team.name}</p>
                  <div className="mt-auto">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Puissance</p>
                      <p className="text-[9px] font-semibold text-[var(--text-soft)]">{team.power}</p>
                    </div>
                    <div className="h-0.5 overflow-hidden rounded bg-[var(--surface-3)]">
                      <div
                        className="h-0.5 rounded bg-[var(--accent)] transition-all"
                        style={{ width: `${Math.round(Math.max(0, (team.power - 60) / 40) * 100)}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {hasSave ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={onContinue}
              className="rounded border border-[var(--border-soft)] bg-transparent px-6 py-2.5 text-xs uppercase tracking-[0.14em] text-[var(--text-soft)] transition hover:border-[var(--accent)] hover:text-[var(--text-main)]"
            >
              &#8629; Continuer la saison en cours
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState('mailbox')
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => _initialSave?.selectedLeagueId ?? 'LFL')
  const [teamSelectionByLeague, setTeamSelectionByLeague] = useState(() => _initialSave?.teamSelectionByLeague ?? { ...DEFAULT_TEAM_BY_LEAGUE })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChampion, setSelectedChampion] = useState(null)
  const [selectedRosterPlayer, setSelectedRosterPlayer] = useState(null)
  const [rosterProfiles, setRosterProfiles] = useState(() => _initialSave?.rosterProfiles ?? {})
  const [currentDate, setCurrentDate] = useState(() => {
    // Defensive: legacy saves may have currentDate as ISO string or missing
    const saved = _initialSave?.currentDate
    if (saved instanceof Date && !Number.isNaN(saved.getTime())) return saved
    if (saved) {
      const parsed = new Date(saved)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date('2026-01-01T00:00:00')
  })
  const [trainingPlan, setTrainingPlan] = useState(() => _initialSave?.trainingPlan ?? { ...DEFAULT_TRAINING_PLAN })
  const [leagueSchedules, setLeagueSchedules] = useState(() => _initialSave?.leagueSchedules ?? {})
  const [metaPatch, setMetaPatch] = useState(() => _initialSave?.metaPatch ?? '14.1')
  const [timeNotification, setTimeNotification] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [scoutingQueue, setScoutingQueue] = useState(() => _initialSave?.scoutingQueue ?? INITIAL_SCOUTING_QUEUE)
  const [synergyByTeam, setSynergyByTeam] = useState(() => _initialSave?.synergyByTeam ?? {})
  const [draftBonusByTeam, setDraftBonusByTeam] = useState(() => _initialSave?.draftBonusByTeam ?? {})
  const [aggressivite, setAggressivite] = useState(() => _initialSave?.aggressivite ?? 58)
  const [rythmeJeu, setRythmeJeu] = useState(() => _initialSave?.rythmeJeu ?? 52)
  const [prioriteObjectifs, setPrioriteObjectifs] = useState(() => _initialSave?.prioriteObjectifs ?? 47)
  const [focusJoueur, setFocusJoueur] = useState(() => _initialSave?.focusJoueur ?? 'Miro')
  const [saveMessage, setSaveMessage] = useState('')
  const [staffTeam, setStaffTeam] = useState(() => _initialSave?.staffTeam ?? DEFAULT_STAFF_TEAM)
  const [matchApproachById, setMatchApproachById] = useState(() => _initialSave?.matchApproachById ?? {})
  const [matchDraftById, setMatchDraftById] = useState(() => _initialSave?.matchDraftById ?? {})
  const [matchFlowStepById, setMatchFlowStepById] = useState({})
  const [liveMatchSession, setLiveMatchSession] = useState(null)
  const [lastMatchReport, setLastMatchReport] = useState(() => _initialSave?.lastMatchReport ?? null)
  const [budget, setBudget] = useState(() => _initialSave?.budget ?? SEASON_START_BUDGET)
  const [financeLedger, setFinanceLedger] = useState(() => _initialSave?.financeLedger ?? [
    {
      id: 'seed-sponsor',
      label: 'Contrat initial - Fond saison',
      amount: SEASON_START_BUDGET,
      dateKey: '2026-01-01',
      type: 'credit',
    },
  ])
  const [sponsorContracts, setSponsorContracts] = useState(() =>
    _initialSave?.sponsorContracts ?? SPONSOR_CONTRACTS.map((sponsor) => ({ ...sponsor, status: 'active', progress: 0 })),
  )
  const [boardObjectives, setBoardObjectives] = useState(() =>
    _initialSave?.boardObjectives ?? BOARD_OBJECTIVES.map((objective) => ({ ...objective, status: 'pending', progress: 0 })),
  )
  const [gameOver, setGameOver] = useState(() => _initialSave?.gameOver ?? null)
  const [metaPatchState, setMetaPatchState] = useState(() => _initialSave?.metaPatchState ?? {
    version: '14.1',
    boostedArchetype: META_PATCH_ARCHETYPES[0],
    nerfedArchetype: META_PATCH_ARCHETYPES[1],
    boostedChampions: [],
    nerfedChampions: [],
  })
  const [, setPatchHistory] = useState(() => [])
  const [transferMarket, setTransferMarket] = useState(() => _initialSave?.transferMarket ?? buildTransferMarketFromPool(null, 8))
  const [matchHistory, setMatchHistory] = useState(() => _initialSave?.matchHistory ?? [])
  const [gamePhase, setGamePhase] = useState(() => _initialSave?.gamePhase ?? 'setup')
  const [newsFeed, setNewsFeed] = useState(() => _initialSave?.newsFeed ?? [])
  const [lastNewsWeekIndex, setLastNewsWeekIndex] = useState(() => _initialSave?.lastNewsWeekIndex ?? -1)
  const [pendingDecision, setPendingDecision] = useState(() => _initialSave?.pendingDecision ?? null)
  const [mailboxReadById, setMailboxReadById] = useState(() => _initialSave?.mailboxReadById ?? {})
  const [selectedMailId, setSelectedMailId] = useState(() => _initialSave?.selectedMailId ?? null)

  const handleStartGame = (lgId, teamId) => {
    // Hard reset runtime state so a "new game" can never inherit old season data.
    clearGameState()

    setActivePage('mailbox')
    setSelectedLeagueId(lgId)
    setTeamSelectionByLeague({ ...DEFAULT_TEAM_BY_LEAGUE, [lgId]: teamId })
    setSearchQuery('')
    setSelectedChampion(null)
    setSelectedRosterPlayer(null)

    setRosterProfiles({})
    setCurrentDate(new Date('2026-01-01T00:00:00'))
    setTrainingPlan({ ...DEFAULT_TRAINING_PLAN })
    setLeagueSchedules({})
    setMetaPatch('14.1')

    setTimeNotification('')
    setIsProcessing(false)
    setScoutingQueue(INITIAL_SCOUTING_QUEUE)
    setSynergyByTeam({})
    setDraftBonusByTeam({})
    setAggressivite(58)
    setRythmeJeu(52)
    setPrioriteObjectifs(47)
    setFocusJoueur('Miro')
    setSaveMessage('')

    setStaffTeam(DEFAULT_STAFF_TEAM)
    setMatchApproachById({})
    setMatchDraftById({})
    setMatchFlowStepById({})
    setLiveMatchSession(null)
    setLastMatchReport(null)

    setBudget(SEASON_START_BUDGET)
    setFinanceLedger([
      {
        id: 'seed-sponsor',
        label: 'Contrat initial - Fond saison',
        amount: SEASON_START_BUDGET,
        dateKey: '2026-01-01',
        type: 'credit',
      },
    ])
    setSponsorContracts(SPONSOR_CONTRACTS.map((sponsor) => ({ ...sponsor, status: 'active', progress: 0 })))
    setBoardObjectives(BOARD_OBJECTIVES.map((objective) => ({ ...objective, status: 'pending', progress: 0 })))
    setGameOver(null)
    setMetaPatchState({
      version: '14.1',
      boostedArchetype: META_PATCH_ARCHETYPES[0],
      nerfedArchetype: META_PATCH_ARCHETYPES[1],
      boostedChampions: [],
      nerfedChampions: [],
    })
    setPatchHistory([])
    setTransferMarket(buildTransferMarketFromPool(null, 8))
    setMatchHistory([])
    setNewsFeed([])
    setLastNewsWeekIndex(-1)
    setPendingDecision(null)
    setMailboxReadById({})
    setSelectedMailId(null)

    setGamePhase('game')
  }
  const handleContinueGame = () => {
    setActivePage('mailbox')
    setGamePhase('game')
  }
  const handleNewGame = () => {
    clearGameState()
    window.location.reload()
  }

  useEffect(() => {
    if (gamePhase !== 'game') return
    const tid = setTimeout(() => {
      saveGameState({
        gamePhase,
        selectedLeagueId,
        teamSelectionByLeague,
        rosterProfiles,
        currentDate,
        trainingPlan,
        leagueSchedules,
        metaPatch,
        scoutingQueue,
        synergyByTeam,
        draftBonusByTeam,
        aggressivite,
        rythmeJeu,
        prioriteObjectifs,
        focusJoueur,
        staffTeam,
        matchApproachById,
        matchDraftById,
        lastMatchReport,
        budget,
        financeLedger,
        sponsorContracts,
        boardObjectives,
        gameOver,
        metaPatchState,
        transferMarket,
        matchHistory,
        newsFeed,
        lastNewsWeekIndex,
        pendingDecision,
        mailboxReadById,
        selectedMailId,
      })
    }, 1500)
    return () => clearTimeout(tid)
  }, [
    gamePhase, selectedLeagueId, teamSelectionByLeague, rosterProfiles, currentDate,
    trainingPlan, leagueSchedules, metaPatch, scoutingQueue, synergyByTeam,
    draftBonusByTeam, aggressivite, rythmeJeu, prioriteObjectifs, focusJoueur,
    staffTeam, matchApproachById, matchDraftById, lastMatchReport, budget,
    financeLedger, sponsorContracts, boardObjectives, gameOver, metaPatchState,
    transferMarket, matchHistory, newsFeed, lastNewsWeekIndex, pendingDecision,
    mailboxReadById, selectedMailId,
  ])

  // ─── Weekly events rolling ──────────────────────────────────────────────
  // Triggered on currentDate change. Rolls random events for each player once
  // per calendar week. Applies effects (condition, moral, budget, LP, stat bonuses)
  // directly to the relevant states and prepends events to the news feed.
  useEffect(() => {
    if (gamePhase !== 'game') return
    const currentWeek = getWeekIndex(currentDate)
    if (currentWeek <= lastNewsWeekIndex) return

    // Build a light roster payload for event rolling (playerId, pseudo, traits)
    const rosterForEvents = baseRosterPlayers.map((player) => {
      const profile = rosterProfiles[player.playerId] ?? baseRosterProfiles[player.playerId]
      return {
        playerId: player.playerId,
        pseudo: profile?.pseudo ?? player.joueur,
        traits: profile?.traits ?? baseRosterProfiles[player.playerId]?.traits ?? [],
      }
    })

    const events = rollWeeklyEventsForRoster(rosterForEvents, {
      seed: `${selectedLeagueId}-${activeTeamId ?? 'none'}`,
      weekIndex: currentWeek,
    })

    if (events.length > 0) {
      // Apply effects in a single batch
      let totalBudgetDelta = 0
      const budgetLedgerEntries = []
      const profileUpdates = {}

      for (const evt of events) {
        const fx = evt.effects ?? {}
        if (fx.budgetDelta) {
          totalBudgetDelta += fx.budgetDelta
          budgetLedgerEntries.push({
            id: `event-${evt.id}`,
            label: evt.headline,
            amount: fx.budgetDelta,
            date: currentDate.toISOString(),
          })
        }
        if (fx.playerId) {
          const prev = profileUpdates[fx.playerId] ?? {}
          profileUpdates[fx.playerId] = {
            conditionDelta: (prev.conditionDelta ?? 0) + (fx.conditionDelta ?? 0) + (fx.moralDelta ?? 0) * 3,
            ladderLpDelta: (prev.ladderLpDelta ?? 0) + (fx.ladderLpDelta ?? 0),
            stats: {
              mechanics: (prev.stats?.mechanics ?? 0) + (fx.stats?.mechanics ?? 0),
              teamfight: (prev.stats?.teamfight ?? 0) + (fx.stats?.teamfight ?? 0),
              macro:     (prev.stats?.macro     ?? 0) + (fx.stats?.macro     ?? 0),
            },
          }
        }
      }

      if (totalBudgetDelta !== 0) {
        setBudget((prev) => prev + totalBudgetDelta)
        setFinanceLedger((prev) => [...budgetLedgerEntries, ...prev].slice(0, 40))
      }

      if (Object.keys(profileUpdates).length > 0) {
        setRosterProfiles((prev) => {
          const next = { ...prev }
          for (const [playerId, delta] of Object.entries(profileUpdates)) {
            const base = next[playerId] ?? baseRosterProfiles[playerId]
            if (!base) continue
            const nextCondition = clamp((base.condition ?? 70) + delta.conditionDelta, 20, 100)
            const nextLp = clamp((base.ladderLP ?? 800) + delta.ladderLpDelta, 0, 1800)
            next[playerId] = {
              ...base,
              condition: nextCondition,
              moral: moraleFromCondition(nextCondition),
              ladderLP: nextLp,
              mechanicsBonus: (base.mechanicsBonus ?? 0) + delta.stats.mechanics,
              teamfightBonus: (base.teamfightBonus ?? 0) + delta.stats.teamfight,
              macroBonus:     (base.macroBonus     ?? 0) + delta.stats.macro,
            }
          }
          return next
        })
      }

      setNewsFeed((prev) => [...events, ...prev].slice(0, 50))
    }

    // Roll a decision event (~30% chance) only if none is currently pending
    if (!pendingDecision) {
      const decision = rollWeeklyDecision(rosterForEvents, {
        seed: `${selectedLeagueId}-${activeTeamId ?? 'none'}`,
        weekIndex: currentWeek,
      })
      if (decision) {
        setPendingDecision(decision)
      }
    }

    setLastNewsWeekIndex(currentWeek)
    // Intentionally scoped deps: we only want this to fire on date/phase change.
    // All other references (baseRosterPlayers, rosterProfiles, etc.) are captured
    // via closure and intentionally left out to avoid re-rolling mid-week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, gamePhase])

  const activeLeague = LEAGUES[selectedLeagueId]
  const standings = getLeagueStandings(selectedLeagueId)
  const worldRanking = getWorldPowerRanking(10)
  const leagueProPlayers = useMemo(() => PRO_PLAYERS_BY_LEAGUE[selectedLeagueId] ?? [], [selectedLeagueId])
  const selectedTeamId = teamSelectionByLeague[selectedLeagueId] ?? null
  const leagueDefaultTeamId = DEFAULT_TEAM_BY_LEAGUE[selectedLeagueId] ?? leagueProPlayers[0]?.team_id ?? null

  // Always preserve the user's selected team identity.
  // If no explicit selection exists yet, fallback to league default.
  const activeTeamId = selectedTeamId ?? leagueDefaultTeamId

  const baseRosterPlayers = useMemo(
    () => {
      if (!activeTeamId || leagueProPlayers.length === 0) {
        return joueurs.map(mapFallbackPlayerToRosterRow)
      }

      const selectedLeagueRoster = leagueProPlayers
        .filter((player) => player.team_id === activeTeamId)
        .map(mapProPlayerToRosterRow)

      // Some teams exist in TEAMS_BY_LEAGUE but have no seeded pro roster yet.
      // Keep the chosen team and fallback to generated players instead of switching teams.
      return selectedLeagueRoster.length > 0
        ? selectedLeagueRoster
        : joueurs.map(mapFallbackPlayerToRosterRow)
    },
    [activeTeamId, leagueProPlayers],
  )

  const baseRosterProfiles = useMemo(() => buildInitialRosterProfiles(baseRosterPlayers), [baseRosterPlayers])
  const activeTeamName = activeTeamId ? getTeamNameByLeagueAndId(selectedLeagueId, activeTeamId) : 'Equipe inconnue'
  const scheduleKey = `${selectedLeagueId}:${activeTeamId ?? 'none'}`
  const generatedSchedule = buildSeasonSchedule(selectedLeagueId, activeTeamName)
  const activeSchedule = leagueSchedules[scheduleKey] ?? generatedSchedule
  const leagueTeamCalendars = (TEAMS_BY_LEAGUE[selectedLeagueId] ?? []).map((team) => {
    const teamScheduleKey = `${selectedLeagueId}:${team.id}`
    return {
      teamId: team.id,
      teamName: team.name,
      schedule: leagueSchedules[teamScheduleKey] ?? buildSeasonSchedule(selectedLeagueId, team.name),
    }
  })
  const todayKey = toDateKey(currentDate)
  const matchToday = activeSchedule.find((match) => match.status === 'upcoming' && match.dateKey === todayKey) ?? null
  const seasonProgress = computeSeasonProgress(activeSchedule, currentDate)
  const activeSynergy = synergyByTeam[scheduleKey] ?? 62
  const activeDraftBonus = draftBonusByTeam[scheduleKey] ?? 0
  const activeRosterPlayerId =
    baseRosterPlayers.some((player) => player.playerId === selectedRosterPlayer)
      ? selectedRosterPlayer
      : baseRosterPlayers[0]?.playerId ?? null

  const effectifAvecBonusTier = useMemo(
    () =>
      applyLeagueTierBonusToPlayers(baseRosterPlayers, activeLeague).map((player) => {
        const profile = rosterProfiles[player.playerId] ?? baseRosterProfiles[player.playerId]
        // Traits fallback: legacy saves may lack them → regenerate from base profile
        const traits = profile?.traits ?? baseRosterProfiles[player.playerId]?.traits ?? []
        const traitBonuses = getTraitStatBonuses(traits)
        return {
          ...player,
          teamfight: clamp(player.teamfight + (profile?.teamfightBonus ?? 0) + traitBonuses.teamfight, 1, 99),
          mechanics: clamp(player.mechanics + (profile?.mechanicsBonus ?? 0) + traitBonuses.mechanics, 1, 99),
          macro:     clamp(player.macro     + (profile?.macroBonus     ?? 0) + traitBonuses.macro,     1, 99),
          laning:    clamp(player.laning    + traitBonuses.laning,                                     1, 99),
          mental:    clamp((profile?.mental ?? player.mental ?? 14) + traitBonuses.mental,             1, 20),
          moral: profile?.moral ?? player.moral,
          forme: profile ? (profile.condition / 10).toFixed(1) : player.forme,
          traits,
        }
      }),
    [baseRosterPlayers, rosterProfiles, baseRosterProfiles, activeLeague],
  )
  const selectedPlayerData = effectifAvecBonusTier.find((player) => player.playerId === activeRosterPlayerId) ?? null
  const selectedPlayerProfile = selectedPlayerData
    ? (rosterProfiles[selectedPlayerData.playerId] ?? baseRosterProfiles[selectedPlayerData.playerId])
    : null
  const soloQEuropeRanking = useMemo(() => buildEuropeSoloQRanking(PRO_PLAYERS, rosterProfiles), [rosterProfiles])
  const soloQPreview = soloQEuropeRanking.slice(0, 5)
  const selectedMatchApproachId =
    matchToday ? (matchApproachById[matchToday.id] ?? DEFAULT_MATCH_APPROACH_ID) : DEFAULT_MATCH_APPROACH_ID
  const activeMatchFlowStep = matchToday ? (matchFlowStepById[matchToday.id] ?? 1) : 1
  const analystLevel = clamp(staffTeam.dataAnalyst ?? 0, 0, STAFF_MAX_LEVEL)
  const headScoutLevel = clamp(staffTeam.headScout ?? 0, 0, STAFF_MAX_LEVEL)
  const mentalCoachLevel = clamp(staffTeam.mentalCoach ?? 0, 0, STAFF_MAX_LEVEL)
  const staffMonthlyCost = computeStaffMonthlyCost(staffTeam)
  const opponentPower = matchToday ? computeOpponentPower(matchToday.opponent, standings) : 72
  const preMatchPrediction = matchToday
    ? computePreMatchPrediction({
        roster: effectifAvecBonusTier,
        synergy: activeSynergy,
        draftBonus: activeDraftBonus,
        aggressivite,
        rythmeJeu,
        prioriteObjectifs,
        opponentPower,
        approachId: selectedMatchApproachId,
      })
    : {
        baseWinRate: 50,
        projectedWinRate: 50,
        opponentPower: 72,
        analystNote: 'Pas de match aujourd hui.',
      }
  const opponentTeamId = matchToday ? findTeamIdForLeague(selectedLeagueId, matchToday.opponent) : null
  const opponentRoster = opponentTeamId ? leagueProPlayers.filter((player) => player.team_id === opponentTeamId) : []
  const opponentComfortPool = buildOpponentComfortPool(opponentRoster)
  const playerComfortPool = buildPlayerComfortPool(effectifAvecBonusTier, rosterProfiles, baseRosterProfiles)
  const activeDraftState = matchToday ? (matchDraftById[matchToday.id] ?? createEmptyDraftState()) : createEmptyDraftState()
  const enemyBans = matchToday
    ? buildEnemyBansFromComfortPool(matchToday.id, playerComfortPool, activeDraftState.bans, activeDraftState)
    : []
  const activeDraftScoreCard = matchToday
    ? computeDraftNoLuckScore({
        draftState: activeDraftState,
        opponentComfortPool,
        enemyBans,
        roster: effectifAvecBonusTier,
        rosterProfiles,
        baseRosterProfiles,
      })
    : {
        score: 0,
        banImpact: 0,
        enemyBanImpact: 0,
        comfortImpact: 0,
        counterImpact: 0,
        synergyImpact: 0,
        comfortBanHits: 0,
        enemyBanHits: 0,
        isComplete: false,
      }
  const activeDraftPunishment = matchToday
    ? applyMentalCoachToPunishmentProfile(
        computeDraftPunishmentProfile({
          draftState: activeDraftState,
          roster: effectifAvecBonusTier,
          rosterProfiles,
          baseRosterProfiles,
        }),
        mentalCoachLevel,
        preMatchPrediction.opponentPower >= 86,
      )
    : {
        byRole: {},
        fatalRiskByRole: {},
        averagePenalty: 0,
        lowMasteryCount: 0,
        severeMismatchCount: 0,
      }
  const rawDraftProjectedWinRate = computeProjectedWinRateWithDraft(
    preMatchPrediction.projectedWinRate,
    activeDraftScoreCard.score,
    activeDraftPunishment,
  )
  const draftProjectedWinRate = clamp(
    applyAnalystPrecision(rawDraftProjectedWinRate, analystLevel, `${matchToday?.id ?? 'no-match'}-projected-draft`, 1),
    3,
    96,
  )
  const visibleDraftScore = clamp(
    applyAnalystPrecision(activeDraftScoreCard.score, analystLevel, `${matchToday?.id ?? 'no-match'}-draft-score`, 1),
    -35,
    35,
  )
  const visibleDraftScoreCard = {
    ...activeDraftScoreCard,
    score: visibleDraftScore,
  }
  const visibleBaseWinRate = clamp(
    applyAnalystPrecision(preMatchPrediction.baseWinRate, analystLevel, `${matchToday?.id ?? 'no-match'}-base-winrate`, 1),
    5,
    95,
  )
  const visibleProjectedWinRate = clamp(
    applyAnalystPrecision(preMatchPrediction.projectedWinRate, analystLevel, `${matchToday?.id ?? 'no-match'}-plan-winrate`, 1),
    5,
    95,
  )
  const readinessScore = clamp(
    Math.round(
      (aggressivite * 0.22) +
        (rythmeJeu * 0.18) +
        (prioriteObjectifs * 0.12) +
        (activeSynergy * 0.34) +
        (activeDraftBonus * 1.6),
    ),
    0,
    100,
  )
  const readinessLabel =
    readinessScore >= 75
      ? 'Fenetre ideale pour imposer votre plan de jeu.'
      : readinessScore >= 60
        ? 'Etat competitif correct, execution propre necessaire.'
        : 'Preparation fragile, attention au debut de partie.'
  const dashboardMatchInsights = matchToday
    ? {
      baseWinRate: visibleBaseWinRate,
      projectedWinRate: visibleProjectedWinRate,
        opponentPower: preMatchPrediction.opponentPower,
        analystNote: preMatchPrediction.analystNote,
        draftScoreCard: visibleDraftScoreCard,
        draftProjectedWinRate,
        readinessScore,
        readinessLabel,
        focusJoueur,
        analystLevel,
      }
    : null
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const pageResults = normalizedQuery
    ? pageDirectory
        .filter((item) => item.label.toLowerCase().includes(normalizedQuery))
        .slice(0, 5)
        .map((item) => ({
          key: `page-${item.id}`,
          label: item.label,
          meta: 'Ecran',
          onSelect: () => {
            setActivePage(item.id)
            setSelectedChampion(null)
            setSearchQuery('')
          },
        }))
    : []

  const leagueResults = normalizedQuery
    ? Object.values(LEAGUES)
        .filter(
          (league) =>
            league.name.toLowerCase().includes(normalizedQuery) ||
            league.region.toLowerCase().includes(normalizedQuery) ||
            league.id.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 4)
        .map((league) => ({
          key: `league-${league.id}`,
          label: `${league.flag} ${league.name}`,
          meta: `Ligue - ${league.region}`,
          onSelect: () => {
            setSelectedLeagueId(league.id)
            setActivePage('championnat')
            setSelectedChampion(null)
            setSearchQuery('')
          },
        }))
    : []

  const teamResults = normalizedQuery
    ? Object.entries(TEAMS_BY_LEAGUE)
        .flatMap(([leagueId, teams]) =>
          teams.map((team) => ({ leagueId, name: team.name })),
        )
        .filter((team) => team.name.toLowerCase().includes(normalizedQuery))
        .slice(0, 5)
        .map((team) => ({
          key: `team-${team.leagueId}-${team.name}`,
          label: team.name,
          meta: `Equipe - ${LEAGUES[team.leagueId].name}`,
          onSelect: () => {
            handleOpenTeamRoster(team.leagueId, team.name)
            setSearchQuery('')
          },
        }))
    : []

  const championResults = normalizedQuery
    ? CHAMPIONS_DB.filter((champion) => {
        const haystack = [champion.name, champion.id, champion.role, ...champion.tags].join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
      })
        .slice(0, 6)
        .map((champion) => ({
          key: `champion-${champion.id}-${champion.role}`,
          label: champion.name,
          meta: `Champion - ${champion.role}`,
          onSelect: () => {
            setSelectedChampion(champion)
            setSearchQuery('')
          },
        }))
    : []

  const searchResults = [...championResults, ...pageResults, ...leagueResults, ...teamResults].slice(0, 10)

  const mailboxMails = useMemo(() => {
    const now = currentDate instanceof Date ? currentDate.getTime() : new Date(currentDate).getTime()
    const currentDateLabel = formatDateLong(currentDate)
    const items = []

    if (pendingDecision) {
      items.push({
        id: `decision-${pendingDecision.id}`,
        from: 'Direction sportive',
        subject: pendingDecision.headline ?? 'Decision en attente',
        preview: pendingDecision.prompt ?? 'Votre validation est requise pour poursuivre la saison.',
        body: pendingDecision.prompt ?? 'Un choix du staff est requis avant la prochaine etape.',
        icon: '🧭',
        priority: 'urgent',
        dateLabel: `Semaine ${(pendingDecision.weekIndex ?? 0) + 1}`,
        targetPage: 'dashboard',
        ctaLabel: 'Voir le contexte',
        sortKey: now + 1200,
      })
    }

    if (matchToday) {
      items.push({
        id: `match-day-${matchToday.id}`,
        from: 'Coach principal',
        subject: `Jour de match: ${activeTeamName} vs ${matchToday.opponent}`,
        preview: 'Le staff attend votre plan de jeu et la validation de la draft.',
        body: `Le match est programme pour aujourd hui contre ${matchToday.opponent}. Passe en Match Day pour finaliser les reglages.`,
        icon: '🎯',
        priority: 'high',
        dateLabel: currentDateLabel,
        targetPage: 'match-day',
        ctaLabel: 'Aller en Match Day',
        sortKey: now + 1000,
      })
    }

    if (lastMatchReport) {
      items.push({
        id: `report-${lastMatchReport.matchId}`,
        from: 'Cellule analytique',
        subject: `${lastMatchReport.teamWon ? 'Victoire' : 'Defaite'} vs ${lastMatchReport.opponentName}`,
        preview: `Serie ${lastMatchReport.seriesScore} · MVP ${lastMatchReport.mvp?.playerName ?? 'N/A'}`,
        body: `Compte-rendu disponible: ${lastMatchReport.teamName} ${lastMatchReport.seriesScore} ${lastMatchReport.opponentName}. Analyse complete dans le dashboard.`,
        icon: lastMatchReport.teamWon ? '🏆' : '📉',
        priority: 'normal',
        dateLabel: currentDateLabel,
        targetPage: 'dashboard',
        ctaLabel: 'Lire le rapport',
        sortKey: now + 700,
      })
    }

    boardObjectives
      .filter((objective) => objective.status !== 'completed')
      .slice(0, 3)
      .forEach((objective, index) => {
        items.push({
          id: `board-${objective.id}`,
          from: 'Board management',
          subject: `Objectif: ${objective.label}`,
          preview: `Recompense potentielle: ${formatBudgetShort(objective.reward ?? 0)}.`,
          body: `Le board suit cet objectif de pres. Statut actuel: ${objective.status ?? 'pending'}.`,
          icon: '📌',
          priority: index === 0 ? 'high' : 'normal',
          dateLabel: 'Saison en cours',
          targetPage: 'finances',
          ctaLabel: 'Voir finances et objectifs',
          sortKey: now + (500 - index),
        })
      })

    sponsorContracts
      .filter((contract) => contract.status === 'active')
      .slice(0, 2)
      .forEach((contract, index) => {
        items.push({
          id: `sponsor-${contract.id}`,
          from: contract.label,
          subject: `Contrat actif: ${contract.label}`,
          preview: `Versement mensuel: ${formatBudgetShort(contract.monthly ?? 0)}.`,
          body: `Suivi sponsor en cours. Cible bonus: ${contract.target?.type ?? 'objectif'} (${contract.target?.value ?? '-'}) pour ${formatBudgetShort(contract.target?.bonus ?? 0)}.`,
          icon: '💼',
          priority: 'normal',
          dateLabel: 'Partenariat',
          targetPage: 'finances',
          ctaLabel: 'Ouvrir finances',
          sortKey: now + (300 - index),
        })
      })

    if (timeNotification) {
      items.push({
        id: `system-time-${todayKey}`,
        from: 'Systeme de ligue',
        subject: 'Mise a jour du jour',
        preview: timeNotification,
        body: timeNotification,
        icon: '⏱️',
        priority: 'normal',
        dateLabel: currentDateLabel,
        sortKey: now + 200,
      })
    }

    if (saveMessage) {
      items.push({
        id: `system-save-${todayKey}`,
        from: 'Systeme',
        subject: 'Etat enregistre',
        preview: saveMessage,
        body: saveMessage,
        icon: '💾',
        priority: 'normal',
        dateLabel: currentDateLabel,
        sortKey: now + 150,
      })
    }

    newsFeed.slice(0, 20).forEach((evt, index) => {
      const categoryPriority = evt.category === 'negative' ? 'high' : 'normal'
      items.push({
        id: `news-${evt.id}`,
        from: 'Media & scene',
        subject: evt.headline,
        preview: evt.body,
        body: evt.body,
        icon: evt.icon ?? '📰',
        priority: categoryPriority,
        dateLabel: `Semaine ${(evt.weekIndex ?? 0) + 1}`,
        sortKey: Number.isFinite(evt.timestamp) ? evt.timestamp : now - (1000 + index),
      })
    })

    const deduped = Array.from(new Map(items.map((item) => [item.id, item])).values())

    const priorityOrder = { urgent: 3, high: 2, normal: 1 }
    const ordered = deduped.sort((a, b) => {
      const p = (priorityOrder[b.priority] ?? 1) - (priorityOrder[a.priority] ?? 1)
      if (p !== 0) return p
      return (b.sortKey ?? 0) - (a.sortKey ?? 0)
    })

    return ordered.map((mail) => ({
      ...mail,
      unread: !mailboxReadById[mail.id],
    }))
  }, [
    currentDate,
    pendingDecision,
    matchToday,
    activeTeamName,
    lastMatchReport,
    boardObjectives,
    sponsorContracts,
    timeNotification,
    saveMessage,
    newsFeed,
    todayKey,
    mailboxReadById,
  ])

  const mailboxUnreadCount = mailboxMails.filter((mail) => mail.unread).length

  useEffect(() => {
    if (!mailboxMails.length) {
      if (selectedMailId !== null) {
        setSelectedMailId(null)
      }
      return
    }

    const selectionExists = selectedMailId ? mailboxMails.some((mail) => mail.id === selectedMailId) : false
    if (!selectionExists) {
      const firstUnread = mailboxMails.find((mail) => mail.unread)
      setSelectedMailId((firstUnread ?? mailboxMails[0]).id)
    }
  }, [mailboxMails, selectedMailId])

  const handleSelectMailboxMail = (mailId) => {
    setSelectedMailId(mailId)
    setMailboxReadById((prev) => {
      if (prev[mailId]) return prev
      return {
        ...prev,
        [mailId]: true,
      }
    })
  }

  const handleMarkAllMailboxRead = () => {
    if (!mailboxMails.length) return
    setMailboxReadById((prev) => {
      const next = { ...prev }
      mailboxMails.forEach((mail) => {
        next[mail.id] = true
      })
      return next
    })
  }

  const handleSaveTactique = () => {
    setSaveMessage('Tactique sauvegardee - preset operationnel pour le prochain match.')
  }

  const handleOpenPlayerProfile = (playerId) => {
    setSelectedRosterPlayer(playerId)
    setSelectedChampion(null)
    setActivePage('profil-joueur')
  }

  const handleResolveDecision = (choiceId) => {
    if (!pendingDecision) return
    const choice = pendingDecision.choices.find((c) => c.id === choiceId)
    if (!choice) return

    const fx = choice.effects ?? {}
    const totalConditionDelta = (fx.conditionDelta ?? 0) + (fx.moralDelta ?? 0) * 3

    // Budget
    if (fx.budgetDelta) {
      setBudget((prev) => prev + fx.budgetDelta)
      setFinanceLedger((prev) => [{
        id: `decision-${pendingDecision.id}-${choiceId}`,
        label: pendingDecision.headline,
        amount: fx.budgetDelta,
        date: currentDate.toISOString(),
      }, ...prev].slice(0, 40))
    }

    // Player-targeted effects
    if (fx.playerId) {
      setRosterProfiles((prev) => {
        const base = prev[fx.playerId] ?? baseRosterProfiles[fx.playerId]
        if (!base) return prev
        const nextCondition = clamp((base.condition ?? 70) + totalConditionDelta, 20, 100)
        const nextLp = clamp((base.ladderLP ?? 800) + (fx.ladderLpDelta ?? 0), 0, 1800)
        return {
          ...prev,
          [fx.playerId]: {
            ...base,
            condition: nextCondition,
            moral: moraleFromCondition(nextCondition),
            ladderLP: nextLp,
            mechanicsBonus: (base.mechanicsBonus ?? 0) + (fx.stats?.mechanics ?? 0),
            teamfightBonus: (base.teamfightBonus ?? 0) + (fx.stats?.teamfight ?? 0),
            macroBonus:     (base.macroBonus     ?? 0) + (fx.stats?.macro     ?? 0),
          },
        }
      })
    }

    // Push the outcome to news feed so it leaves a trace
    const outcomeEntry = {
      id: `decision-outcome-${pendingDecision.id}-${choiceId}`,
      eventId: pendingDecision.templateId,
      category: 'neutral',
      icon: pendingDecision.icon,
      headline: `${pendingDecision.headline} — ${choice.label}`,
      body: choice.summary ?? choice.description ?? '',
      effects: fx,
      weekIndex: pendingDecision.weekIndex,
      timestamp: Date.now(),
    }
    setNewsFeed((prev) => [outcomeEntry, ...prev].slice(0, 50))

    setPendingDecision(null)
  }

  const handleOpenSoloQLadder = () => {
    setSelectedChampion(null)
    setActivePage('soloq-europe')
  }

  const handleOpenPlayerProfileFromLadder = (ladderPlayer) => {
    if (!ladderPlayer) {
      return
    }

    setSelectedLeagueId(ladderPlayer.leagueId)
    setTeamSelectionByLeague((previous) => ({
      ...previous,
      [ladderPlayer.leagueId]: ladderPlayer.teamId,
    }))
    setSelectedRosterPlayer(ladderPlayer.id)
    setSelectedChampion(null)
    setActivePage('profil-joueur')
  }

  const handleOpenTeamRoster = (leagueId, teamName) => {
    const resolvedTeamId = findTeamIdForLeague(leagueId, teamName)

    setSelectedLeagueId(leagueId)
    if (resolvedTeamId) {
      setTeamSelectionByLeague((previous) => ({
        ...previous,
        [leagueId]: resolvedTeamId,
      }))
    }

    setSelectedChampion(null)
    setActivePage('effectif')
  }

  const handleTrainChampion = (playerId, championKey) => {
    setRosterProfiles((previous) => {
      const profile = previous[playerId] ?? baseRosterProfiles[playerId]
      if (!profile) {
        return previous
      }

      const currentMastery = profile.championMastery[championKey] ?? 10
      const nextMastery = clamp(currentMastery + 4, 1, 100)
      const nextCondition = clamp(profile.condition - 3, 20, 100)
      const updatedHistory = ['V', ...profile.matchHistory.slice(0, 3)]

      return {
        ...previous,
        [playerId]: {
          ...profile,
          moral: moraleFromCondition(nextCondition),
          condition: nextCondition,
          matchHistory: updatedHistory,
          championMastery: {
            ...profile.championMastery,
            [championKey]: nextMastery,
          },
        },
      }
    })
  }

  const handleUpgradeStaff = (staffId) => {
    const config = STAFF_CATALOG[staffId]
    if (!config) {
      return
    }

    const currentLevel = clamp(staffTeam[staffId] ?? 0, 0, STAFF_MAX_LEVEL)
    if (currentLevel >= STAFF_MAX_LEVEL) {
      return
    }
    // Signing bonus: 2 months of the new monthly cost
    const nextLevel = currentLevel + 1
    const monthlyNext = config.monthlyCostByLevel[nextLevel] ?? 0
    const signingCost = monthlyNext * 2

    if (budget < signingCost) {
      setTimeNotification(`Fonds insuffisants pour recruter ${config.label} (${formatBudgetShort(signingCost)} requis).`)
      return
    }

    setBudget((previous) => previous - signingCost)
    setFinanceLedger((previous) => [
      {
        id: `staff-signing-${staffId}-${Date.now()}`,
        label: `Prime signature ${config.label} niv ${nextLevel}`,
        amount: -signingCost,
        date: currentDate.toISOString(),
      },
      ...previous,
    ].slice(0, 40))

    setStaffTeam((previous) => {
      const existing = clamp(previous[staffId] ?? 0, 0, STAFF_MAX_LEVEL)
      if (existing >= STAFF_MAX_LEVEL) {
        return previous
      }
      setTimeNotification(`${config.label} recrute/upgrade niveau ${existing + 1}. ${config.role}. Prime ${formatBudgetShort(signingCost)}.`)
      return {
        ...previous,
        [staffId]: existing + 1,
      }
    })
  }

  const handleSignPlayer = (playerId) => {
    const target = transferMarket.find((entry) => entry.id === playerId)
    if (!target || target.signed) {
      return
    }
    if (budget < target.askingPrice) {
      setTimeNotification(`Fonds insuffisants pour signer ${target.pseudo} (${formatBudgetShort(target.askingPrice)} requis).`)
      return
    }

    setBudget((previous) => previous - target.askingPrice)
    setFinanceLedger((previous) => [
      {
        id: `signing-${target.id}-${Date.now()}`,
        label: `Signature ${target.pseudo} (${target.role})`,
        amount: -target.askingPrice,
        date: currentDate.toISOString(),
      },
      ...previous,
    ].slice(0, 40))

    setTransferMarket((previous) =>
      previous.map((entry) => (entry.id === target.id ? { ...entry, signed: true } : entry)),
    )

    // Add signed player to roster profile overrides so he is counted in the active roster
    setRosterProfiles((previous) => ({
      ...previous,
      [target.id]: {
        ...(previous[target.id] ?? {}),
        pseudo: target.pseudo,
        realName: target.realName,
        age: target.age,
        nationality: 'Inconnue',
        marketValue: formatEuroValue(target.askingPrice),
        condition: 72,
        moral: 'Bon',
        ladderLP: 850,
        confident: false,
        teamfightBonus: 0,
        mechanicsBonus: 0,
        macroBonus: 0,
        visionBonus: 0,
        draftBonus: 0,
        synergyBonus: 0,
        potential: target.potential,
        matchHistory: ['V', 'D', 'V'],
        championMastery: {},
      },
    }))

    setTimeNotification(`Signature: ${target.pseudo} (${target.role}) rejoint l'equipe pour ${formatBudgetShort(target.askingPrice)}.`)
  }

  const handleLaunchScout = () => {
    // Add a new scouting task to the queue
    const scoutSeed = stableHash(`scout-${Date.now()}`)
    const leagues = ['LCK', 'LPL', 'LCS', 'LEC']
    const roles = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
    const newTask = {
      player: `Prospect-${(scoutSeed % 900) + 100}`,
      role: roles[scoutSeed % roles.length],
      league: leagues[scoutSeed % leagues.length],
      daysRemaining: 3,
    }
    setScoutingQueue((previous) => [...previous, newTask].slice(0, 6))
    setTimeNotification(`Scout lance sur ${newTask.player} (${newTask.role}, ${newTask.league}).`)
  }

  const handleApplyWeeklyTraining = ({ players }) => {
    if (!players?.length) {
      return
    }

    setRosterProfiles((previous) => {
      const next = { ...previous }

      players.forEach((playerUpdate) => {
        const existing = next[playerUpdate.playerId] ?? baseRosterProfiles[playerUpdate.playerId]
        if (!existing) {
          return
        }

        next[playerUpdate.playerId] = {
          ...existing,
          condition: playerUpdate.fitness,
          moral: playerUpdate.moral,
          ladderLP: playerUpdate.ladderLP,
          confident: playerUpdate.hasConfidentTrait,
          mental: playerUpdate.mental,
        }
      })

      return next
    })
  }

  const handleResolveMatch = (matchId) => {
    if (!matchId) {
      return
    }

    const match = activeSchedule.find((item) => item.id === matchId)
    if (!match) {
      return
    }

    const selectedApproachId = matchApproachById[match.id] ?? DEFAULT_MATCH_APPROACH_ID
    const selectedApproach = getMatchApproachById(selectedApproachId)
    const opponentTeamIdForMatch = findTeamIdForLeague(selectedLeagueId, match.opponent)
    const opponentRosterForMatch = opponentTeamIdForMatch
      ? leagueProPlayers.filter((player) => player.team_id === opponentTeamIdForMatch)
      : []
    const opponentComfortPoolForMatch = buildOpponentComfortPool(opponentRosterForMatch)
    const draftStateForMatch = matchDraftById[match.id] ?? createEmptyDraftState()
    const playerComfortPoolForMatch = buildPlayerComfortPool(effectifAvecBonusTier, rosterProfiles, baseRosterProfiles)
    const enemyBansForMatch = buildEnemyBansFromComfortPool(
      match.id,
      playerComfortPoolForMatch,
      draftStateForMatch.bans,
      draftStateForMatch,
    )
    const draftScoreForMatch = computeDraftNoLuckScore({
      draftState: draftStateForMatch,
      opponentComfortPool: opponentComfortPoolForMatch,
      enemyBans: enemyBansForMatch,
      roster: effectifAvecBonusTier,
      rosterProfiles,
      baseRosterProfiles,
    })
    const opponentPowerForMatch = computeOpponentPower(match.opponent, standings)
    const draftPunishmentForMatch = applyMentalCoachToPunishmentProfile(
      computeDraftPunishmentProfile({
        draftState: draftStateForMatch,
        roster: effectifAvecBonusTier,
        rosterProfiles,
        baseRosterProfiles,
      }),
      mentalCoachLevel,
      opponentPowerForMatch >= 86,
    )
    const matchPrediction = computePreMatchPrediction({
      roster: effectifAvecBonusTier,
      synergy: activeSynergy,
      draftBonus: activeDraftBonus,
      aggressivite,
      rythmeJeu,
      prioriteObjectifs,
      opponentPower: opponentPowerForMatch,
      approachId: selectedApproachId,
    })
    const projectedWithDraft = computeProjectedWinRateWithDraft(
      matchPrediction.projectedWinRate,
      draftScoreForMatch.score,
      draftPunishmentForMatch,
    )
    const visibleProjectedWithDraft = clamp(
      applyAnalystPrecision(projectedWithDraft, analystLevel, `${match.id}-resolve-projected`, 1),
      3,
      96,
    )
    const visibleDraftScore = clamp(
      applyAnalystPrecision(draftScoreForMatch.score, analystLevel, `${match.id}-resolve-draft-score`, 1),
      -35,
      35,
    )

    const resultSeed = stableHash(`${matchId}-${currentDate.toISOString()}`) % 100
    const isWin = resultSeed < projectedWithDraft
    const score =
      match.seriesType === 'BO1'
        ? isWin ? '1-0' : '0-1'
        : isWin ? (resultSeed % 2 === 0 ? '2-0' : '2-1') : (resultSeed % 2 === 0 ? '0-2' : '1-2')

    setLeagueSchedules((previous) => {
      const current = previous[scheduleKey] ?? generatedSchedule
      const teamSchedule = current.map((item) =>
        item.id === matchId
          ? {
            ...item,
            status: 'played',
            result: `${isWin ? 'V' : 'D'} ${score}`,
          }
          : item,
      )

      const withTeamSchedule = {
        ...previous,
        [scheduleKey]: teamSchedule,
      }

      return applyMirroredResultToOpponentSchedule({
        schedules: withTeamSchedule,
        leagueId: selectedLeagueId,
        teamName: activeTeamName,
        opponentName: match.opponent,
        dateKey: match.dateKey,
        stage: match.stage,
        isTeamWin: isWin,
        score,
      })
    })

    setMatchApproachById((previous) => {
      if (!previous[matchId]) {
        return previous
      }

      const next = { ...previous }
      delete next[matchId]
      return next
    })

    setMatchDraftById((previous) => {
      if (!previous[matchId]) {
        return previous
      }

      const next = { ...previous }
      delete next[matchId]
      return next
    })

    setTimeNotification(
      `Match resolu contre ${match.opponent} (${isWin ? 'Victoire' : 'Defaite'} ${score}). Plan: ${selectedApproach.label}. Draft ${visibleDraftScore >= 0 ? '+' : ''}${visibleDraftScore}. Projection finale: ${visibleProjectedWithDraft}%.`,
    )
  }

  const handleSelectMatchApproach = (matchId, approachId) => {
    if (!matchId) {
      return
    }

    setMatchApproachById((previous) => ({
      ...previous,
      [matchId]: approachId,
    }))
  }

  const setMatchFlowStep = (matchId, step) => {
    if (!matchId) {
      return
    }

    setMatchFlowStepById((previous) => ({
      ...previous,
      [matchId]: clamp(step, 1, MATCH_DAY_STEP_COUNT),
    }))
  }

  const handlePrevMatchStep = (matchId) => {
    if (!matchId) {
      return
    }

    setMatchFlowStepById((previous) => {
      const current = previous[matchId] ?? 1
      return {
        ...previous,
        [matchId]: clamp(current - 1, 1, MATCH_DAY_STEP_COUNT),
      }
    })
  }

  const handleNextMatchStep = (matchId) => {
    if (!matchId) {
      return
    }

    const targetMatch = activeSchedule.find((item) => item.id === matchId)
    if (targetMatch) {
      const opponentTeamIdForMatch = findTeamIdForLeague(selectedLeagueId, targetMatch.opponent)
      const opponentRosterForMatch = opponentTeamIdForMatch
        ? leagueProPlayers.filter((player) => player.team_id === opponentTeamIdForMatch)
        : []
      const opponentComfortPoolForMatch = buildOpponentComfortPool(opponentRosterForMatch)

      setMatchDraftById((previous) => {
        const current = previous[matchId] ?? createEmptyDraftState()
        let nextTurnIndex = current.pickTurnIndex ?? 0

        const canResumeAfterSecondBans =
          nextTurnIndex >= SECOND_BAN_TRIGGER_PICK_INDEX &&
          nextTurnIndex < DRAFT_PICK_SEQUENCE.length &&
          (current.bans?.length ?? 0) >= MAX_DRAFT_BANS

        if (!canResumeAfterSecondBans) {
          return previous
        }

        let nextEnemyPicks = { ...(current.enemyPicks ?? {}) }
        let changed = false

        while (nextTurnIndex < DRAFT_PICK_SEQUENCE.length && DRAFT_PICK_SEQUENCE[nextTurnIndex].side === 'red') {
          const redTurn = DRAFT_PICK_SEQUENCE[nextTurnIndex]
          nextEnemyPicks = buildEnemyDraftPicks({
            matchId,
            playerPicks: current.playerPicks,
            bans: current.bans,
            opponentComfortPool: opponentComfortPoolForMatch,
            existingEnemyPicks: nextEnemyPicks,
            rolesToFill: redTurn.roles,
          })
          nextTurnIndex += 1
          changed = true
        }

        if (!changed) {
          return previous
        }

        return {
          ...previous,
          [matchId]: {
            ...current,
            enemyPicks: nextEnemyPicks,
            pickTurnIndex: nextTurnIndex,
          },
        }
      })
    }

    setMatchFlowStepById((previous) => {
      const current = previous[matchId] ?? 1
      const currentDraftState = matchDraftById[matchId] ?? createEmptyDraftState()
      const waitingSecondBanPhase =
        (currentDraftState.pickTurnIndex ?? 0) >= SECOND_BAN_TRIGGER_PICK_INDEX &&
        (currentDraftState.pickTurnIndex ?? 0) < DRAFT_PICK_SEQUENCE.length &&
        (currentDraftState.bans?.length ?? 0) < MAX_DRAFT_BANS

      return {
        ...previous,
        [matchId]:
          current === 3 && waitingSecondBanPhase
            ? 2
            : clamp(current + 1, 1, MATCH_DAY_STEP_COUNT),
      }
    })
  }

  const handleToggleDraftBan = (matchId, championKey) => {
    if (!matchId || !championKey) {
      return
    }

    const targetMatch = activeSchedule.find((item) => item.id === matchId)
    const opponentTeamIdForMatch = targetMatch ? findTeamIdForLeague(selectedLeagueId, targetMatch.opponent) : null
    const opponentRosterForMatch = opponentTeamIdForMatch
      ? leagueProPlayers.filter((player) => player.team_id === opponentTeamIdForMatch)
      : []
    const opponentComfortPoolForMatch = buildOpponentComfortPool(opponentRosterForMatch)

    setMatchDraftById((previous) => {
      const current = previous[matchId] ?? createEmptyDraftState()
      const alreadyBanned = current.bans.includes(championKey)
      const currentTurnIndex = current.pickTurnIndex ?? 0
      const inSecondBanPhase = currentTurnIndex >= SECOND_BAN_TRIGGER_PICK_INDEX
      const banCap = inSecondBanPhase ? MAX_DRAFT_BANS : FIRST_BAN_PHASE_COUNT

      const pickedChampionIds = new Set(
        [...Object.values(current.playerPicks ?? {}), ...Object.values(current.enemyPicks ?? {})]
          .map((key) => getChampionByKey(key)?.id)
          .filter(Boolean),
      )
      const banChampionId = getChampionByKey(championKey)?.id

      if (!alreadyBanned && banChampionId && pickedChampionIds.has(banChampionId)) {
        return previous
      }

      if (!alreadyBanned && current.bans.length >= banCap) {
        return previous
      }

      const nextBans = alreadyBanned
        ? current.bans.filter((value) => value !== championKey)
        : [...current.bans, championKey]

      if (!inSecondBanPhase) {
        return {
          ...previous,
          [matchId]: {
            bans: nextBans,
            playerPicks: {},
            enemyPicks: {},
            pickTurnIndex: 0,
          },
        }
      }

      let nextEnemyPicks = { ...(current.enemyPicks ?? {}) }
      let nextTurnIndex = currentTurnIndex

      const canResumeAfterSecondBans =
        nextBans.length >= MAX_DRAFT_BANS &&
        nextTurnIndex < DRAFT_PICK_SEQUENCE.length

      if (canResumeAfterSecondBans) {
        while (nextTurnIndex < DRAFT_PICK_SEQUENCE.length && DRAFT_PICK_SEQUENCE[nextTurnIndex].side === 'red') {
          const redTurn = DRAFT_PICK_SEQUENCE[nextTurnIndex]
          nextEnemyPicks = buildEnemyDraftPicks({
            matchId,
            playerPicks: current.playerPicks,
            bans: nextBans,
            opponentComfortPool: opponentComfortPoolForMatch,
            existingEnemyPicks: nextEnemyPicks,
            rolesToFill: redTurn.roles,
          })
          nextTurnIndex += 1
        }
      }

      return {
        ...previous,
        [matchId]: {
          ...current,
          bans: nextBans,
          enemyPicks: nextEnemyPicks,
          pickTurnIndex: nextTurnIndex,
        },
      }
    })
  }

  const handleSelectDraftPick = (matchId, role, championKey) => {
    if (!matchId || !role) {
      return
    }

    const targetMatch = activeSchedule.find((item) => item.id === matchId)
    if (!targetMatch) {
      return
    }

    const opponentTeamIdForMatch = findTeamIdForLeague(selectedLeagueId, targetMatch.opponent)
    const opponentRosterForMatch = opponentTeamIdForMatch
      ? leagueProPlayers.filter((player) => player.team_id === opponentTeamIdForMatch)
      : []
    const opponentComfortPoolForMatch = buildOpponentComfortPool(opponentRosterForMatch)

    setMatchDraftById((previous) => {
      const current = previous[matchId] ?? createEmptyDraftState()
      const pickTurnIndex = current.pickTurnIndex ?? 0
      const currentTurn = DRAFT_PICK_SEQUENCE[pickTurnIndex]

      if (!currentTurn || currentTurn.side !== 'blue' || !currentTurn.roles.includes(role)) {
        return previous
      }

      const nextPlayerPicks = { ...current.playerPicks }
      const playerComfortPoolForMatch = buildPlayerComfortPool(effectifAvecBonusTier, rosterProfiles, baseRosterProfiles)
      const enemyBansForMatch = buildEnemyBansFromComfortPool(matchId, playerComfortPoolForMatch, current.bans, current)
      const bannedIdSet = new Set(
        [...current.bans, ...enemyBansForMatch.map((entry) => entry.key)]
          .map((key) => getChampionByKey(key)?.id)
          .filter(Boolean),
      )

      if (!championKey) {
        return previous
      } else {
        const selectedChampion = getChampionByKey(championKey)
        if (!selectedChampion || bannedIdSet.has(selectedChampion.id)) {
          return previous
        }

        Object.entries(nextPlayerPicks).forEach(([existingRole, existingKey]) => {
          const existingChampion = getChampionByKey(existingKey)
          if (existingRole !== role && existingChampion?.id === selectedChampion.id) {
            delete nextPlayerPicks[existingRole]
          }
        })

        nextPlayerPicks[role] = championKey
      }

      let nextEnemyPicks = { ...(current.enemyPicks ?? {}) }
      let nextTurnIndex = pickTurnIndex

      const isBlueTurnCompleted = currentTurn.roles.every((turnRole) => Boolean(nextPlayerPicks[turnRole]))

      if (isBlueTurnCompleted) {
        nextTurnIndex += 1

        while (nextTurnIndex < DRAFT_PICK_SEQUENCE.length && DRAFT_PICK_SEQUENCE[nextTurnIndex].side === 'red') {
          const mustPauseForSecondBans =
            nextTurnIndex >= SECOND_BAN_TRIGGER_PICK_INDEX &&
            (current.bans?.length ?? 0) < MAX_DRAFT_BANS

          if (mustPauseForSecondBans) {
            break
          }

          const redTurn = DRAFT_PICK_SEQUENCE[nextTurnIndex]
          nextEnemyPicks = buildEnemyDraftPicks({
            matchId,
            playerPicks: nextPlayerPicks,
            bans: current.bans,
            opponentComfortPool: opponentComfortPoolForMatch,
            existingEnemyPicks: nextEnemyPicks,
            rolesToFill: redTurn.roles,
          })
          nextTurnIndex += 1
        }
      }

      return {
        ...previous,
        [matchId]: {
          bans: current.bans,
          playerPicks: nextPlayerPicks,
          enemyPicks: nextEnemyPicks,
          pickTurnIndex: nextTurnIndex,
        },
      }
    })
  }

  const handleSwapDraftRoles = (matchId, fromRole, toRole) => {
    if (!matchId || !fromRole || !toRole || fromRole === toRole) {
      return false
    }

    const state = matchDraftById[matchId] ?? createEmptyDraftState()
    if ((state.pickTurnIndex ?? 0) < DRAFT_PICK_SEQUENCE.length) {
      setTimeNotification('La phase de swap est disponible uniquement apres la fin des picks.')
      return false
    }

    const fromChampionKey = state.playerPicks?.[fromRole]
    const toChampionKey = state.playerPicks?.[toRole]

    if (!fromChampionKey || !toChampionKey) {
      setTimeNotification('Swap impossible: les deux roles doivent avoir un champion lock.')
      return false
    }

    const rosterByRole = effectifAvecBonusTier.reduce((acc, player) => {
      acc[player.role] = player
      return acc
    }, {})

    const fromPlayer = rosterByRole[fromRole]
    const toPlayer = rosterByRole[toRole]
    if (!fromPlayer || !toPlayer) {
      setTimeNotification('Swap impossible: role joueur introuvable dans ton roster actif.')
      return false
    }

    const fromProfile = rosterProfiles[fromPlayer.playerId] ?? baseRosterProfiles[fromPlayer.playerId]
    const toProfile = rosterProfiles[toPlayer.playerId] ?? baseRosterProfiles[toPlayer.playerId]

    const fromCanOwnTarget = (fromProfile?.championMastery?.[toChampionKey] ?? 0) >= 25
    const toCanOwnTarget = (toProfile?.championMastery?.[fromChampionKey] ?? 0) >= 25

    if (!fromCanOwnTarget || !toCanOwnTarget) {
      setTimeNotification('Swap refuse: les deux invocateurs doivent posseder les deux champions.')
      return false
    }

    setMatchDraftById((previous) => {
      const current = previous[matchId] ?? createEmptyDraftState()
      const nextPlayerPicks = {
        ...(current.playerPicks ?? {}),
        [fromRole]: toChampionKey,
        [toRole]: fromChampionKey,
      }

      return {
        ...previous,
        [matchId]: {
          ...current,
          playerPicks: nextPlayerPicks,
        },
      }
    })

    setTimeNotification(`Swap valide entre ${fromRole} et ${toRole} (double approbation simulee).`)
    return true
  }

  const buildLiveSessionFromMatch = (match) => {
    if (!match) {
      return null
    }

    const selectedApproachId = matchApproachById[match.id] ?? DEFAULT_MATCH_APPROACH_ID
    const selectedApproach = getMatchApproachById(selectedApproachId)
    const draftState = matchDraftById[match.id] ?? createEmptyDraftState()
    const opponentTeamIdForMatch = findTeamIdForLeague(selectedLeagueId, match.opponent)
    const opponentRosterForMatch = opponentTeamIdForMatch
      ? leagueProPlayers.filter((player) => player.team_id === opponentTeamIdForMatch)
      : []
    const opponentComfortPoolForMatch = buildOpponentComfortPool(opponentRosterForMatch)
    const playerComfortPoolForMatch = buildPlayerComfortPool(effectifAvecBonusTier, rosterProfiles, baseRosterProfiles)
    const enemyBansForMatch = buildEnemyBansFromComfortPool(match.id, playerComfortPoolForMatch, draftState.bans, draftState)
    const opponentPowerForMatch = computeOpponentPower(match.opponent, standings)
    const draftScore = computeDraftNoLuckScore({
      draftState,
      opponentComfortPool: opponentComfortPoolForMatch,
      enemyBans: enemyBansForMatch,
      roster: effectifAvecBonusTier,
      rosterProfiles,
      baseRosterProfiles,
    })
    const draftPunishment = applyMentalCoachToPunishmentProfile(
      computeDraftPunishmentProfile({
        draftState,
        roster: effectifAvecBonusTier,
        rosterProfiles,
        baseRosterProfiles,
      }),
      mentalCoachLevel,
      opponentPowerForMatch >= 86,
    )
    const draftRoleReport = buildDraftRoleReport(draftState, draftScore, draftPunishment, analystLevel)
    const draftScoreExplanation = buildDraftScoreExplanation(draftScore, draftPunishment, analystLevel)

    const preDraftProjection = computePreMatchPrediction({
      roster: effectifAvecBonusTier,
      synergy: activeSynergy,
      draftBonus: activeDraftBonus,
      aggressivite,
      rythmeJeu,
      prioriteObjectifs,
      opponentPower: opponentPowerForMatch,
      approachId: selectedApproachId,
    })

    const simulation = buildMatchSimulationEngine({
      matchId: match.id,
      teamName: activeTeamName,
      opponentName: match.opponent,
      roster: effectifAvecBonusTier,
      opponentRoster: opponentRosterForMatch,
      draftState,
      rosterProfiles,
      baseRosterProfiles,
      approachId: selectedApproachId,
      draftScore: draftScore.score,
      seriesType: match.seriesType ?? 'BO1',
      mentalCoachLevel,
      isHighPressureMatch: opponentPowerForMatch >= 86,
      aggressivite,
      rythmeJeu,
      prioriteObjectifs,
      metaPatchInfluence: metaPatchState,
    })

    const rawProjectedWithDraft = computeProjectedWinRateWithDraft(
      preDraftProjection.projectedWinRate,
      draftScore.score,
      simulation.draftPunishmentProfile,
    )
    const visibleProjectedWithDraft = clamp(
      applyAnalystPrecision(rawProjectedWithDraft, analystLevel, `${match.id}-live-projected`, 1),
      3,
      96,
    )
    const visibleDraftScore = clamp(
      applyAnalystPrecision(draftScore.score, analystLevel, `${match.id}-live-draft-score`, 1),
      -35,
      35,
    )
    const postMatchBreakdown = buildPostMatchBreakdown({
      timeline: simulation.timeline,
      teamRows: simulation.teamRows,
      baseProjectedWinRate: preDraftProjection.projectedWinRate,
      projectedWinRate: rawProjectedWithDraft,
      analystLevel,
      matchId: match.id,
    })

    return {
      matchId: match.id,
      match,
      teamName: activeTeamName,
      opponentName: match.opponent,
      focusRole: focusJoueur,
      timeline: simulation.timeline,
      phaseBattle: simulation.phaseBattle,
      finalScoreboard: simulation.finalScoreboard,
      teamRows: simulation.teamRows,
      enemyRows: simulation.enemyRows,
      mvp: simulation.mvp,
      defeatReason: simulation.defeatReason,
      teamWon: simulation.teamWon,
      draftScore: visibleDraftScore,
      approachLabel: selectedApproach.label,
      projectedWinRate: visibleProjectedWithDraft,
      baseProjectedWinRate: preDraftProjection.projectedWinRate,
      draftState,
      draftScoreCard: draftScore,
      draftPunishmentProfile: simulation.draftPunishmentProfile,
      draftRoleReport,
      draftScoreExplanation,
      postMatchBreakdown,
      analystLevel,
      currentEventIndex: 0,
      decisionAdjustments: {},
      games: simulation.games ?? [],
      seriesRows: simulation.seriesRows ?? [],
      seriesScore: simulation.seriesScore ?? (simulation.teamWon ? '1-0' : '0-1'),
      teamWins: simulation.teamWins ?? (simulation.teamWon ? 1 : 0),
      enemyWins: simulation.enemyWins ?? (simulation.teamWon ? 0 : 1),
      activeCombos: (simulation.games?.[0]?.activeCombos) ?? [],
    }
  }

  const handleStartLiveMatch = (matchId) => {
    if (!matchId) {
      return
    }

    const match = activeSchedule.find((item) => item.id === matchId)
    if (!match) {
      return
    }

    const session = buildLiveSessionFromMatch(match)
    if (!session) {
      return
    }

    setMatchFlowStep(match.id, MATCH_DAY_STEP_COUNT)
    setLiveMatchSession(session)

    setActivePage('match-live')
  }

  const finalizeLiveMatch = (session) => {
    if (!session?.matchId) {
      return
    }

    // Apply cumulative decision rewards to the last game's goldDiff - may flip the result.
    const totalDecisionReward = Object.values(session.decisionAdjustments ?? {}).reduce(
      (sum, entry) => sum + (entry?.reward ?? 0),
      0,
    )
    const finalEvent = session.timeline[session.timeline.length - 1]
    const rawGoldDiff = finalEvent?.goldDiff ?? 0
    const adjustedGoldDiff = rawGoldDiff + totalDecisionReward

    let teamWins = session.teamWins ?? (session.teamWon ? 1 : 0)
    let enemyWins = session.enemyWins ?? (session.teamWon ? 0 : 1)

    // If the decisions flipped the visible final game, adjust series score accordingly
    const rawLastGameWonByTeam = rawGoldDiff >= 0
    const adjustedLastGameWonByTeam = adjustedGoldDiff >= 0
    if (rawLastGameWonByTeam !== adjustedLastGameWonByTeam) {
      if (adjustedLastGameWonByTeam) {
        teamWins += 1
        enemyWins = Math.max(0, enemyWins - 1)
      } else {
        enemyWins += 1
        teamWins = Math.max(0, teamWins - 1)
      }
    }

    const isWin = teamWins > enemyWins
    const score = `${teamWins}-${enemyWins}`

    // Prize money for this match
    const stage = session.match?.stage ?? 'Regulier'
    const prizePool = PRIZE_MONEY_BY_STAGE[stage] ?? PRIZE_MONEY_BY_STAGE.Regulier
    const prizeMoney = isWin ? prizePool.win : prizePool.loss

    // Track match history for sponsor verification
    const historyEntry = {
      matchId: session.matchId,
      stage,
      opponent: session.opponentName,
      isWin,
      dateKey: session.match?.dateKey ?? toDateKey(currentDate),
      score,
    }
    setMatchHistory((previous) => [historyEntry, ...previous].slice(0, 200))

    // Sponsor bonus verification based on running winrate
    const updatedHistory = [historyEntry, ...matchHistory].slice(0, 200)
    const totalMatches = updatedHistory.length
    const totalWins = updatedHistory.filter((entry) => entry.isWin).length
    const runningWinrate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0

    let sponsorBonusTotal = 0
    const sponsorBonusEntries = []
    setSponsorContracts((previous) =>
      previous.map((sponsor) => {
        if (sponsor.status !== 'active' || sponsor.bonusPaid) {
          return sponsor
        }
        if (sponsor.target?.type === 'winrate' && totalMatches >= 6 && runningWinrate >= sponsor.target.value) {
          sponsorBonusTotal += sponsor.target.bonus ?? 0
          sponsorBonusEntries.push({
            id: `sponsor-bonus-${sponsor.id}-${Date.now()}`,
            label: `Bonus ${sponsor.label} (winrate ${runningWinrate}%)`,
            amount: sponsor.target.bonus ?? 0,
            date: currentDate.toISOString(),
          })
          return { ...sponsor, bonusPaid: true }
        }
        return sponsor
      }),
    )

    setBudget((previous) => previous + prizeMoney + sponsorBonusTotal)
    setFinanceLedger((previous) => [
      ...sponsorBonusEntries,
      {
        id: `match-${session.matchId}-${Date.now()}`,
        label: `${isWin ? 'Prime victoire' : 'Prime participation'} ${stage} vs ${session.opponentName}`,
        amount: prizeMoney,
        date: currentDate.toISOString(),
      },
      ...previous,
    ].slice(0, 40))

    // Grant mastery + permanent progression to each active roster player
    setRosterProfiles((previous) => {
      const next = { ...previous }
      const teamRowsToApply = session.seriesRows?.length ? session.seriesRows : session.teamRows
      teamRowsToApply.forEach((row) => {
        if (!row.playerId) return
        const existing = next[row.playerId] ?? baseRosterProfiles[row.playerId]
        if (!existing) return

        const updated = {
          ...existing,
          championMastery: { ...(existing.championMastery ?? {}) },
        }

        // Champion mastery gain based on performance
        const pickKey = session.draftState?.playerPicks?.[row.role]
        if (pickKey) {
          const currentMastery = updated.championMastery[pickKey] ?? 30
          const masteryGain = (row.rating ?? 6.5) >= 8 ? 3 : (row.rating ?? 6.5) >= 7 ? 2 : 1
          updated.championMastery[pickKey] = clamp(currentMastery + masteryGain, 0, 100)
        }

        // Permanent progression (only rare small gains, capped by potential)
        const potentialCap = updated.potential ?? POTENTIAL_BAND.high
        const progressionChance = (row.rating ?? 6.5) >= 8 ? 0.45 : (row.rating ?? 6.5) >= 7 ? 0.2 : 0.05
        const progressionSeed = stableHash(`${row.playerId}-${session.matchId}-progression`) % 100
        if (progressionSeed < progressionChance * 100) {
          const statToGrow = ['teamfightBonus', 'mechanicsBonus', 'macroBonus'][progressionSeed % 3]
          const currentBonus = updated[statToGrow] ?? 0
          if (currentBonus < potentialCap - 70) {
            updated[statToGrow] = currentBonus + 1
          }
        }

        // Morale / condition impact
        if ((row.rating ?? 6.5) >= 8) {
          updated.moral = increaseMorale(updated.moral)
        } else if ((row.rating ?? 6.5) <= 5.5) {
          updated.moral = decreaseMorale(updated.moral)
        }
        updated.condition = clamp((updated.condition ?? 72) - 8, 20, 100)

        // Match history
        const history = ['V', 'D'].filter(Boolean)
        updated.matchHistory = [isWin ? 'V' : 'D', ...(existing.matchHistory ?? history).slice(0, 3)]

        next[row.playerId] = updated
      })
      return next
    })

    setLeagueSchedules((previous) => {
      const current = previous[scheduleKey] ?? generatedSchedule
      const teamSchedule = current.map((item) =>
        item.id === session.matchId
          ? {
            ...item,
            status: 'played',
            result: `${isWin ? 'V' : 'D'} ${score}`,
          }
          : item,
      )

      const withTeamSchedule = {
        ...previous,
        [scheduleKey]: teamSchedule,
      }

      return applyMirroredResultToOpponentSchedule({
        schedules: withTeamSchedule,
        leagueId: selectedLeagueId,
        teamName: session.teamName,
        opponentName: session.opponentName,
        dateKey: session.match?.dateKey,
        stage: session.match?.stage,
        isTeamWin: isWin,
        score,
      })
    })

    const report = {
      matchId: session.matchId,
      teamName: session.teamName,
      opponentName: session.opponentName,
      finalScoreboard: session.finalScoreboard,
      teamRows: session.teamRows,
      enemyRows: session.enemyRows,
      seriesRows: session.seriesRows ?? [],
      games: session.games ?? [],
      mvp: session.mvp,
      defeatReason: session.defeatReason,
      teamWon: isWin,
      draftScore: session.draftScore,
      draftState: session.draftState,
      draftScoreCard: session.draftScoreCard,
      draftPunishmentProfile: session.draftPunishmentProfile,
      draftRoleReport: session.draftRoleReport,
      draftScoreExplanation: session.draftScoreExplanation,
      postMatchBreakdown: session.postMatchBreakdown,
      analystLevel: session.analystLevel,
      prizeMoney,
      seriesScore: score,
      activeCombos: session.activeCombos ?? [],
      decisionAdjustments: session.decisionAdjustments ?? {},
    }

    setLastMatchReport(report)
    setTimeNotification(
      `Live termine vs ${session.opponentName}: ${isWin ? 'Victoire' : 'Defaite'} (${score}). MVP: ${session.mvp?.playerName ?? 'N/A'}. Prime: ${formatBudgetShort(prizeMoney)}.`,
    )

    setMatchApproachById((previous) => {
      if (!previous[session.matchId]) {
        return previous
      }
      const next = { ...previous }
      delete next[session.matchId]
      return next
    })

    setMatchDraftById((previous) => {
      if (!previous[session.matchId]) {
        return previous
      }
      const next = { ...previous }
      delete next[session.matchId]
      return next
    })

    setMatchFlowStepById((previous) => {
      if (!previous[session.matchId]) {
        return previous
      }
      const next = { ...previous }
      delete next[session.matchId]
      return next
    })

    setLiveMatchSession(null)
    setActivePage('match-result')
  }

  const handleAdvanceLiveSimulation = () => {
    if (!liveMatchSession) {
      return
    }

    const currentEvent = liveMatchSession.timeline[liveMatchSession.currentEventIndex]
    // Block auto-advance when the current event has a pending decision the coach has not answered.
    if (currentEvent?.decision && !liveMatchSession.decisionAdjustments?.[currentEvent.decision.id]) {
      return
    }

    const maxIndex = liveMatchSession.timeline.length - 1
    const nextIndex = Math.min(maxIndex, liveMatchSession.currentEventIndex + 1)

    setLiveMatchSession((previous) => {
      if (!previous) {
        return previous
      }
      return {
        ...previous,
        currentEventIndex: nextIndex,
      }
    })
  }

  const handleResolveLiveDecision = (decisionId, option) => {
    if (!liveMatchSession || !decisionId || !option) {
      return
    }

    setLiveMatchSession((previous) => {
      if (!previous) return previous
      const nextAdjustments = {
        ...(previous.decisionAdjustments ?? {}),
        [decisionId]: { optionId: option.id, reward: option.reward, commentary: option.commentary },
      }
      const maxIndex = previous.timeline.length - 1
      const nextIndex = Math.min(maxIndex, previous.currentEventIndex + 1)
      return {
        ...previous,
        decisionAdjustments: nextAdjustments,
        currentEventIndex: nextIndex,
      }
    })
    setTimeNotification(`Decision prise: ${option.label}. ${option.commentary}`)
  }

  const handleSkipLiveSimulation = () => {
    if (!liveMatchSession) {
      return
    }

    const maxIndex = liveMatchSession.timeline.length - 1
    const completedSession = {
      ...liveMatchSession,
      currentEventIndex: maxIndex,
    }

    finalizeLiveMatch(completedSession)
  }

  const handleFinishLiveSimulation = () => {
    if (!liveMatchSession) {
      return
    }

    finalizeLiveMatch(liveMatchSession)
  }

  const handleRunInstantMatch = () => {
    const targetMatch =
      activeSchedule.find((item) => item.status === 'upcoming' && item.dateKey === todayKey) ??
      activeSchedule.find((item) => item.status === 'upcoming')

    if (!targetMatch) {
      setTimeNotification('Aucun match a organiser: la saison en cours est deja terminee.')
      return
    }

    if (targetMatch.dateKey !== todayKey) {
      setCurrentDate(new Date(targetMatch.date))
    }

    setLiveMatchSession(null)
    setLastMatchReport(null)
    setMatchFlowStep(targetMatch.id, 1)
    setTimeNotification(`Match organise contre ${targetMatch.opponent}. Configure la draft puis lance le live pour tester tout le flow.`)
    setActivePage('match-day')
  }

  const handleContinue = () => {
    if (isProcessing) {
      return
    }

    const todaysMatch = activeSchedule.find((match) => match.status === 'upcoming' && match.dateKey === todayKey)
    if (todaysMatch) {
      setMatchFlowStep(todaysMatch.id, 1)
      setTimeNotification(`Match imminent contre ${todaysMatch.opponent}. Le temps est bloque tant que le match n'est pas resolu.`)
      setActivePage('match-day')
      return
    }

    setIsProcessing(true)

    const nextDate = addDays(currentDate, 1)
    const activities = [
      getActivityForDate(trainingPlan, currentDate, 'morning'),
      getActivityForDate(trainingPlan, currentDate, 'afternoon'),
    ]

    setTimeout(() => {
      let scrimCount = 0
      let theoryCount = 0
      let soloQCount = 0
      const activeRosterIdSet = new Set(baseRosterPlayers.map((player) => player.playerId))

      setRosterProfiles((previous) => {
        const next = { ...previous }

        baseRosterPlayers.forEach((player) => {
          const playerId = player.playerId
          const existing = next[playerId] ?? baseRosterProfiles[playerId]
          if (!existing) {
            return
          }

          const updated = {
            ...existing,
            championMastery: { ...(existing.championMastery ?? {}) },
          }

          // Compute ceiling above current ability for training gains, capped by potential
          const baseStat = (player.laning + player.teamfight + player.macro + player.mechanics) / 4
          const potentialCap = updated.potential ?? POTENTIAL_BAND.high
          const room = Math.max(0, potentialCap - baseStat)
          // Max total bonus a player can accumulate on a stat before being considered "capped"
          const softCap = Math.max(0, Math.round(room))

          const applyStatGain = (statKey, amount) => {
            const current = updated[statKey] ?? 0
            if (current >= softCap) {
              return  // player has hit their potential ceiling
            }
            updated[statKey] = current + amount
          }

          activities.forEach((activityId, slotIndex) => {
            const randomSeed = stableHash(`${playerId}-${todayKey}-${slotIndex}-${activityId}`)

            if (activityId === 'scrims') {
              updated.condition = clamp(updated.condition - 15, 0, 100)
              applyStatGain('teamfightBonus', 1)
              scrimCount += 1
              return
            }

            if (activityId === 'soloq') {
              updated.condition = clamp(updated.condition - 10, 0, 100)
              applyStatGain('mechanicsBonus', 1)
              const rawDelta = SOLOQ_TUNING.active.randomFloor + (randomSeed % SOLOQ_TUNING.active.randomRange)
              const mechanicsScore = clamp(Math.round((player.mechanics ?? 70) / 5), 1, 20)
              const mentalScore = clamp(updated.mental ?? player.mental ?? 14, 1, 20)
              const skillBias = Math.round((mechanicsScore - 13) * 0.6 + (mentalScore - 13) * 0.4)
              const formBias = updated.condition >= 82 ? 2 : updated.condition <= 40 ? -2 : 0
              const lpDelta = clamp(
                rawDelta + skillBias + formBias,
                SOLOQ_TUNING.active.minDelta,
                SOLOQ_TUNING.active.maxDelta,
              )
              updated.ladderLP = clamp((updated.ladderLP ?? 700) + lpDelta, 0, 1800)
              if (lpDelta < -10) {
                const tiltSeed = `${playerId}-${todayKey}-${slotIndex}-soloq-tilt`
                if (shouldApplyTilt(0.74, mentalCoachLevel, tiltSeed)) {
                  updated.moral = decreaseMorale(updated.moral)
                }
              } else if (lpDelta > 18) {
                updated.moral = increaseMorale(updated.moral)
              }
              soloQCount += 1
              return
            }

            if (activityId === 'vod_review') {
              updated.condition = clamp(updated.condition - 5, 0, 100)
              applyStatGain('macroBonus', 1)
              applyStatGain('visionBonus', 1)
              return
            }

            if (activityId === 'theorycrafting') {
              updated.condition = clamp(updated.condition - 5, 0, 100)
              applyStatGain('draftBonus', 2)
              const keys = Object.keys(updated.championMastery)
                .sort((a, b) => (updated.championMastery[b] ?? 0) - (updated.championMastery[a] ?? 0))
                .slice(0, 3)

              keys.forEach((key) => {
                updated.championMastery[key] = clamp((updated.championMastery[key] ?? 0) + 1, 0, 100)
              })
              theoryCount += 1
              return
            }

            if (activityId === 'rest') {
              updated.condition = clamp(updated.condition + 20, 0, 100)
              updated.moral = increaseMorale(updated.moral)
            }
          })

          if ((updated.ladderLP ?? 0) >= 1200) {
            updated.confident = true
            updated.mental = clamp((updated.mental ?? player.mental ?? 14) + 1, 1, 20)
          }

          if ((updated.condition ?? 0) < 40) {
            const fatigueTiltSeed = `${playerId}-${todayKey}-fatigue-tilt`
            if (shouldApplyTilt(0.58, mentalCoachLevel, fatigueTiltSeed)) {
              updated.moral = decreaseMorale(updated.moral)
            }
          }

          next[playerId] = updated
        })

        PRO_PLAYERS.forEach((player) => {
          if (activeRosterIdSet.has(player.id)) {
            return
          }

          const seed = stableHash(`${player.id}-${todayKey}-global-soloq`)
          const rawDelta = SOLOQ_TUNING.global.randomFloor + (seed % SOLOQ_TUNING.global.randomRange)
          const skillBias = Math.round((player.stats.mechanics - 13) * 0.55 + (player.stats.mental - 13) * 0.45)
          const globalLpDelta = clamp(
            rawDelta + skillBias,
            SOLOQ_TUNING.global.minDelta,
            SOLOQ_TUNING.global.maxDelta,
          )
          const fallbackLp = clamp(
            500 +
              player.stats.mechanics * 22 +
              player.stats.mental * 16 +
              player.stats.macro * 8 +
              (stableHash(`soloq-${player.id}`) % 220),
            0,
            1800,
          )

          const existing = next[player.id] ?? {}
          const nextLp = clamp((existing.ladderLP ?? fallbackLp) + globalLpDelta, 0, 1800)

          next[player.id] = {
            ...existing,
            pseudo: existing.pseudo ?? player.pseudo,
            realName: existing.realName ?? player.real_name,
            age: existing.age ?? player.age ?? 21,
            nationality: existing.nationality ?? player.nationality ?? 'Inconnue',
            marketValue: existing.marketValue ?? formatEuroValue(player.value ?? 350000),
            condition: existing.condition ?? 72,
            moral:
              existing.moral ?? (player.stats.mental >= 17 ? 'Excellent' : player.stats.mental >= 15 ? 'Bon' : 'Moyen'),
            ladderLP: nextLp,
            confident: nextLp >= 1200,
            mental: existing.mental ?? player.stats.mental,
            teamfightBonus: existing.teamfightBonus ?? 0,
            mechanicsBonus: existing.mechanicsBonus ?? 0,
            macroBonus: existing.macroBonus ?? 0,
            visionBonus: existing.visionBonus ?? 0,
            draftBonus: existing.draftBonus ?? 0,
            synergyBonus: existing.synergyBonus ?? 0,
            matchHistory: existing.matchHistory ?? ['V', 'D', 'V', 'V'],
            championMastery: existing.championMastery ?? {},
          }
        })

        return next
      })

      setSynergyByTeam((previous) => ({
        ...previous,
        [scheduleKey]: clamp((previous[scheduleKey] ?? 62) + scrimCount * 3, 0, 100),
      }))

      setDraftBonusByTeam((previous) => ({
        ...previous,
        [scheduleKey]: clamp((previous[scheduleKey] ?? 0) + theoryCount * 2, 0, 60),
      }))

      const updatedScouting = scoutingQueue.map((task) => {
        const isMajorImportRegion = task.league === 'LCK' || task.league === 'LPL'
        const speedBoost = isMajorImportRegion ? headScoutLevel : Math.floor(headScoutLevel / 2)
        const dailyProgress = 1 + speedBoost

        return {
          ...task,
          daysRemaining: Math.max(0, task.daysRemaining - dailyProgress),
        }
      })
      const finishedScouts = updatedScouting.filter((task, index) => task.daysRemaining === 0 && scoutingQueue[index].daysRemaining > 0)
      const finishedScout = finishedScouts[0] ?? null
      setScoutingQueue(updatedScouting.filter((task) => task.daysRemaining > 0))

      // Convert finished scouts into real market prospects
      if (finishedScouts.length > 0) {
        setTransferMarket((previous) => {
          const newProspects = finishedScouts.map((task) => {
            const seed = stableHash(`prospect-${task.player}-${task.league}`)
            const roleBase = {
              Top: { laning: 13, teamfight: 13, macro: 13, mechanics: 13, mental: 13 },
              Jungle: { laning: 11, teamfight: 14, macro: 14, mechanics: 14, mental: 14 },
              Mid: { laning: 14, teamfight: 14, macro: 13, mechanics: 15, mental: 13 },
              ADC: { laning: 14, teamfight: 15, macro: 12, mechanics: 15, mental: 12 },
              Support: { laning: 11, teamfight: 13, macro: 14, mechanics: 12, mental: 14 },
            }[task.role] ?? { laning: 13, teamfight: 13, macro: 13, mechanics: 13, mental: 13 }

            // Random roll on top of base (-2 to +4)
            const roll = (key, offset) => clamp(roleBase[key] + ((seed >>> offset) % 7) - 2, 5, 20)
            const stats = {
              laning: roll('laning', 0),
              teamfight: roll('teamfight', 4),
              macro: roll('macro', 8),
              mechanics: roll('mechanics', 12),
              mental: roll('mental', 16),
            }

            const mainStat = (stats.laning + stats.teamfight + stats.macro + stats.mechanics) / 4
            // Prospects are unknown-quantity rookies: cheaper but hidden potential
            const askingPrice = Math.round(450_000 + mainStat * 40_000)
            const age = 17 + (seed % 5)
            const potentialRoll = (seed >>> 8) % 100
            let potential
            if (age <= 19) {
              potential = potentialRoll < 30 ? POTENTIAL_BAND.elite : potentialRoll < 70 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
            } else {
              potential = potentialRoll < 15 ? POTENTIAL_BAND.elite : potentialRoll < 55 ? POTENTIAL_BAND.high : POTENTIAL_BAND.mid
            }

            return {
              id: `prospect-${seed}`,
              pseudo: task.player,
              realName: task.player,
              role: task.role,
              league: `${task.league} SoloQ`,
              source: 'scout',
              age,
              stats,
              statsPreview: {
                laning: stats.laning,
                teamfight: stats.teamfight,
                mechanics: stats.mechanics,
              },
              signatureChampions: [],
              askingPrice,
              potential,
              // Head scout level reveals potential more precisely
              revealedPotential: headScoutLevel >= 3 ? potential : null,
              signed: false,
            }
          })
          return [...previous, ...newProspects].slice(0, 14)
        })
      }

      let patchNotice = ''
      let financeNotice = ''
      if (nextDate.getDate() === 1) {
        const patchNumber = Number(metaPatch.split('.').pop() ?? '1')
        const nextPatch = `14.${patchNumber + 1}`
        setMetaPatch(nextPatch)

        // Rotate meta archetype influence
        const archetypeSeed = stableHash(`${nextPatch}-archetype`)
        const boostedArchetype = META_PATCH_ARCHETYPES[archetypeSeed % META_PATCH_ARCHETYPES.length]
        const nerfedArchetype =
          META_PATCH_ARCHETYPES[(archetypeSeed >>> 4) % META_PATCH_ARCHETYPES.length] === boostedArchetype
            ? META_PATCH_ARCHETYPES[(archetypeSeed >>> 2) % META_PATCH_ARCHETYPES.length]
            : META_PATCH_ARCHETYPES[(archetypeSeed >>> 4) % META_PATCH_ARCHETYPES.length]

        const boostedChampions = CHAMPIONS_DB
          .filter((champion) => champion.tags?.includes(boostedArchetype))
          .slice(0, 4)
          .map((champion) => champion.id)
        const nerfedChampions = CHAMPIONS_DB
          .filter((champion) => champion.tags?.includes(nerfedArchetype))
          .slice(0, 4)
          .map((champion) => champion.id)

        const patchEntry = {
          version: nextPatch,
          boostedArchetype,
          nerfedArchetype,
          boostedChampions,
          nerfedChampions,
        }
        setMetaPatchState(patchEntry)
        setPatchHistory((previous) => [patchEntry, ...previous].slice(0, 12))
        patchNotice = `Patch ${nextPatch}: ${boostedArchetype} buff, ${nerfedArchetype} nerf.`

        // Monthly finance: staff cost + salaries deduction + sponsor revenue
        const totalSalary = baseRosterPlayers.length * DEFAULT_PLAYER_SALARY
        const staffMonthly = computeStaffMonthlyCost(staffTeam)
        const monthlyDebitAmount = totalSalary + staffMonthly
        const sponsorMonthly = sponsorContracts
          .filter((sponsor) => sponsor.status === 'active')
          .reduce((sum, sponsor) => sum + (sponsor.monthly ?? 0), 0)

        setBudget((previous) => previous + sponsorMonthly - monthlyDebitAmount)
        setFinanceLedger((previous) => [
          {
            id: `salary-${toDateKey(nextDate)}`,
            label: `Salaires joueurs (${baseRosterPlayers.length})`,
            amount: -totalSalary,
            date: nextDate.toISOString(),
          },
          {
            id: `staff-${toDateKey(nextDate)}`,
            label: 'Salaires staff',
            amount: -staffMonthly,
            date: nextDate.toISOString(),
          },
          {
            id: `sponsors-${toDateKey(nextDate)}`,
            label: 'Revenus sponsors',
            amount: sponsorMonthly,
            date: nextDate.toISOString(),
          },
          ...previous,
        ].slice(0, 40))

        financeNotice = `Mois clos: sponsors ${formatBudgetShort(sponsorMonthly)}, couts ${formatBudgetShort(-monthlyDebitAmount)}.`

        // Board objective evaluation - check on the 1st of each month for any completable objective
        const currentLeagueStandings = getLeagueStandings(selectedLeagueId) ?? []
        const myRankEntry = currentLeagueStandings.findIndex((team) => team.name === activeTeamName) + 1
        const myRank = myRankEntry > 0 ? myRankEntry : currentLeagueStandings.length

        const currentStageHistory = matchHistory.filter((entry) => entry.stage === 'Printemps' || entry.stage === 'Ete' || entry.stage === 'Regulier')
        const completedMatches = currentStageHistory.length
        const wins = currentStageHistory.filter((entry) => entry.isWin).length
        const currentWinrate = completedMatches > 0 ? Math.round((wins / completedMatches) * 100) : 0

        const monthNumber = nextDate.getMonth() + 1
        const isEndOfSpring = monthNumber === 5  // Spring ends around April/May
        const isEndOfSummer = monthNumber === 9  // Summer ends around August/September

        let objectiveBonus = 0
        const objectiveEntries = []
        setBoardObjectives((previous) =>
          previous.map((objective) => {
            if (objective.status !== 'pending') return objective

            let completed = false
            let failed = false

            if (objective.stage === 'Printemps' && isEndOfSpring) {
              completed = myRank > 0 && myRank <= (objective.minRank ?? 4)
              failed = !completed
            } else if (objective.stage === 'Ete' && isEndOfSummer) {
              completed = myRank > 0 && myRank <= (objective.minRank ?? 2)
              failed = !completed
            } else if (objective.minWinrate && completedMatches >= 8) {
              if (currentWinrate >= objective.minWinrate) {
                completed = true
              }
            }

            if (completed) {
              objectiveBonus += objective.reward ?? 0
              objectiveEntries.push({
                id: `board-${objective.id}-${Date.now()}`,
                label: `Objectif board: ${objective.label}`,
                amount: objective.reward ?? 0,
                date: nextDate.toISOString(),
              })
              return { ...objective, status: 'done' }
            }
            if (failed) {
              return { ...objective, status: 'failed' }
            }
            return objective
          }),
        )

        if (objectiveBonus > 0) {
          setBudget((previous) => previous + objectiveBonus)
          setFinanceLedger((previous) => [...objectiveEntries, ...previous].slice(0, 40))
          financeNotice += ` +${formatBudgetShort(objectiveBonus)} objectifs board.`
        }

        // Bankruptcy check - warn on the 1st of each month if budget post-debit would be catastrophic
        const projectedBudget = budget + sponsorMonthly - monthlyDebitAmount + objectiveBonus
        if (projectedBudget < -1_000_000) {
          setGameOver({
            reason: 'bankruptcy',
            balance: projectedBudget,
            dateKey: toDateKey(nextDate),
          })
        } else if (projectedBudget < 0) {
          financeNotice += ` ATTENTION: decouvert ${formatBudgetShort(projectedBudget)}.`
        }
      }

      const nextDateKey = toDateKey(nextDate)
      setLeagueSchedules((previous) => {
        let synchronizedSchedules = { ...previous }

        Object.keys(TEAMS_BY_LEAGUE).forEach((leagueId) => {
          synchronizedSchedules = resolveLeagueSchedulesForDate({
            existingSchedules: synchronizedSchedules,
            leagueId,
            dateKey: nextDateKey,
            activeLeagueId: selectedLeagueId,
            activeTeamId,
          })
        })

        return synchronizedSchedules
      })

      const upcomingMatch = activeSchedule.find((match) =>
        match.status === 'upcoming' && match.dateKey === toDateKey(nextDate),
      )

      const scoutingNotice = finishedScout
        ? `Rapport scouting pret: ${finishedScout.player} (${finishedScout.role}).`
        : ''

      const matchNotice = upcomingMatch
        ? `Match imminent demain contre ${upcomingMatch.opponent}.`
        : ''

      const summaryNotice =
        `${patchNotice} ${financeNotice} ${scoutingNotice} ${matchNotice}`.trim() ||
        `Jour avance au ${formatDateLong(nextDate)}. Slots appliques: ${activities.join(' + ')} (SoloQ: ${soloQCount}).`

      setCurrentDate(nextDate)
      if (upcomingMatch) {
        setMatchFlowStep(upcomingMatch.id, 1)
        setActivePage('match-day')
      }
      setTimeNotification(summaryNotice)
      setIsProcessing(false)
    }, 900)
  }

  const activeNavLabel = pageDirectory.find((item) => item.id === activePage)?.label ?? 'Tableau de bord'

  const pages = {
    mailbox: (
      <MailboxPage
        mails={mailboxMails}
        selectedMailId={selectedMailId}
        onSelectMail={handleSelectMailboxMail}
        onMarkAllRead={handleMarkAllMailboxRead}
        onOpenPage={setActivePage}
      />
    ),
    dashboard: (
      <DashboardPage
        effectif={effectifAvecBonusTier}
        onOpenPlayerProfile={handleOpenPlayerProfile}
        onOpenSoloQLadder={handleOpenSoloQLadder}
        soloQPreview={soloQPreview}
        matchDayInsights={dashboardMatchInsights}
        newsFeed={newsFeed}
        activeTeamName={activeTeamName}
      />
    ),
    championnat: (
      <ChampionnatPage
        activeLeague={activeLeague}
        standings={standings}
        schedule={activeSchedule}
        currentDate={currentDate}
        onOpenTeamRoster={handleOpenTeamRoster}
      />
    ),
    monde: <MondePage worldRanking={worldRanking} onOpenTeamRoster={handleOpenTeamRoster} />,
    effectif: (
      <EffectifPage
        effectif={effectifAvecBonusTier}
        activeLeague={activeLeague}
        activeTeamName={activeTeamName}
        onOpenPlayerProfile={handleOpenPlayerProfile}
        schedule={activeSchedule}
        currentDate={currentDate}
      />
    ),
    'profil-joueur': (
      <PlayerProfilePage
        player={selectedPlayerData}
        profile={selectedPlayerProfile}
        onTrainChampion={handleTrainChampion}
        onBackToRoster={() => setActivePage('effectif')}
      />
    ),
    'soloq-europe': (
      <SoloQEuropePage
        ranking={soloQEuropeRanking}
        onOpenPlayerProfileFromLadder={handleOpenPlayerProfileFromLadder}
      />
    ),
    tactiques: (
      <TactiquesPage
        aggressivite={aggressivite}
        onChangeAggressivite={setAggressivite}
        rythmeJeu={rythmeJeu}
        onChangeRythmeJeu={setRythmeJeu}
        prioriteObjectifs={prioriteObjectifs}
        onChangePrioriteObjectifs={setPrioriteObjectifs}
        focusJoueur={focusJoueur}
        onChangeFocusJoueur={setFocusJoueur}
        onSaveTactique={handleSaveTactique}
        saveMessage={saveMessage}
      />
    ),
    'rapport-analyste': (
      <RapportAnalystePage
        aggressivite={aggressivite}
        rythmeJeu={rythmeJeu}
        prioriteObjectifs={prioriteObjectifs}
        focusJoueur={focusJoueur}
      />
    ),
    entrainement: (
      <EntrainementPage
        roster={effectifAvecBonusTier}
        activeLeague={activeLeague}
        activeTeamName={activeTeamName}
        onApplyWeeklyResults={handleApplyWeeklyTraining}
        trainingPlan={trainingPlan}
        onTrainingPlanChange={setTrainingPlan}
      />
    ),
    calendrier: (
      <CalendrierPage
        currentDate={currentDate}
        schedule={activeSchedule}
        metaPatch={metaPatch}
        onResolveMatch={handleResolveMatch}
        leagueTeamCalendars={leagueTeamCalendars}
        activeTeamId={activeTeamId}
      />
    ),
    'match-day': (
      <MatchDayPage
        currentDate={currentDate}
        match={matchToday}
        synergy={activeSynergy}
        draftBonus={activeDraftBonus}
        prioriteObjectifs={prioriteObjectifs}
        focusJoueur={focusJoueur}
        approachOptions={MATCH_APPROACHES}
        selectedApproachId={selectedMatchApproachId}
        onSelectApproach={(approachId) => handleSelectMatchApproach(matchToday?.id, approachId)}
        opponentComfortPool={opponentComfortPool}
        enemyBans={enemyBans}
        draftState={activeDraftState}
        draftScoreCard={visibleDraftScoreCard}
        draftProjectedWinRate={draftProjectedWinRate}
        flowStep={activeMatchFlowStep}
        onPrevStep={() => handlePrevMatchStep(matchToday?.id)}
        onNextStep={() => handleNextMatchStep(matchToday?.id)}
        onToggleDraftBan={handleToggleDraftBan}
        onSelectDraftPick={handleSelectDraftPick}
        onSwapDraftRoles={handleSwapDraftRoles}
        onStartLiveMatch={handleStartLiveMatch}
        onOpenCalendar={() => setActivePage('calendrier')}
      />
    ),
    'match-live': (
      <MatchLivePage
        liveSession={liveMatchSession}
        onAdvance={handleAdvanceLiveSimulation}
        onSkip={handleSkipLiveSimulation}
        onFinish={handleFinishLiveSimulation}
        onResolveDecision={handleResolveLiveDecision}
      />
    ),
    'match-result': (
      <MatchResultPage
        report={lastMatchReport}
        onBackToCalendar={() => setActivePage('calendrier')}
        onBackToMatchDay={() => setActivePage('match-day')}
      />
    ),
    recrutement: (
      <RecrutementPage
        staffTeam={staffTeam}
        onUpgradeStaff={handleUpgradeStaff}
        transferMarket={transferMarket}
        onSignPlayer={handleSignPlayer}
        budget={budget}
        scoutingQueue={scoutingQueue}
        onLaunchScout={handleLaunchScout}
        headScoutLevel={headScoutLevel}
      />
    ),
    'staff-finances': (
      <StaffFinancesPage
        staffTeam={staffTeam}
        staffMonthlyCost={staffMonthlyCost}
        budget={budget}
        financeLedger={financeLedger}
        sponsorContracts={sponsorContracts}
        boardObjectives={boardObjectives}
        playerCount={baseRosterPlayers.length}
      />
    ),
    'data-hub': (
      <DataHubPage
        lastMatchReport={lastMatchReport}
        staffTeam={staffTeam}
      />
    ),
  }

  if (gamePhase === 'setup') {
    return (
      <StartScreen
        onStart={handleStartGame}
        onContinue={handleContinueGame}
        hasSave={Boolean(_initialSave)}
      />
    )
  }

  const isMatchFullscreenPage = activePage === 'match-day' || activePage === 'match-live' || activePage === 'match-result'

  if (isMatchFullscreenPage) {
    const steps = ['Briefing', 'Bans', 'Picks', 'Validation', 'Live', 'Resultat']
        const currentStepIndex =
      activePage === 'match-day'
        ? clamp(activeMatchFlowStep, 1, 4)
        : activePage === 'match-live'
          ? 5
          : 6
    const isImmersiveMode = activePage === 'match-live' || activePage === 'match-day'

    return (
      <div className={`bg-[var(--bg-app)] text-[var(--text-main)] ${isImmersiveMode ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        <div className={`mx-auto flex w-full flex-col ${isImmersiveMode ? 'h-screen' : 'min-h-screen'} ${isImmersiveMode ? '' : 'max-w-[1820px] px-4 py-4 md:px-6 md:py-5'}`}>
          {!isImmersiveMode ? (
            <header className="rounded border border-[var(--border-strong)] bg-[var(--surface-1)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Match Control Room</p>
                <h1 className="font-heading text-2xl uppercase tracking-[0.05em]">{activeTeamName} - Match Experience</h1>
              </div>
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)] hover:border-[var(--accent)]"
              >
                Quitter le mode match
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-6">
              {steps.map((label, index) => {
                const stepNumber = index + 1
                const isCurrent = currentStepIndex === stepNumber
                const isDone = currentStepIndex > stepNumber

                return (
                  <div
                    key={label}
                    className={`rounded border px-2 py-1.5 text-center text-[10px] uppercase tracking-[0.08em] ${
                      isCurrent
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : isDone
                          ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)] text-[var(--text-main)]'
                          : 'border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    {label}
                  </div>
                )
              })}
            </div>
          </header>
          ) : null}

          <section className={`flex-1 ${isImmersiveMode ? 'overflow-hidden flex flex-col' : 'mt-4 overflow-y-auto'}`}>
            {pages[activePage]}
          </section>
        </div>

        {gameOver ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(17,20,22,0.92)] backdrop-blur-sm">
            <div className="w-full max-w-md rounded border border-red-700 bg-[var(--surface-1)] p-6">
              <p className="font-heading text-3xl uppercase tracking-[0.06em] text-red-400">Game Over</p>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                L'organisation a depose le bilan: decouvert de {formatBudgetShort(gameOver.balance)}.
                Les sponsors se retirent, les joueurs rejoignent d'autres equipes. Tu es vire par le board.
              </p>
              <button
                type="button"
                onClick={handleNewGame}
                className="mt-4 w-full rounded border border-[var(--accent)] bg-[color:rgba(200,170,110,0.18)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.28)]"
              >
                Recommencer une saison
              </button>
            </div>
          </div>
        ) : null}

        {isProcessing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(17,20,22,0.86)] backdrop-blur-sm">
            <div className="w-full max-w-md rounded border border-[var(--border-strong)] bg-[var(--surface-1)] p-5">
              <p className="font-heading text-2xl uppercase tracking-[0.06em] text-white">Traitement des donnees...</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Synchronisation mondiale des ligues en cours</p>

              <div className="mt-4 overflow-hidden rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-2">
                <div className="processing-marquee whitespace-nowrap text-sm uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  LCK · LPL · LEC · LCS · LFL · Prime League · TCL · LCK · LPL · LEC · LCS · LFL
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="w-[112px] shrink-0 border-r border-[var(--border-strong)] bg-[var(--surface-1)]">
          <div className="flex h-full flex-col gap-2 px-2 py-3">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--surface-3)] font-heading text-base tracking-[0.08em]">
              ED
            </div>

            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{group.title}</p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const showMailboxBadge = item.id === 'mailbox' && mailboxUnreadCount > 0
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActivePage(item.id)}
                      className={`group flex w-full flex-col items-center rounded border px-1 py-2 transition ${
                        activePage === item.id
                          ? 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.16)]'
                          : 'border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <span className="mb-1 flex h-7 w-7 items-center justify-center rounded bg-[var(--surface-3)]">
                        <Icon size={15} className="text-[var(--text-soft)] group-hover:text-[var(--text-main)]" />
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-center text-[10px] uppercase tracking-[0.09em] text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                          {item.label}
                        </span>
                        {showMailboxBadge ? (
                          <span className="rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-1 py-0.5 text-[9px] font-semibold text-[var(--accent)]">
                            {mailboxUnreadCount > 99 ? '99+' : mailboxUnreadCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="mt-auto pt-2">
              <button
                type="button"
                onClick={handleNewGame}
                className="w-full rounded border border-[var(--border-soft)] bg-transparent px-1 py-2 text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text-main)]"
              >
                Nvl. Partie
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--border-strong)] bg-[var(--surface-1)] px-4 py-3 md:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Esport Director - League of Legends</p>
                <h1 className="font-heading text-[1.55rem] uppercase tracking-[0.05em]">{activeTeamName}</h1>
                <p className="text-sm text-[var(--text-soft)]">
                  Manager: You | Patch: {metaPatch} | Date: {formatDateLong(currentDate)}
                </p>
              </div>

              <div className="w-full max-w-[540px] space-y-2">
                <div className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] p-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <span>Progression saison</span>
                    <span>{seasonProgress}%</span>
                  </div>
                  <div className="mb-2 h-2 rounded bg-[var(--surface-3)]">
                    <div className="h-2 rounded bg-[var(--accent)]" style={{ width: `${seasonProgress}%` }} />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--text-soft)]">
                      {matchToday ? `Match aujourd'hui: ${matchToday.opponent}` : `Prochain bloc scouting: ${scoutingQueue[0]?.daysRemaining ?? 0}j`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunInstantMatch}
                        disabled={isProcessing}
                        className={`rounded border border-cyan-400 bg-cyan-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.09em] text-cyan-100 transition hover:bg-cyan-500/30 ${isProcessing ? 'cursor-wait opacity-70' : ''}`}
                      >
                        Match instantane
                      </button>
                      <button
                        type="button"
                        onClick={handleContinue}
                        disabled={isProcessing}
                        className={`rounded border px-4 py-2 text-sm font-semibold uppercase tracking-[0.09em] transition ${
                          matchToday
                            ? 'border-rose-500 bg-rose-700 text-white hover:bg-rose-600'
                            : 'border-[var(--accent)] bg-[color:rgba(200,170,110,0.24)] text-[var(--text-main)] hover:bg-[color:rgba(200,170,110,0.34)]'
                        } ${isProcessing ? 'cursor-wait opacity-70' : ''}`}
                      >
                        {isProcessing ? 'Traitement...' : 'CONTINUER'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher un champion, un ecran, une ligue ou une equipe..."
                    className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface-2)] py-2 pl-8 pr-3 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                  />

                  {normalizedQuery && searchResults.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded border border-[var(--border-soft)] bg-[var(--surface-1)] p-1 shadow-lg">
                      {searchResults.map((result) => (
                        <button
                          key={result.key}
                          type="button"
                          onClick={result.onSelect}
                          className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
                        >
                          <span className="text-[var(--text-main)]">{result.label}</span>
                          <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{result.meta}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: 'Synergie', value: `${activeSynergy}%` },
                    { label: 'Draft', value: `+${activeDraftBonus}` },
                    { label: 'Moral', value: effectifAvecBonusTier[0]?.moral ?? 'Bon' },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                      <p className="uppercase tracking-[0.09em] text-[var(--text-muted)]">{tile.label}</p>
                      <p className="mt-0.5 font-semibold text-[var(--text-main)]">{tile.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto p-4 md:p-5">
            {timeNotification ? (
              <div className="mb-3 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
                {timeNotification}
              </div>
            ) : null}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.09em] text-[var(--text-muted)]">Ecran actif</p>
              <p className="font-heading text-xl uppercase tracking-[0.05em]">{activeNavLabel}</p>
            </div>
            {selectedChampion ? (
              <div className="mb-4">
                  <ChampionProfileCard
                    champion={selectedChampion}
                    activeLeague={activeLeague}
                    onClose={() => setSelectedChampion(null)}
                  />
              </div>
            ) : null}
            {pages[activePage]}
          </section>
        </main>
      </div>

      {isProcessing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(17,20,22,0.86)] backdrop-blur-sm">
          <div className="w-full max-w-md rounded border border-[var(--border-strong)] bg-[var(--surface-1)] p-5">
            <p className="font-heading text-2xl uppercase tracking-[0.06em] text-white">Traitement des donnees...</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Synchronisation mondiale des ligues en cours</p>

            <div className="mt-4 overflow-hidden rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-2">
              <div className="processing-marquee whitespace-nowrap text-sm uppercase tracking-[0.12em] text-[var(--text-muted)]">
                LCK · LPL · LEC · LCS · LFL · Prime League · TCL · LCK · LPL · LEC · LCS · LFL
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DecisionEventModal decision={pendingDecision} onResolve={handleResolveDecision} />
    </div>
  )
}

export default App
