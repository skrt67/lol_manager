import { motion, AnimatePresence } from 'framer-motion'

const MotionDiv = motion.div

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const ROLE_INITIAL = { Top: 'T', Jungle: 'J', Mid: 'M', ADC: 'A', Support: 'S' }

const CDN = '16.7.1'
const DDR_OVERRIDES = {
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

function getChampionUrl(championId) {
  if (!championId) return null
  const id = DDR_OVERRIDES[championId] ?? championId
  return `https://ddragon.leagueoflegends.com/cdn/${CDN}/img/champion/${id}.png`
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function lerp(from, to, alpha) {
  return {
    x: from.x + ((to.x - from.x) * alpha),
    y: from.y + ((to.y - from.y) * alpha),
  }
}

function stableHash(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash
}

function pointOnPolyline(points, t) {
  if (!points?.length) return { x: 50, y: 50 }
  if (points.length === 1) return points[0]

  const alpha = clamp(t, 0, 1)
  const scaled = alpha * (points.length - 1)
  const index = Math.floor(scaled)
  const local = scaled - index
  const from = points[index]
  const to = points[Math.min(index + 1, points.length - 1)]
  return lerp(from, to, local)
}

const LANE_PATHS = {
  top: [
    { x: 12, y: 86 },
    { x: 14, y: 70 },
    { x: 15, y: 52 },
    { x: 18, y: 32 },
    { x: 34, y: 16 },
    { x: 52, y: 14 },
    { x: 70, y: 14 },
    { x: 86, y: 12 },
  ],
  mid: [
    { x: 22, y: 78 },
    { x: 30, y: 68 },
    { x: 38, y: 58 },
    { x: 50, y: 50 },
    { x: 62, y: 42 },
    { x: 70, y: 32 },
    { x: 78, y: 22 },
  ],
  bot: [
    { x: 34, y: 86 },
    { x: 50, y: 86 },
    { x: 66, y: 86 },
    { x: 82, y: 82 },
    { x: 86, y: 66 },
    { x: 86, y: 50 },
    { x: 86, y: 34 },
    { x: 88, y: 18 },
  ],
}

const LANE_CLASH_POINTS = {
  top: { x: 33, y: 17 },
  mid: { x: 50, y: 50 },
  bot: { x: 82, y: 67 },
}

const ROLE_LANE = {
  Top: 'top',
  Mid: 'mid',
  ADC: 'bot',
  Support: 'bot',
}

const ROLE_OFFSETS = {
  Top: { x: -1.2, y: -1.8 },
  Mid: { x: 0, y: 0 },
  ADC: { x: 1.5, y: 1.4 },
  Support: { x: -1.5, y: -1.2 },
}

const JUNGLE_PATROLS = {
  team: [
    { x: 34, y: 74 },
    { x: 41, y: 82 },
    { x: 53, y: 79 },
    { x: 45, y: 69 },
    { x: 36, y: 60 },
    { x: 43, y: 53 },
    { x: 52, y: 58 },
  ],
  enemy: [
    { x: 66, y: 26 },
    { x: 59, y: 18 },
    { x: 47, y: 21 },
    { x: 55, y: 31 },
    { x: 64, y: 40 },
    { x: 57, y: 47 },
    { x: 48, y: 42 },
  ],
}

const OBJECTIVES = {
  dragon: { x: 65, y: 64 },
  mid: { x: 50, y: 50 },
  baron: { x: 36, y: 36 },
}

const TEAMFIGHT_OFFSETS = {
  Top: { x: -8, y: -5 },
  Jungle: { x: -3, y: -2 },
  Mid: { x: 0, y: 0 },
  ADC: { x: 5, y: 4 },
  Support: { x: 2, y: 6 },
}

const BLUE_TOWERS = [
  { id: 'bm1', x: 38, y: 58 }, { id: 'bt1', x: 18, y: 30 }, { id: 'bb1', x: 66, y: 86 },
  { id: 'bm2', x: 30, y: 68 }, { id: 'bt2', x: 15, y: 48 }, { id: 'bb2', x: 50, y: 86 },
  { id: 'bm3', x: 23, y: 76 }, { id: 'bt3', x: 13, y: 66 }, { id: 'bb3', x: 34, y: 86 },
  { id: 'bn1', x: 17, y: 80 }, { id: 'bn2', x: 14, y: 84 },
]

const RED_TOWERS = [
  { id: 'rm1', x: 62, y: 42 }, { id: 'rt1', x: 34, y: 14 }, { id: 'rb1', x: 86, y: 66 },
  { id: 'rm2', x: 70, y: 32 }, { id: 'rt2', x: 48, y: 14 }, { id: 'rb2', x: 86, y: 50 },
  { id: 'rm3', x: 77, y: 24 }, { id: 'rt3', x: 66, y: 14 }, { id: 'rb3', x: 86, y: 34 },
  { id: 'rn1', x: 83, y: 20 }, { id: 'rn2', x: 86, y: 16 },
]

const OBJECTIVE_LABELS = {
  dragon: { label: 'DRG', color: 'rgba(45,212,191,0.9)', glow: 'rgba(20,184,166,0.3)' },
  baron: { label: 'BSN', color: 'rgba(192,132,252,0.9)', glow: 'rgba(168,85,247,0.3)' },
  mid: { label: 'MID', color: 'rgba(251,191,36,0.9)', glow: 'rgba(245,158,11,0.25)' },
}

function objectiveKeyFromPosition(objective) {
  if (!objective) return 'dragon'
  if (Math.abs(objective.x - 36) < 0.8 && Math.abs(objective.y - 36) < 0.8) return 'baron'
  if (Math.abs(objective.x - 50) < 0.8 && Math.abs(objective.y - 50) < 0.8) return 'mid'
  return 'dragon'
}

function deriveKillEvent(evt) {
  if (!evt || Math.abs(evt.deltaGold ?? 0) < 350) return null
  const winnerSide = (evt.deltaGold ?? 0) >= 0 ? 'team' : 'enemy'
  const killerRole = ROLES[stableHash(`${evt.minute}-killer`) % ROLES.length]
  let victimRole = ROLES[stableHash(`${evt.minute}-victim`) % ROLES.length]
  if (victimRole === killerRole) victimRole = ROLES[(ROLES.indexOf(victimRole) + 1) % ROLES.length]
  return { winnerSide, loserSide: winnerSide === 'team' ? 'enemy' : 'team', killerRole, victimRole }
}

function getObjectiveForMinute(minute) {
  if (minute <= 14) return OBJECTIVES.dragon
  if (minute <= 25) return OBJECTIVES.mid
  return OBJECTIVES.baron
}

function getModeFromEvent(event, minute, aggressivite = 50) {
  if (event?.phaseId === 'early') {
    return Math.abs(event?.deltaGold ?? 0) > 1200 ? 'gank' : 'lane'
  }

  if (event?.phaseId === 'late') {
    return 'teamfight'
  }

  const swing = Math.abs(event?.deltaGold ?? 0)
  if (swing >= 1500 || aggressivite >= 72) {
    return 'teamfight'
  }

  if (swing >= 850) {
    return 'gank'
  }

  if (minute <= 12) {
    return 'lane'
  }

  return 'gank'
}

function pickGankLane(minute, matchId) {
  const lanes = ['top', 'mid', 'bot']
  return lanes[stableHash(`${matchId}-${minute}-gank`) % lanes.length]
}

function buildLanePosition({ side, role, laneName, minute, mode, matchId, targetLane }) {
  const path = LANE_PATHS[laneName] ?? LANE_PATHS.mid
  const progress = clamp(0.18 + (minute * 0.019), 0.18, 0.58)
  const sideProgress = side === 'team' ? progress : 1 - progress

  let point = pointOnPolyline(path, sideProgress)

  if (mode === 'gank' && targetLane === laneName) {
    const clashPoint = LANE_CLASH_POINTS[laneName] ?? LANE_CLASH_POINTS.mid
    point = lerp(point, clashPoint, role === 'Support' ? 0.46 : 0.55)
  }

  if (mode === 'gank' && role === 'Support' && minute >= 8 && laneName === 'bot' && targetLane !== 'bot') {
    const supportRoamTarget = targetLane === 'top' ? { x: 36, y: 34 } : { x: 47, y: 52 }
    point = lerp(point, supportRoamTarget, 0.52)
  }

  const offset = ROLE_OFFSETS[role] ?? { x: 0, y: 0 }
  point = {
    x: point.x + (side === 'team' ? offset.x : -offset.x),
    y: point.y + (side === 'team' ? offset.y : -offset.y),
  }

  const jitter = mode === 'lane' ? 0.45 : 0.65
  point = {
    x: point.x + (((stableHash(`${matchId}-${side}-${role}-${minute}-jx`) % 5) - 2) * jitter),
    y: point.y + (((stableHash(`${matchId}-${side}-${role}-${minute}-jy`) % 5) - 2) * jitter),
  }

  return point
}

function buildJunglePosition({ side, minute, mode, targetLane, objective, matchId }) {
  const patrol = JUNGLE_PATROLS[side]
  const cycle = ((minute * 0.62) + ((stableHash(`${matchId}-${side}-cycle`) % 100) / 100)) % patrol.length
  const cycleIndex = Math.floor(cycle)
  const nextIndex = (cycleIndex + 1) % patrol.length
  const local = cycle - cycleIndex
  const patrolPoint = lerp(patrol[cycleIndex], patrol[nextIndex], local)

  if (mode === 'teamfight') {
    const tfOffset = side === 'team' ? { x: -3.2, y: -2.5 } : { x: 3.2, y: 2.5 }
    return {
      x: objective.x + tfOffset.x,
      y: objective.y + tfOffset.y,
    }
  }

  if (mode === 'gank') {
    const clash = LANE_CLASH_POINTS[targetLane] ?? LANE_CLASH_POINTS.mid
    const sideAnchor = side === 'team'
      ? { x: clash.x - 5.5, y: clash.y + 4.5 }
      : { x: clash.x + 5.5, y: clash.y - 4.5 }
    return lerp(patrolPoint, sideAnchor, 0.78)
  }

  return patrolPoint
}

function buildAllPositions({ mode, minute, objective, matchId, killEvent }) {
  const positions = {}
  const seed = matchId ?? 'live-match'
  const targetLane = pickGankLane(minute, seed)

  for (const side of ['team', 'enemy']) {
    for (const role of ROLES) {
      let point

      if (role === 'Jungle') {
        point = buildJunglePosition({
          side,
          minute,
          mode,
          targetLane,
          objective,
          matchId: seed,
        })
      } else if (mode === 'teamfight') {
        const offset = TEAMFIGHT_OFFSETS[role] ?? { x: 0, y: 0 }
        const dir = side === 'team' ? 1 : -1
        point = {
          x: objective.x + (offset.x * dir),
          y: objective.y + (offset.y * dir),
        }
      } else {
        const laneName = ROLE_LANE[role] ?? 'mid'
        point = buildLanePosition({
          side,
          role,
          laneName,
          minute,
          mode,
          matchId: seed,
          targetLane,
        })
      }

      let finalPoint = {
        x: point.x,
        y: point.y,
      }

      if (killEvent?.killerRole === role && killEvent?.winnerSide === side) {
        const dir = side === 'team' ? 1 : -1
        finalPoint = {
          x: finalPoint.x + (4.5 * dir),
          y: finalPoint.y - (4 * dir),
        }
      }

      positions[`${side}-${role}`] = {
        x: clamp(finalPoint.x, 6, 94),
        y: clamp(finalPoint.y, 6, 94),
      }
    }
  }

  return positions
}

export default function MatchMap({ liveSession, currentIndex, aggressivite = 50 }) {
  const currentEvent = liveSession?.timeline?.[currentIndex] ?? null
  const killEvent = deriveKillEvent(currentEvent)
  const minute = currentEvent?.minute ?? 0
  const goldDiff = currentEvent?.goldDiff ?? 0

  const matchId = liveSession?.matchId ?? 'live'
  const mode = getModeFromEvent(currentEvent, minute, aggressivite)
  const objective = getObjectiveForMinute(minute)
  const positions = buildAllPositions({ mode, minute, objective, matchId, killEvent })

  const deadUnitId = killEvent ? `${killEvent.loserSide}-${killEvent.victimRole}` : null
  const teamTowers = currentEvent?.scoreboard?.team?.towers ?? 0
  const enemyTowers = currentEvent?.scoreboard?.enemy?.towers ?? 0

  const objectiveKey = objectiveKeyFromPosition(objective)
  const obj = { ...objective, ...(OBJECTIVE_LABELS[objectiveKey] ?? OBJECTIVE_LABELS.dragon) }

  const phaseLabel = mode === 'teamfight' ? '⚔ TEAMFIGHT' : mode === 'gank' ? '↯ GANK' : '— LANING'
  const phaseColor = mode === 'teamfight'
    ? 'text-red-300 border-red-700/60 bg-red-950/50'
    : mode === 'gank'
      ? 'text-yellow-300 border-yellow-700/60 bg-yellow-950/50'
      : 'text-slate-300 border-slate-700/40 bg-slate-900/50'

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-[rgba(203,213,225,0.2)] bg-[#08111c]">
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${CDN}/img/map/map11.png`}
        className="absolute inset-0 h-full w-full object-contain opacity-[0.96]"
        alt="Summoners Rift"
        draggable={false}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/16 via-transparent to-black/26" />

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pointer-events-none">
        {/* Draw subtle grid lines or lanes */}
        
        {/* Highlight objective circles */}
        <circle cx={obj.x} cy={obj.y} r="8" fill={obj.glow} stroke={obj.color} strokeWidth="0.4" opacity="0.6" />
        
        {/* Towers as glowing pillars */}
        {BLUE_TOWERS.map((t, i) => {
          const dead = i < enemyTowers;
          return (
            <g key={t.id} className="transition-all duration-700">
              <ellipse cx={t.x} cy={t.y+1} rx="2.5" ry="1.5" fill="rgba(0,0,0,0.5)" />
              <rect x={t.x-1.5} y={t.y-3} width="3" height="4" fill={dead ? '#334155' : '#1e3a8a'} stroke={dead ? '#475569' : '#3b82f6'} strokeWidth="0.3" />
              <circle cx={t.x} cy={t.y-3} r="1.5" fill={dead ? '#475569' : '#60a5fa'} />
            </g>
          )
        })}
        
        {RED_TOWERS.map((t, i) => {
          const dead = i < teamTowers;
          return (
            <g key={t.id} className="transition-all duration-700">
              <ellipse cx={t.x} cy={t.y+1} rx="2.5" ry="1.5" fill="rgba(0,0,0,0.5)" />
              <rect x={t.x-1.5} y={t.y-3} width="3" height="4" fill={dead ? '#450a0a' : '#7f1d1d'} stroke={dead ? '#7f1d1d' : '#ef4444'} strokeWidth="0.3" />
              <circle cx={t.x} cy={t.y-3} r="1.5" fill={dead ? '#7f1d1d' : '#f87171'} />
            </g>
          )
        })}
      </svg>

      {['team', 'enemy'].flatMap((side) =>
        ROLES.map((role) => {
          const unitId = `${side}-${role}`
          const pos = positions[unitId]
          const isDead = deadUnitId === unitId
          const isKillerUnit = killEvent !== null && killEvent.killerRole === role && killEvent.winnerSide === side
          if (!pos || isDead) return null

          const isBlue = side === 'team'
          const championKey = isBlue
            ? liveSession?.draftState?.playerPicks?.[role]
            : liveSession?.draftState?.enemyPicks?.[role]
          const championId = championKey?.split('-')[0] ?? null
          const imgUrl = getChampionUrl(championId)

          const ringClass = isBlue
            ? 'border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.85),0_0_20px_rgba(59,130,246,0.4)]'
            : 'border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.85),0_0_20px_rgba(239,68,68,0.4)]'
          const bgClass = isBlue ? 'bg-blue-900' : 'bg-red-900'

          return (
            <MotionDiv
              key={unitId}
              className={`absolute z-20 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 text-[9px] font-bold uppercase text-white ${ringClass} ${bgClass}`}
              animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              transition={{ left: { type: 'tween', duration: 1.15, ease: 'easeOut' }, top: { type: 'tween', duration: 1.15, ease: 'easeOut' } }}
              style={{ transform: 'translate(-50%, -50%)' }}
            >
              {imgUrl ? (
                <img src={imgUrl} alt={championId ?? role} className="h-full w-full scale-110 rounded-full object-cover" draggable={false} />
              ) : (
                <span>{ROLE_INITIAL[role]}</span>
              )}

              <AnimatePresence>
                {isKillerUnit && (
                  <motion.div
                    key={`flash-${killEvent?.victimRole}-${killEvent?.loserSide}`}
                    className="pointer-events-none absolute inset-0 rounded-full border-4 border-yellow-300"
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 0, scale: 2.8 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                )}
              </AnimatePresence>
            </MotionDiv>
          )
        }),
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-center pb-1">
        <div className="flex items-center gap-2 rounded border border-slate-700/40 bg-black/60 px-3 py-0.5 text-[9px] backdrop-blur-sm">
          <span className="font-bold text-blue-400">{goldDiff >= 0 ? `+${(goldDiff / 1000).toFixed(1)}K` : ''}</span>
          <div className="h-1 w-24 overflow-hidden rounded bg-slate-700">
            <div
              className={`h-1 rounded transition-all duration-700 ${goldDiff >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
              style={{ width: `${clamp(50 + (goldDiff / 8000) * 50, 5, 95)}%`, marginLeft: goldDiff >= 0 ? 0 : 'auto' }}
            />
          </div>
          <span className="font-bold text-red-400">{goldDiff < 0 ? `+${(Math.abs(goldDiff) / 1000).toFixed(1)}K` : ''}</span>
        </div>
      </div>

      <div className={`pointer-events-none absolute left-2 top-2 rounded border px-2 py-0.5 text-[9px] font-bold tracking-[0.1em] backdrop-blur-sm ${phaseColor}`}>
        {phaseLabel}
      </div>

      <div className="pointer-events-none absolute right-2 top-2 rounded border border-slate-700/50 bg-black/60 px-2 py-0.5 text-[10px] font-mono font-bold text-white backdrop-blur-sm">
        {String(minute).padStart(2, '0')}:00
      </div>
    </div>
  )
}
