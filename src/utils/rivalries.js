/**
 * rivalries.js
 * ────────────
 * Définitions des rivalités entre équipes. Une rivalité double la hype
 * du match, donne un bonus mental aux deux équipes, et peut déclencher
 * des événements médiatiques spécifiques.
 */

// ─── Rivalry catalog ─────────────────────────────────────────────────────────

/**
 * Liste des rivalités — chaque entrée matche par nom normalisé (case insensitive,
 * espaces / accents ignorés). Les rivalités sont SYMÉTRIQUES : A vs B = B vs A.
 */
export const RIVALRIES = [
  // ─── LEC ─────────────────────────────────────────
  { teamA: 'g2_esports',  teamB: 'fnatic',          tier: 'classico', label: 'Classico LEC',
    description: 'La rivalité historique européenne. Chaque match est un événement.' },
  { teamA: 'g2_esports',  teamB: 'team_bds',        tier: 'heated',   label: 'Derby Français',
    description: 'Rivalité des écuries françaises.' },
  { teamA: 'fnatic',      teamB: 'karmine_corp',    tier: 'heated',   label: 'Ancienne Garde vs Nouvelle Vague',
    description: 'Fnatic contre la nouvelle dynastie KC.' },
  { teamA: 'karmine_corp',teamB: 'vitality',        tier: 'heated',   label: 'Derby Français',
    description: 'Duel des identités françaises.' },
  { teamA: 'rogue',       teamB: 'mad_lions_koi',   tier: 'classic',  label: 'Mid Table War',
    description: 'Bataille pour la place européenne.' },

  // ─── LFL ─────────────────────────────────────────
  { teamA: 'karmine_corp_blue', teamB: 'gentle_mates', tier: 'classico', label: 'Classico LFL',
    description: 'Les deux locomotives de la LFL.' },
  { teamA: 'vitality_bee', teamB: 'karmine_corp_blue', tier: 'heated',  label: 'Derby KC vs Vit',
    description: 'Rivalité des académies françaises.' },
  { teamA: 'solary',      teamB: 'gamers_origin',    tier: 'classic', label: 'Vieux rivaux LFL',
    description: 'Rivalité historique de la scène française.' },
]

// ─── Tier styling ────────────────────────────────────────────────────────────

export const RIVALRY_TIER_STYLES = {
  classico: { color: '#ef4444', border: '#dc2626', glow: 'rgba(239,68,68,0.5)',  mentalBonus: 3, label: 'CLASSICO' },
  heated:   { color: '#f97316', border: '#ea580c', glow: 'rgba(249,115,22,0.4)', mentalBonus: 2, label: 'RIVALITÉ' },
  classic:  { color: '#eab308', border: '#ca8a04', glow: 'rgba(234,179,8,0.35)', mentalBonus: 1, label: 'DERBY' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTeamKey(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Recherche une rivalité entre deux équipes (par ID ou nom).
 * Les matchs sont symétriques : (A, B) et (B, A) donnent le même résultat.
 *
 * @param {string} teamA - team_id ou nom d'équipe
 * @param {string} teamB - team_id ou nom d'équipe
 * @returns {object | null} la rivalité trouvée ou null
 */
export function findRivalry(teamA, teamB) {
  if (!teamA || !teamB) return null
  const a = normalizeTeamKey(teamA)
  const b = normalizeTeamKey(teamB)
  if (!a || !b || a === b) return null

  for (const r of RIVALRIES) {
    const ra = normalizeTeamKey(r.teamA)
    const rb = normalizeTeamKey(r.teamB)
    if ((ra === a && rb === b) || (ra === b && rb === a)) {
      return r
    }
  }
  // Partial match: try substring matching (ex: 'karmine_corp' matches 'karmine')
  for (const r of RIVALRIES) {
    const ra = normalizeTeamKey(r.teamA)
    const rb = normalizeTeamKey(r.teamB)
    const aMatches = ra.includes(a) || a.includes(ra)
    const bMatches = rb.includes(b) || b.includes(rb)
    const aRevMatches = ra.includes(b) || b.includes(ra)
    const bRevMatches = rb.includes(a) || a.includes(rb)
    if ((aMatches && bMatches) || (aRevMatches && bRevMatches)) {
      return r
    }
  }
  return null
}

/**
 * Retourne toutes les rivalités d'une équipe donnée.
 * @param {string} teamIdOrName
 * @returns {Array<{opponent: string, tier: string, label: string}>}
 */
export function getRivalriesForTeam(teamIdOrName) {
  if (!teamIdOrName) return []
  const key = normalizeTeamKey(teamIdOrName)
  return RIVALRIES.filter((r) => {
    const ra = normalizeTeamKey(r.teamA)
    const rb = normalizeTeamKey(r.teamB)
    return ra === key || rb === key || ra.includes(key) || rb.includes(key) || key.includes(ra) || key.includes(rb)
  }).map((r) => ({
    opponent: normalizeTeamKey(r.teamA) === key ? r.teamB : r.teamA,
    tier: r.tier,
    label: r.label,
    description: r.description,
  }))
}
