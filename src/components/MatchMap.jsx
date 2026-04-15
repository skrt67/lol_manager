import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const MotionDiv = motion.div

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

const CHAMPION_IMAGE_CDN_VERSION = '16.7.1'

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

function getChampionUrl(championId) {
  if (!championId) return null
  const ddragonId = CHAMPION_IMAGE_ID_OVERRIDES[championId] ?? championId
  return `https://ddragon.leagueoflegends.com/cdn/${CHAMPION_IMAGE_CDN_VERSION}/img/champion/${ddragonId}.png`
}

const ROLE_INITIAL = {
  Top: 'T',
  Jungle: 'J',
  Mid: 'M',
  ADC: 'A',
  Support: 'S',
}

const TEAM_LANE_POSITIONS = {
  Top: { x: 18, y: 30 },
  Jungle: { x: 31, y: 62 },
  Mid: { x: 30, y: 70 },
  ADC: { x: 56, y: 86 },
  Support: { x: 48, y: 86 },
}

const ENEMY_LANE_POSITIONS = {
  Top: { x: 66, y: 14 },
  Jungle: { x: 69, y: 38 },
  Mid: { x: 70, y: 30 },
  ADC: { x: 86, y: 56 },
  Support: { x: 86, y: 48 },
}

const LANE_CONTEST_POINTS = {
  Top: { x: 42, y: 16 },
  Mid: { x: 50, y: 50 },
  ADC: { x: 78, y: 62 },
  Support: { x: 74, y: 64 },
}

const ROLE_CLUSTER_OFFSETS = {
  Top: { x: -8, y: -5 },
  Jungle: { x: -3, y: -2 },
  Mid: { x: 0, y: 0 },
  ADC: { x: 5, y: 4 },
  Support: { x: 2, y: 7 },
}


const BLUE_TOWERS = [
  { id: 'bm1', x: 38, y: 58 },
  { id: 'bt1', x: 18, y: 30 },
  { id: 'bb1', x: 66, y: 86 },
  { id: 'bm2', x: 30, y: 68 },
  { id: 'bt2', x: 15, y: 48 },
  { id: 'bb2', x: 50, y: 86 },
  { id: 'bm3', x: 23, y: 76 },
  { id: 'bt3', x: 13, y: 66 },
  { id: 'bb3', x: 34, y: 86 },
  { id: 'bn1', x: 17, y: 80 },
  { id: 'bn2', x: 14, y: 84 },
]

const RED_TOWERS = [
  { id: 'rm1', x: 62, y: 42 },
  { id: 'rt1', x: 34, y: 14 },
  { id: 'rb1', x: 86, y: 66 },
  { id: 'rm2', x: 70, y: 32 },
  { id: 'rt2', x: 48, y: 14 },
  { id: 'rb2', x: 86, y: 50 },
  { id: 'rm3', x: 77, y: 24 },
  { id: 'rt3', x: 66, y: 14 },
  { id: 'rb3', x: 86, y: 34 },
  { id: 'rn1', x: 83, y: 20 },
  { id: 'rn2', x: 86, y: 16 },
]

const OBJECTIVES = {
  dragon: { x: 65, y: 64, label: 'DRG' },
  nashor: { x: 36, y: 36, label: 'BSN' },
  center: { x: 50, y: 50, label: 'MID' },
}

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

function lerpPoint(from, to, alpha) {
  return {
    x: from.x + ((to.x - from.x) * alpha),
    y: from.y + ((to.y - from.y) * alpha),
  }
}

function getPhaseMode(event) {
  if (!event) {
    return 'lane'
  }

  if (event.phaseId === 'early') {
    return event.minute % 6 === 0 ? 'gank' : 'lane'
  }

  if (event.phaseId === 'mid') {
    if (event.minute % 4 === 0) {
      return 'teamfight'
    }

    return event.minute % 3 === 0 ? 'gank' : 'lane'
  }

  return 'teamfight'
}

function getObjectiveByMinute(minute) {
  if (minute <= 20) {
    return OBJECTIVES.dragon
  }
  if (minute <= 26) {
    return OBJECTIVES.center
  }
  return OBJECTIVES.nashor
}

function getRoleForAction(minute, seedSuffix, fallbackRole) {
  if (fallbackRole === 'Mid' || fallbackRole === 'Top' || fallbackRole === 'ADC' || fallbackRole === 'Support') {
    return fallbackRole
  }

  const gankRoles = ['Top', 'Mid', 'ADC']
  return gankRoles[stableHash(`${minute}-${seedSuffix}`) % gankRoles.length]
}

function deriveKillEvent(currentEvent) {
  if (!currentEvent || Math.abs(currentEvent.deltaGold ?? 0) < 350) {
    return null
  }

  const winnerSide = (currentEvent.deltaGold ?? 0) >= 0 ? 'team' : 'enemy'
  const loserSide = winnerSide === 'team' ? 'enemy' : 'team'

  const killerRole = ROLES[stableHash(`${currentEvent.minute}-killer`) % ROLES.length]
  let victimRole = ROLES[stableHash(`${currentEvent.minute}-victim`) % ROLES.length]

  if (victimRole === killerRole) {
    victimRole = ROLES[(ROLES.indexOf(victimRole) + 1) % ROLES.length]
  }

  return {
    winnerSide,
    loserSide,
    killerRole,
    victimRole,
  }
}

function getUnitBasePosition(side, role) {
  return side === 'team' ? TEAM_LANE_POSITIONS[role] : ENEMY_LANE_POSITIONS[role]
}

function buildUnitPositions({ mode, minute, focusRole, killEvent }) {
  const objective = getObjectiveByMinute(minute)
  const teamGankRole = getRoleForAction(minute, 'team-gank', focusRole)
  const enemyGankRole = getRoleForAction(minute, 'enemy-gank', null)

  const positions = {}

  ;['team', 'enemy'].forEach((side) => {
    ROLES.forEach((role) => {
      const unitId = `${side}-${role}`
      const lanePoint = getUnitBasePosition(side, role)
      let point = { ...lanePoint }

      if (mode === 'lane') {
        if (role !== 'Jungle') {
          const contestPoint = LANE_CONTEST_POINTS[role] ?? lanePoint
          const laneAlpha = clamp((minute - 2) / 16, 0, 0.45)
          point = lerpPoint(lanePoint, contestPoint, laneAlpha)
        }

        const jitterX = ((stableHash(`${unitId}-${minute}-jx`) % 5) - 2) * 0.45
        const jitterY = ((stableHash(`${unitId}-${minute}-jy`) % 5) - 2) * 0.45
        point = {
          x: point.x + jitterX,
          y: point.y + jitterY,
        }
      }

      if (mode === 'gank' && role === 'Jungle') {
        const targetRole = side === 'team' ? teamGankRole : enemyGankRole
        const targetPoint = side === 'team' ? ENEMY_LANE_POSITIONS[targetRole] : TEAM_LANE_POSITIONS[targetRole]
        point = lerpPoint(lanePoint, targetPoint, 0.58)
      }

      if (mode === 'teamfight') {
        const offset = ROLE_CLUSTER_OFFSETS[role] ?? { x: 0, y: 0 }
        const sideDirection = side === 'team' ? 1 : -1
        point = {
          x: objective.x + (offset.x * sideDirection),
          y: objective.y + (offset.y * sideDirection),
        }
      }

      if (killEvent && killEvent.killerRole === role && killEvent.winnerSide === side) {
        const pushX = side === 'team' ? 9 : -9
        const pushY = side === 'team' ? -9 : 9
        point = {
          x: point.x + pushX,
          y: point.y + pushY,
        }
      }

      positions[unitId] = {
        x: clamp(point.x, 4, 96),
        y: clamp(point.y, 4, 96),
      }
    })
  })

  return {
    positions,
    objective,
  }
}

export default function MatchMap({ liveSession, currentIndex, focusRole }) {
  const [deadRecords, setDeadRecords] = useState({})

  const currentEvent = liveSession?.timeline?.[currentIndex] ?? null
  const mode = getPhaseMode(currentEvent)
  const killEvent = deriveKillEvent(currentEvent)
  const killLoserSide = killEvent?.loserSide ?? null
  const killVictimRole = killEvent?.victimRole ?? null

  useEffect(() => {
    if (!killLoserSide || !killVictimRole) {
      return undefined
    }

    const victimId = `${killLoserSide}-${killVictimRole}`
    const minute = currentEvent?.minute ?? 0

    setDeadRecords((prev) => ({
      ...prev,
      [victimId]: minute,
    }))
  }, [killLoserSide, killVictimRole, currentEvent?.minute])

  const teamTowersDestroyed = currentEvent?.scoreboard?.team?.towers ?? 0
  const enemyTowersDestroyed = currentEvent?.scoreboard?.enemy?.towers ?? 0

  const mapState = buildUnitPositions({
    mode,
    minute: currentEvent?.minute ?? 0,
    focusRole,
    killEvent,
  })

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded border border-[color:rgba(203,213,225,0.28)] bg-[#0a0f18]">
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${CHAMPION_IMAGE_CDN_VERSION}/img/map/map11.png`}
        className="absolute inset-0 h-full w-full object-cover opacity-[0.85] mix-blend-lighten"
        alt="Summoners Rift"
      />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full pointer-events-none">
        {/* Lignes principales */}
        <path d="M 13 66 L 15 48 L 18 30 L 34 14 L 48 14 L 66 14" fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth="1.6" />
        <path d="M 23 76 L 30 68 L 38 58 L 50 50 L 62 42 L 70 32 L 77 24" fill="none" stroke="rgba(226,232,240,0.15)" strokeWidth="2.1" />
        <path d="M 34 86 L 50 86 L 66 86 L 86 66 L 86 50 L 86 34" fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth="1.6" />

        <circle cx={OBJECTIVES.dragon.x} cy={OBJECTIVES.dragon.y} r="4.5" fill="rgba(20,184,166,0.15)" stroke="rgba(45,212,191,0.4)" strokeWidth="0.8" />
        <circle cx={OBJECTIVES.nashor.x} cy={OBJECTIVES.nashor.y} r="4.5" fill="rgba(168,85,247,0.15)" stroke="rgba(192,132,252,0.4)" strokeWidth="0.8" />

        <rect x="3" y="82" width="14" height="14" rx="2" fill="rgba(59,130,246,0.2)" stroke="rgba(96,165,250,0.7)" strokeWidth="1" />
        <rect x="83" y="4" width="14" height="14" rx="2" fill="rgba(239,68,68,0.2)" stroke="rgba(248,113,113,0.7)" strokeWidth="1" />

        {/* Tours Bleues (detruites par l'equipe Red "enemyTowersDestroyed") */}
        {BLUE_TOWERS.map((t, i) => {
          const isDestroyed = i < enemyTowersDestroyed
          return (
            <circle
              key={t.id}
              cx={t.x}
              cy={t.y}
              r="1.8"
              fill={isDestroyed ? "rgba(71,85,105,0.4)" : "rgba(59,130,246,0.9)"}
              stroke={isDestroyed ? "rgba(100,116,139,0.5)" : "rgba(147,197,253,1)"}
              strokeWidth="0.6"
              className="transition-all duration-1000"
            />
          )
        })}

        {/* Tours Rouges (detruites par l'equipe Blue "teamTowersDestroyed") */}
        {RED_TOWERS.map((t, i) => {
          const isDestroyed = i < teamTowersDestroyed
          return (
            <circle
              key={t.id}
              cx={t.x}
              cy={t.y}
              r="1.8"
              fill={isDestroyed ? "rgba(71,85,105,0.4)" : "rgba(239,68,68,0.9)"}
              stroke={isDestroyed ? "rgba(100,116,139,0.5)" : "rgba(252,165,165,1)"}
              strokeWidth="0.6"
              className="transition-all duration-1000"
            />
          )
        })}
      </svg>

      <div
        className="absolute z-10 rounded border border-cyan-300/60 bg-cyan-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-100 backdrop-blur-sm"
        style={{
          left: `${mapState.objective.x}%`,
          top: `${mapState.objective.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {mapState.objective.label}
      </div>

      {['team', 'enemy'].flatMap((side) => (
        ROLES.map((role) => {
          const unitId = `${side}-${role}`
          const position = mapState.positions[unitId]
          const isRespawning = deadRecords[unitId] === (currentEvent?.minute ?? -1)

          if (!position || isRespawning) {
            return null
          }

          const isBlue = side === 'team'
          const championKey = isBlue
            ? liveSession?.draftState?.playerPicks?.[role]
            : liveSession?.draftState?.enemyPicks?.[role]
          
          let content = ROLE_INITIAL[role]
          let hasImage = false

          if (championKey) {
            // Extrait l'id du champion du format "Aatrox-Top"
            const championId = championKey.split('-')[0]
            const imgUrl = getChampionUrl(championId)
            if (imgUrl) {
              hasImage = true
              content = (
                <img
                  src={imgUrl}
                  alt={championId}
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextSibling.style.display = 'flex'
                  }}
                />
              )
            }
          }

          const colorClass = isBlue
            ? 'border-blue-400 bg-blue-900 shadow-[0_0_12px_rgba(59,130,246,0.7)]'
            : 'border-red-400 bg-red-900 shadow-[0_0_12px_rgba(239,68,68,0.7)]'

          return (
            <MotionDiv
              key={unitId}
              className={`absolute z-20 flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] text-[10px] font-bold uppercase text-white overflow-hidden ${colorClass}`}
              animate={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                scale: mode === 'lane' ? [1, 1.08, 1] : 1,
              }}
              transition={{
                left: { type: 'spring', stiffness: 140, damping: 18 },
                top: { type: 'spring', stiffness: 140, damping: 18 },
                scale: { duration: 0.8, repeat: mode === 'lane' ? Infinity : 0, ease: 'easeInOut' },
              }}
              style={{ transform: 'translate(-50%, -50%)' }}
            >
              {content}
              {hasImage && (
                <span className="absolute inset-0 hidden items-center justify-center bg-inherit">
                  {ROLE_INITIAL[role]}
                </span>
              )}
            </MotionDiv>
          )
        })
      ))}

      <div className="pointer-events-none absolute left-2 top-2 rounded border border-slate-200/20 bg-slate-900/55 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-slate-300">
        {mode === 'lane' ? 'Lane Phase' : mode === 'gank' ? 'Gank Phase' : 'Teamfight'}
      </div>
    </div>
  )
}
