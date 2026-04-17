const SAVE_KEY = 'lol_manager_v1'

function replacer(_key, value) {
  if (value instanceof Date) {
    return { __type: 'Date', iso: value.toISOString() }
  }
  return value
}

function reviver(_key, value) {
  if (value && typeof value === 'object' && value.__type === 'Date') {
    return new Date(value.iso)
  }
  return value
}

export function saveGameState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state, replacer))
  } catch {
    // localStorage indisponible ou quota depassé
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw, reviver)
  } catch {
    return null
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // localStorage indisponible — catch sans binding intentionnel
  }
}
