import {
  CHAMPIONS_BY_ROLE,
  CHAMPIONS_DB,
  CHAMPION_TAG_INDEX,
  NO_LUCK_COMBOS,
} from '../data.js'

function normalizeChampionId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const championIndex = CHAMPIONS_DB.reduce((acc, champion) => {
  acc[normalizeChampionId(champion.id)] = champion
  acc[normalizeChampionId(champion.name)] = champion
  return acc
}, {})

export function getChampionById(id) {
  return championIndex[normalizeChampionId(id)] ?? null
}

export function getChampionsByRole(role) {
  return CHAMPIONS_BY_ROLE[role] ?? []
}

export function getChampionsByTag(tag) {
  const championIds = CHAMPION_TAG_INDEX[tag] ?? []
  return championIds.map((id) => getChampionById(id)).filter(Boolean)
}

export function listAvailableRoles() {
  return Object.keys(CHAMPIONS_BY_ROLE)
}

export function listAvailableTags() {
  return Object.keys(CHAMPION_TAG_INDEX)
}

export function getJunglePathingStats(championId) {
  const champion = getChampionById(championId)
  if (!champion || champion.role !== 'Jungle') {
    return null
  }

  return champion.jungleStats ?? null
}

export function rankJunglersByPathing(metric = 'ClearSpeed', limit = 10) {
  const allowedMetrics = ['ClearSpeed', 'GankPressure', 'ObjectiveControl']
  const selectedMetric = allowedMetrics.includes(metric) ? metric : 'ClearSpeed'

  return getChampionsByRole('Jungle')
    .filter((champion) => champion.jungleStats)
    .sort((a, b) => b.jungleStats[selectedMetric] - a.jungleStats[selectedMetric])
    .slice(0, limit)
    .map((champion, index) => ({
      rank: index + 1,
      id: champion.id,
      name: champion.name,
      value: champion.jungleStats[selectedMetric],
    }))
}

export function getMidlaneMacroStats(championId) {
  const champion = getChampionById(championId)
  if (!champion || champion.role !== 'Mid') {
    return null
  }

  return champion.midlaneStats ?? null
}

export function rankMidlanersByMacro(metric = 'RoamPotential', limit = 10) {
  const allowedMetrics = [
    'RoamPotential',
    'LanePriority',
    'ManaManagement',
    'EnergyManagement',
  ]
  const selectedMetric = allowedMetrics.includes(metric) ? metric : 'RoamPotential'

  return getChampionsByRole('Mid')
    .filter((champion) => champion.midlaneStats)
    .sort((a, b) => b.midlaneStats[selectedMetric] - a.midlaneStats[selectedMetric])
    .slice(0, limit)
    .map((champion, index) => ({
      rank: index + 1,
      id: champion.id,
      name: champion.name,
      value: champion.midlaneStats[selectedMetric],
    }))
}

export function evaluateNoLuckCombos(teamChampionIds) {
  const normalizedTeam = new Set(teamChampionIds.map((id) => normalizeChampionId(id)))

  const activeCombos = NO_LUCK_COMBOS.filter((combo) =>
    combo.requirements.every((requirement) => normalizedTeam.has(normalizeChampionId(requirement))),
  )

  const bonusSummary = activeCombos.reduce(
    (acc, combo) => {
      acc[combo.bonus.stat] = (acc[combo.bonus.stat] ?? 0) + combo.bonus.value
      return acc
    },
    {},
  )

  return {
    activeCombos,
    bonusSummary,
  }
}
