/**
 * LiveMatchView
 * ─────────────
 * Vue LIVE d'un match LoL simulé. Rend la Faille de l'Invocateur avec
 * 10 unités animées, scoreboard temps réel, feed d'events, et contrôles
 * de vitesse x1 / x2 / x3 + pause.
 *
 * Mapping temps : 10 min réel à x1 pour un match max de ~35 min de jeu.
 *   → 35*60 / 600 = 3.5 game-seconds par seconde réelle à x1.
 *   → Tick à 200ms réel → advance 0.7 / 1.4 / 2.1 game-sec selon speed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, FastForward, ChevronsRight, SkipForward } from 'lucide-react'
import {
  advanceMatch,
  createMatch,
  formatGameTime,
  isFinished,
  ROLES,
} from '../engine/matchEngine'

const MotionDiv = motion.div

// ─── Config ──────────────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = 200
// Game seconds advanced per real second at x1 (to hit ~10 min real for full game)
const BASE_GAME_SEC_PER_REAL_SEC = 3.5

const SPEED_OPTIONS = [
  { value: 1, label: 'x1',  icon: Play },
  { value: 2, label: 'x2',  icon: FastForward },
  { value: 3, label: 'x3',  icon: ChevronsRight },
]

const CDN = '16.7.1'
const MAP_IMG = `https://ddragon.leagueoflegends.com/cdn/${CDN}/img/map/map11.png`
const DDR_OVERRIDES = {
  BelVeth: 'Belveth', ChoGath: 'Chogath', JarvanIV: 'JarvanIV',
  Khazix: 'Khazix', KogMaw: 'KogMaw', LeBlanc: 'Leblanc',
  NunuWillump: 'Nunu', RenataGlasc: 'Renata', TahmKench: 'TahmKench',
  VelKoz: 'Velkoz', Wukong: 'MonkeyKing',
}
function championPortrait(championId) {
  if (!championId) return null
  const id = DDR_OVERRIDES[championId] ?? championId
  return `https://ddragon.leagueoflegends.com/cdn/${CDN}/img/champion/${id}.png`
}

// ─── Map overlays: towers, inhibitors, pits ──────────────────────────────────

const BLUE_STRUCTURES = [
  // Outer towers
  { id: 'b-top-t1',  type: 'tower',      tier: 1, x: 13, y: 48 },
  { id: 'b-mid-t1',  type: 'tower',      tier: 1, x: 38, y: 58 },
  { id: 'b-bot-t1',  type: 'tower',      tier: 1, x: 66, y: 86 },
  // Inner towers
  { id: 'b-top-t2',  type: 'tower',      tier: 2, x: 15, y: 64 },
  { id: 'b-mid-t2',  type: 'tower',      tier: 2, x: 30, y: 68 },
  { id: 'b-bot-t2',  type: 'tower',      tier: 2, x: 50, y: 86 },
  // Inhibitor towers
  { id: 'b-top-t3',  type: 'tower',      tier: 3, x: 13, y: 78 },
  { id: 'b-mid-t3',  type: 'tower',      tier: 3, x: 22, y: 78 },
  { id: 'b-bot-t3',  type: 'tower',      tier: 3, x: 34, y: 86 },
  // Inhibitors
  { id: 'b-top-inh', type: 'inhibitor',  x: 13,  y: 82 },
  { id: 'b-mid-inh', type: 'inhibitor',  x: 18,  y: 82 },
  { id: 'b-bot-inh', type: 'inhibitor',  x: 24,  y: 86 },
  // Nexus towers
  { id: 'b-nex-t1',  type: 'tower',      tier: 4, x: 10,  y: 87 },
  { id: 'b-nex-t2',  type: 'tower',      tier: 4, x: 14,  y: 91 },
  // Nexus
  { id: 'b-nexus',   type: 'nexus',      x: 11,  y: 89 },
]

const RED_STRUCTURES = [
  { id: 'r-top-t1',  type: 'tower',      tier: 1, x: 34, y: 14 },
  { id: 'r-mid-t1',  type: 'tower',      tier: 1, x: 62, y: 42 },
  { id: 'r-bot-t1',  type: 'tower',      tier: 1, x: 87, y: 52 },
  { id: 'r-top-t2',  type: 'tower',      tier: 2, x: 50, y: 14 },
  { id: 'r-mid-t2',  type: 'tower',      tier: 2, x: 70, y: 32 },
  { id: 'r-bot-t2',  type: 'tower',      tier: 2, x: 87, y: 36 },
  { id: 'r-top-t3',  type: 'tower',      tier: 3, x: 66, y: 14 },
  { id: 'r-mid-t3',  type: 'tower',      tier: 3, x: 78, y: 22 },
  { id: 'r-bot-t3',  type: 'tower',      tier: 3, x: 87, y: 22 },
  { id: 'r-top-inh', type: 'inhibitor',  x: 76,  y: 18 },
  { id: 'r-mid-inh', type: 'inhibitor',  x: 82,  y: 18 },
  { id: 'r-bot-inh', type: 'inhibitor',  x: 87,  y: 18 },
  { id: 'r-nex-t1',  type: 'tower',      tier: 4, x: 90, y: 13 },
  { id: 'r-nex-t2',  type: 'tower',      tier: 4, x: 86, y: 9 },
  { id: 'r-nexus',   type: 'nexus',      x: 89,  y: 11 },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function StructureMark({ struct, destroyed, side }) {
  const color = side === 'blue' ? '#3b82f6' : '#ef4444'
  const border = side === 'blue' ? '#93c5fd' : '#fca5a5'
  const deadFill = '#475569'

  if (struct.type === 'nexus') {
    const size = 3.2
    return (
      <g>
        <circle
          cx={struct.x} cy={struct.y} r={size}
          fill={destroyed ? deadFill : color}
          stroke={destroyed ? '#64748b' : border}
          strokeWidth="0.6"
          opacity={destroyed ? 0.35 : 1}
        />
        {!destroyed && (
          <circle cx={struct.x} cy={struct.y} r={size + 1.2} fill="none" stroke={border} strokeWidth="0.3" opacity="0.5">
            <animate attributeName="r" from={size + 1} to={size + 2.2} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    )
  }

  if (struct.type === 'inhibitor') {
    const s = 1.6
    return (
      <rect
        x={struct.x - s} y={struct.y - s} width={s * 2} height={s * 2}
        fill={destroyed ? deadFill : color} stroke={destroyed ? '#64748b' : border} strokeWidth="0.4"
        opacity={destroyed ? 0.3 : 0.85} rx="0.3"
      />
    )
  }

  // Tower: diamond
  const s = struct.tier === 4 ? 2.2 : struct.tier === 1 ? 1.9 : 1.7
  return (
    <polygon
      points={`${struct.x},${struct.y - s} ${struct.x + s},${struct.y} ${struct.x},${struct.y + s} ${struct.x - s},${struct.y}`}
      fill={destroyed ? deadFill : color}
      stroke={destroyed ? '#64748b' : border}
      strokeWidth="0.5"
      opacity={destroyed ? 0.3 : 0.9}
    />
  )
}

function SummonersRiftMap({ state, blueTeamName, redTeamName }) {
  const units = state?.units ?? {}
  const blueLostStructures = state?.score?.red?.towers ?? 0
  const redLostStructures = state?.score?.blue?.towers ?? 0
  const blueLostInhib = state?.score?.red?.inhibitors ?? 0
  const redLostInhib = state?.score?.blue?.inhibitors ?? 0

  const blueStructures = [...BLUE_STRUCTURES]
  const redStructures = [...RED_STRUCTURES]

  // Mark structures as destroyed in order (outer first)
  const markDestroyed = (list, towersLost, inhibLost, nexusHp) => {
    const towers = list.filter((s) => s.type === 'tower')
    const inhibs = list.filter((s) => s.type === 'inhibitor')
    const destroyed = new Set()
    for (let i = 0; i < towersLost && i < towers.length; i++) destroyed.add(towers[i].id)
    for (let i = 0; i < inhibLost && i < inhibs.length; i++) destroyed.add(inhibs[i].id)
    if (nexusHp <= 0) {
      for (const s of list) destroyed.add(s.id)
    }
    return destroyed
  }

  const blueDestroyed = markDestroyed(blueStructures, blueLostStructures, blueLostInhib, state?.score?.blue?.nexusHp ?? 100)
  const redDestroyed = markDestroyed(redStructures, redLostStructures, redLostInhib, state?.score?.red?.nexusHp ?? 100)

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded border border-slate-800 bg-[#050a10]">
      <img src={MAP_IMG} alt="Summoner's Rift" className="absolute inset-0 h-full w-full object-cover opacity-85" draggable={false} />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/25" />

      {/* SVG layer: lanes + structures + objectives */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {/* Lane traces (subtle) */}
        <g stroke="rgba(226,232,240,0.1)" fill="none" strokeWidth="1.4" strokeLinecap="round">
          <path d="M14,80 L14,48 L34,14 L66,14" />
          <path d="M22,78 L50,50 L78,22" strokeWidth="1.8" />
          <path d="M34,86 L86,86 L86,34" />
        </g>

        {/* River zone (faint) */}
        <path d="M35,65 Q50,50 65,35" stroke="rgba(56,189,248,0.12)" strokeWidth="4" fill="none" />

        {/* Dragon pit */}
        <circle cx="70" cy="72" r="3.8" fill="rgba(20,184,166,0.12)" stroke="rgba(45,212,191,0.4)" strokeWidth="0.5" />
        <text x="70" y="72.8" textAnchor="middle" dominantBaseline="middle" fontSize="2.1" fill="rgba(45,212,191,0.95)" fontWeight="bold">DRG</text>

        {/* Baron pit */}
        <circle cx="30" cy="28" r="3.8" fill="rgba(168,85,247,0.12)" stroke="rgba(192,132,252,0.4)" strokeWidth="0.5" />
        <text x="30" y="28.8" textAnchor="middle" dominantBaseline="middle" fontSize="2.1" fill="rgba(192,132,252,0.95)" fontWeight="bold">BSN</text>

        {/* Bases */}
        <rect x="4"  y="83" width="12" height="12" rx="2" fill="rgba(37,99,235,0.22)"  stroke="rgba(96,165,250,0.7)"  strokeWidth="1" />
        <rect x="84" y="5"  width="12" height="12" rx="2" fill="rgba(185,28,28,0.22)"  stroke="rgba(248,113,113,0.7)" strokeWidth="1" />

        {/* Blue structures */}
        {blueStructures.map((s) => (
          <StructureMark key={s.id} struct={s} destroyed={blueDestroyed.has(s.id)} side="blue" />
        ))}
        {/* Red structures */}
        {redStructures.map((s) => (
          <StructureMark key={s.id} struct={s} destroyed={redDestroyed.has(s.id)} side="red" />
        ))}
      </svg>

      {/* Team labels */}
      <div className="pointer-events-none absolute left-2 bottom-2 rounded border border-blue-700/50 bg-blue-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-200 backdrop-blur-sm">
        {blueTeamName}
      </div>
      <div className="pointer-events-none absolute right-2 top-2 rounded border border-red-700/50 bg-red-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-red-200 backdrop-blur-sm">
        {redTeamName}
      </div>

      {/* Units */}
      {Object.values(units).map((unit) => {
        if (!unit.alive) return null
        const isBlue = unit.side === 'blue'
        const portrait = championPortrait(unit.championId)
        const ring = isBlue
          ? 'border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.85)]'
          : 'border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.85)]'
        const bg = isBlue ? 'bg-blue-950' : 'bg-red-950'
        return (
          <MotionDiv
            key={unit.id}
            className={`absolute z-20 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 text-[9px] font-bold uppercase text-white ${ring} ${bg}`}
            animate={{ left: `${unit.x}%`, top: `${unit.y}%` }}
            transition={{ type: 'tween', duration: 0.4, ease: 'linear' }}
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {portrait ? (
              <img src={portrait} alt={unit.championId ?? unit.role} className="h-full w-full scale-110 rounded-full object-cover" draggable={false} />
            ) : (
              <span>{unit.role.slice(0, 1).toUpperCase()}</span>
            )}
          </MotionDiv>
        )
      })}

      {/* Respawning units (ghost dots at base) */}
      {Object.values(units).filter((u) => !u.alive).map((unit) => {
        const isBlue = unit.side === 'blue'
        const x = isBlue ? 10 : 90
        const y = isBlue ? 90 : 10
        return (
          <div
            key={`ghost-${unit.id}`}
            className={`pointer-events-none absolute z-10 h-2 w-2 rounded-full opacity-60 ${isBlue ? 'bg-blue-400' : 'bg-red-400'}`}
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
          />
        )
      })}
    </div>
  )
}

// ─── Scoreboard + sidebars ──────────────────────────────────────────────────

function ScoreChip({ icon, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base leading-none">{icon}</span>
      <span className={`font-mono text-sm font-bold ${color}`}>{value}</span>
    </div>
  )
}

function ScoreBar({ blueScore, redScore }) {
  const totalGold = (blueScore?.gold ?? 0) + (redScore?.gold ?? 0)
  const blueRatio = totalGold > 0 ? (blueScore.gold / totalGold) * 100 : 50
  const diff = (blueScore?.gold ?? 0) - (redScore?.gold ?? 0)
  const diffK = (Math.abs(diff) / 1000).toFixed(1)

  return (
    <div className="flex flex-col gap-2 rounded border border-slate-800 bg-[#0a1420] p-3">
      {/* Kills + objectives row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Blue */}
        <div className="flex items-center justify-end gap-3">
          <ScoreChip icon="⚔️" value={blueScore?.kills ?? 0}   color="text-blue-300" />
          <ScoreChip icon="🗼" value={blueScore?.towers ?? 0}  color="text-blue-300" />
          <ScoreChip icon="🐉" value={blueScore?.dragons ?? 0} color="text-blue-300" />
          <ScoreChip icon="🐲" value={blueScore?.barons ?? 0}  color="text-blue-300" />
          <ScoreChip icon="👁" value={blueScore?.heralds ?? 0} color="text-blue-300" />
        </div>
        <div className="font-heading text-xs uppercase tracking-[0.14em] text-slate-500">vs</div>
        {/* Red */}
        <div className="flex items-center gap-3">
          <ScoreChip icon="⚔️" value={redScore?.kills ?? 0}    color="text-red-300" />
          <ScoreChip icon="🗼" value={redScore?.towers ?? 0}   color="text-red-300" />
          <ScoreChip icon="🐉" value={redScore?.dragons ?? 0}  color="text-red-300" />
          <ScoreChip icon="🐲" value={redScore?.barons ?? 0}   color="text-red-300" />
          <ScoreChip icon="👁" value={redScore?.heralds ?? 0}  color="text-red-300" />
        </div>
      </div>

      {/* Gold diff bar */}
      <div className="flex items-center gap-2">
        <span className="min-w-[3.5rem] text-right font-mono text-[11px] font-bold text-blue-300">
          {Math.round((blueScore?.gold ?? 0) / 100) / 10}k
        </span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div className="absolute inset-y-0 left-0 bg-blue-500" style={{ width: `${blueRatio}%` }} />
          <div className="absolute inset-y-0 right-0 bg-red-500" style={{ width: `${100 - blueRatio}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
        </div>
        <span className="min-w-[3.5rem] font-mono text-[11px] font-bold text-red-300">
          {Math.round((redScore?.gold ?? 0) / 100) / 10}k
        </span>
      </div>
      {diff !== 0 && (
        <div className="text-center text-[10px] uppercase tracking-[0.1em] text-slate-500">
          {diff > 0 ? 'Avantage bleu' : 'Avantage rouge'} · +{diffK}k gold
        </div>
      )}
    </div>
  )
}

function TeamSidebar({ side, state, teamName }) {
  const units = ROLES.map((r) => state?.units?.[`${side}-${r}`]).filter(Boolean)
  const isBlue = side === 'blue'
  const accent = isBlue ? 'border-blue-700/50 text-blue-200' : 'border-red-700/50 text-red-200'
  const glow = isBlue ? 'shadow-blue-500/10' : 'shadow-red-500/10'

  return (
    <div className={`flex flex-col gap-2 rounded border bg-[#0a1420] p-2 shadow-lg ${accent} ${glow}`}>
      <header className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <p className="font-heading text-[11px] uppercase tracking-[0.12em]">{teamName}</p>
        <span className="text-[9px] text-slate-500">{isBlue ? 'BLUE SIDE' : 'RED SIDE'}</span>
      </header>

      {units.map((u) => {
        const portrait = championPortrait(u.championId)
        const kdaStr = `${u.kda.k}/${u.kda.d}/${u.kda.a}`
        const gold = Math.round(u.gold)
        const cs = Math.floor(u.cs)
        return (
          <div key={u.id} className={`flex items-center gap-2 rounded border border-slate-800 bg-slate-950/60 p-1.5 ${!u.alive ? 'opacity-40 grayscale' : ''}`}>
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-900">
              {portrait ? (
                <img src={portrait} alt={u.championId ?? u.role} className="h-full w-full object-cover" draggable={false} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-500">
                  {u.role.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute bottom-0 right-0 rounded-tl bg-slate-950/90 px-1 text-[8px] font-bold text-amber-300">
                {u.level}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-[11px] uppercase tracking-wide text-slate-200">{u.pseudo}</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="font-mono">{kdaStr}</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono">{cs} cs</span>
              </div>
              <div className="font-mono text-[10px] text-amber-300">{gold.toLocaleString('fr-FR')}g</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EventsFeed({ events = [] }) {
  const recent = [...events].slice(-40).reverse()
  return (
    <div className="flex h-full flex-col overflow-hidden rounded border border-slate-800 bg-[#0a1420]">
      <header className="border-b border-slate-800 px-3 py-1.5">
        <p className="font-heading text-[10px] uppercase tracking-[0.14em] text-slate-400">Journal du match</p>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {recent.length === 0 ? (
          <p className="text-center text-[11px] text-slate-600">Le match va commencer...</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((evt) => {
              const sideColor = evt.side === 'blue' ? 'border-l-blue-500' : evt.side === 'red' ? 'border-l-red-500' : 'border-l-slate-600'
              return (
                <li key={evt.id} className={`rounded border-l-[3px] bg-slate-950/60 px-2 py-1 ${sideColor}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">{formatGameTime(evt.timeSec)}</span>
                    <span className="text-sm">{evt.icon}</span>
                    <span className="flex-1 text-[11px] text-slate-200">{evt.description}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function SpeedControls({ speed, onSpeedChange, paused, onTogglePause, onSkipToEnd }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-950/80 p-1">
      <button
        type="button"
        onClick={onTogglePause}
        className={`flex h-8 w-8 items-center justify-center rounded transition ${paused ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        title={paused ? 'Reprendre' : 'Pause'}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      {SPEED_OPTIONS.map((opt) => {
        const active = speed === opt.value && !paused
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSpeedChange(opt.value)}
            className={`flex h-8 min-w-[2.5rem] items-center justify-center gap-1 rounded px-2 text-xs font-bold transition ${active ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            title={`Vitesse ${opt.label}`}
          >
            <Icon size={12} />
            <span>{opt.label}</span>
          </button>
        )
      })}
      <div className="mx-1 h-6 w-px bg-slate-800" />
      <button
        type="button"
        onClick={onSkipToEnd}
        className="flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
        title="Simuler jusqu'à la fin instantanément"
      >
        <SkipForward size={12} />
        <span>Fin</span>
      </button>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function LiveMatchView({
  blueRoster = [],
  redRoster = [],
  blueTeamName = 'Mon équipe',
  redTeamName = 'Adversaire',
  draft = null,
  seed,
  powerBias = 0,
  onFinish,
  onQuit,
}) {
  // Moteur vit dans un ref (pour ne pas déclencher de re-render à chaque tick)
  const stateRef = useRef(null)
  const [, forceRender] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const finishedNotifiedRef = useRef(false)

  // Init le moteur au montage
  useMemo(() => {
    stateRef.current = createMatch({ blueRoster, redRoster, seed, draft, powerBias })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Boucle de simulation
  useEffect(() => {
    if (paused) return undefined
    const interval = setInterval(() => {
      const state = stateRef.current
      if (!state || isFinished(state)) return
      const dtReal = TICK_INTERVAL_MS / 1000
      const dtGame = dtReal * BASE_GAME_SEC_PER_REAL_SEC * speed
      advanceMatch(state, dtGame)
      forceRender((n) => (n + 1) % 1_000_000)
    }, TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [speed, paused])

  // Notification de fin (une seule fois)
  useEffect(() => {
    const state = stateRef.current
    if (!state) return
    if (isFinished(state) && !finishedNotifiedRef.current) {
      finishedNotifiedRef.current = true
      onFinish?.(state)
    }
  })

  const handleSkipToEnd = () => {
    const state = stateRef.current
    if (!state || isFinished(state)) return
    // Avance par blocs de 60s jusqu'à fin (max 45 min game)
    for (let i = 0; i < 45 * 60 && !isFinished(state); i++) {
      advanceMatch(state, 5)
    }
    forceRender((n) => (n + 1) % 1_000_000)
  }

  const state = stateRef.current
  if (!state) return null

  const finished = isFinished(state)
  const winner = state.winner
  const blueVictory = winner === 'blue'

  return (
    <div className="flex h-full w-full flex-col gap-2 bg-[#050a10] p-2 text-slate-100">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-[#0a1420] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <p className="font-heading text-base uppercase tracking-[0.05em] text-blue-200">{blueTeamName}</p>
          </div>
          <span className="text-slate-700">vs</span>
          <div className="flex items-center gap-2">
            <p className="font-heading text-base uppercase tracking-[0.05em] text-red-200">{redTeamName}</p>
            <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded border border-slate-700 bg-slate-950 px-3 py-1">
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Temps de jeu</p>
            <p className="font-mono text-xl font-bold text-amber-300">{formatGameTime(state.gameTimeSec)}</p>
          </div>
          <div className="rounded border border-slate-700 bg-slate-950 px-3 py-1">
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Phase</p>
            <p className="font-heading text-sm uppercase tracking-wide text-slate-200">{phaseLabel(state.phase)}</p>
          </div>
          <SpeedControls
            speed={speed}
            onSpeedChange={(v) => { setSpeed(v); setPaused(false) }}
            paused={paused}
            onTogglePause={() => setPaused((p) => !p)}
            onSkipToEnd={handleSkipToEnd}
          />
          {onQuit ? (
            <button
              type="button"
              onClick={onQuit}
              className="rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-slate-400 hover:border-slate-600 hover:text-slate-200"
            >
              Quitter
            </button>
          ) : null}
        </div>
      </header>

      {/* ── MAIN GRID (3 cols) ──────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,280px)_1fr_minmax(220px,280px)] gap-2">
        {/* Blue sidebar */}
        <TeamSidebar side="blue" state={state} teamName={blueTeamName} />

        {/* Center: scoreboard + map + events */}
        <div className="flex min-h-0 flex-col gap-2">
          <ScoreBar blueScore={state.score.blue} redScore={state.score.red} />
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="flex-1">
              <SummonersRiftMap state={state} blueTeamName={blueTeamName} redTeamName={redTeamName} />
            </div>
            <div className="w-[260px] flex-shrink-0">
              <EventsFeed events={state.events} />
            </div>
          </div>
        </div>

        {/* Red sidebar */}
        <TeamSidebar side="red" state={state} teamName={redTeamName} />
      </div>

      {/* ── END OVERLAY ────────────────────────────────────────────── */}
      {finished ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-[#0a1420] p-6 shadow-2xl">
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-slate-500">Résultat</p>
            <h2 className={`mt-2 text-center font-heading text-5xl font-black uppercase tracking-[0.05em] ${blueVictory ? 'text-blue-300' : 'text-red-300'}`}>
              {blueVictory ? 'Victoire' : 'Défaite'}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{blueTeamName}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-blue-300">{state.score.blue.kills}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {state.score.blue.towers} tours · {state.score.blue.dragons} drakes · {state.score.blue.barons} barons
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{redTeamName}</p>
                <p className="mt-1 font-mono text-2xl font-bold text-red-300">{state.score.red.kills}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {state.score.red.towers} tours · {state.score.red.dragons} drakes · {state.score.red.barons} barons
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {onFinish ? (
                <button
                  type="button"
                  onClick={() => onFinish?.(state)}
                  className="rounded border border-amber-500 bg-amber-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-amber-200 hover:bg-amber-500/30"
                >
                  Voir le rapport
                </button>
              ) : null}
              {onQuit ? (
                <button
                  type="button"
                  onClick={onQuit}
                  className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-xs uppercase tracking-[0.1em] text-slate-300 hover:border-slate-600"
                >
                  Retour
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function phaseLabel(phase) {
  if (phase === 'laning') return 'Laning'
  if (phase === 'skirmish') return 'Rotations'
  if (phase === 'mid') return 'Mid-game'
  return 'Late-game'
}
