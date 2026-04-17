/**
 * minimapCoords.js
 * ────────────────
 * Helpers pour convertir des coordonnées brutes de simulation vers le
 * repère [0, 100] attendu par <TacticalMinimap />.
 */

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Convertit une coordonnée dans un repère arbitraire vers [0, 100].
 *
 * Exemple : Riot utilise un repère 0-14870 avec Y inversé (0 en bas).
 *   normalizeToMinimap({ x: 7500, y: 7500 }, { xMax: 14870, yMax: 14870, invertY: true })
 *   // → { x: 50.4, y: 49.6 }
 *
 * @param {{ x: number, y: number }} raw
 * @param {{ xMin?: number, xMax: number, yMin?: number, yMax: number, invertY?: boolean }} bounds
 * @returns {{ x: number, y: number }} dans [0, 100]
 */
export function normalizeToMinimap(raw, bounds) {
  const xMin = bounds.xMin ?? 0
  const yMin = bounds.yMin ?? 0
  const x = ((raw.x - xMin) / (bounds.xMax - xMin)) * 100
  const yRatio = ((raw.y - yMin) / (bounds.yMax - yMin)) * 100
  const y = bounds.invertY ? 100 - yRatio : yRatio
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) }
}

/**
 * Normalise un batch de joueurs en un seul appel.
 *
 * @param {Array<{ id: string, x: number, y: number, [k: string]: any }>} players
 * @param {Parameters<typeof normalizeToMinimap>[1]} bounds
 * @returns même structure mais avec (x, y) ∈ [0, 100]
 */
export function normalizePlayers(players, bounds) {
  return players.map((p) => ({ ...p, ...normalizeToMinimap(p, bounds) }))
}
