import { motion } from 'framer-motion'

const MotionDiv = motion.div
const MotionSpan = motion.span

/**
 * TacticalMinimap
 * ───────────────
 * Minimap tactique stylisée de la Faille de l'Invocateur, générique et
 * découplée de la simulation : tu lui passes un tableau de joueurs avec
 * leurs coordonnées (x, y) normalisées dans [0, 100], et elle les dessine
 * avec animation fluide lors des transitions.
 *
 * Architecture :
 *   – <svg> pour le fond (map image + lanes + tours + pits objectifs)
 *   – Un <motion.div> par joueur pour :
 *       • animer left/top en pourcentage via framer-motion (spring)
 *       • bénéficier des events DOM (hover, click) gratuitement
 *       • afficher une image / icône / label sans clipping SVG
 *
 * Pourquoi SVG + motion.div plutôt que Canvas ?
 *   – 10 éléments : coût de diff React négligeable.
 *   – Animations déclaratives, pas de requestAnimationFrame à gérer.
 *   – Interactivité DOM native (click, hover, tooltip).
 *   – Debuggable via l'inspecteur.
 *   Canvas ne devient gagnant qu'à partir de ~500 éléments ou pour des effets
 *   pixel per-frame (particles, shaders, blur composite).
 *
 * ── Props ────────────────────────────────────────────────────────────────
 *
 * @param {Array<{
 *   id: string,
 *   x: number,               // ∈ [0, 100], % de largeur
 *   y: number,               // ∈ [0, 100], % de hauteur
 *   team?: 'blue' | 'red' | 'neutral',
 *   label?: string,          // texte court affiché dans le cercle (ex: 'Mid')
 *   color?: string,          // override la couleur de l'équipe
 *   imageUrl?: string,       // optionnel, remplit le cercle
 *   dead?: boolean,          // si true, cercle grisé et non animé
 *   highlight?: boolean,     // flash ring animé (ex: kill, gank)
 * }>} players
 *
 * @param {object} [options]
 * @param {string}  [options.mapImageUrl]   - URL du fond de map (défaut: DDragon SR)
 * @param {boolean} [options.showLanes]     - dessine les guides de lanes (défaut: true)
 * @param {boolean} [options.showObjectives]- dessine Dragon/Baron pits (défaut: true)
 * @param {number}  [options.unitSize]      - taille des cercles en px (défaut: 36)
 * @param {object}  [options.spring]        - config framer-motion (défaut: spring 120/16)
 * @param {function}[options.onPlayerClick] - (player) => void
 * @param {string}  [options.className]     - classes additionnelles sur le container
 */

const DDRAGON_MAP = 'https://ddragon.leagueoflegends.com/cdn/16.7.1/img/map/map11.png'

const TEAM_COLORS = {
  blue:    { fill: '#1e3a8a', border: '#60a5fa', glow: 'rgba(59,130,246,0.55)' },
  red:     { fill: '#7f1d1d', border: '#f87171', glow: 'rgba(239,68,68,0.55)' },
  neutral: { fill: '#78350f', border: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },
}

const DEFAULT_SPRING = { type: 'spring', stiffness: 120, damping: 16, mass: 0.9 }

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

export default function TacticalMinimap({
  players = [],
  mapImageUrl = DDRAGON_MAP,
  showLanes = true,
  showObjectives = true,
  unitSize = 36,
  spring = DEFAULT_SPRING,
  onPlayerClick,
  className = '',
}) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-sm border border-[rgba(203,213,225,0.2)] bg-[#08111c] ${className}`}
    >
      {/* ── Background map image ─────────────────────────────────────── */}
      {mapImageUrl ? (
        <img
          src={mapImageUrl}
          alt="Summoner's Rift"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          draggable={false}
        />
      ) : null}

      {/* Dark vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/30" />

      {/* ── Static overlays in SVG ───────────────────────────────────── */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {showLanes ? (
          <g stroke="rgba(226,232,240,0.12)" fill="none" strokeWidth="1.5">
            {/* Top lane */}
            <path d="M13 66 L15 48 L18 30 L34 14 L48 14 L66 14" />
            {/* Mid lane */}
            <path d="M23 76 L30 68 L38 58 L50 50 L62 42 L70 32 L77 24" strokeWidth="2" />
            {/* Bot lane */}
            <path d="M34 86 L50 86 L66 86 L86 66 L86 50 L86 34" />
          </g>
        ) : null}

        {/* Bases */}
        <rect x="3"  y="82" width="14" height="14" rx="2" fill="rgba(37,99,235,0.25)"  stroke="rgba(96,165,250,0.8)"  strokeWidth="1.2" />
        <rect x="83" y="4"  width="14" height="14" rx="2" fill="rgba(185,28,28,0.25)"  stroke="rgba(248,113,113,0.8)" strokeWidth="1.2" />

        {showObjectives ? (
          <>
            {/* Dragon pit */}
            <circle cx="65" cy="64" r="3.5" fill="rgba(20,184,166,0.08)" stroke="rgba(45,212,191,0.35)" strokeWidth="0.5" />
            <text x="65" y="64.8" textAnchor="middle" dominantBaseline="middle" fontSize="2.2" fill="rgba(45,212,191,0.85)" fontWeight="bold">DRG</text>

            {/* Baron pit */}
            <circle cx="36" cy="36" r="3.5" fill="rgba(168,85,247,0.08)" stroke="rgba(192,132,252,0.35)" strokeWidth="0.5" />
            <text x="36" y="36.8" textAnchor="middle" dominantBaseline="middle" fontSize="2.2" fill="rgba(192,132,252,0.85)" fontWeight="bold">BSN</text>
          </>
        ) : null}
      </svg>

      {/* ── Player units ─────────────────────────────────────────────── */}
      {players.map((p) => {
        const team = TEAM_COLORS[p.team ?? 'neutral'] ?? TEAM_COLORS.neutral
        const fill = p.color ?? team.fill
        const border = p.color ?? team.border
        const glow = team.glow
        const isDead = Boolean(p.dead)

        const x = clamp(p.x, 0, 100)
        const y = clamp(p.y, 0, 100)

        return (
          <MotionDiv
            key={p.id}
            role={onPlayerClick ? 'button' : undefined}
            onClick={onPlayerClick ? () => onPlayerClick(p) : undefined}
            className={`absolute z-20 flex items-center justify-center overflow-hidden rounded-full border-2 text-[9px] font-bold uppercase text-white ${
              isDead ? 'grayscale opacity-40' : ''
            } ${onPlayerClick ? 'cursor-pointer' : ''}`}
            style={{
              width: unitSize,
              height: unitSize,
              backgroundColor: fill,
              borderColor: border,
              boxShadow: isDead ? 'none' : `0 0 10px ${glow}, 0 0 20px ${glow}`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{ left: `${x}%`, top: `${y}%` }}
            transition={{ left: spring, top: spring }}
          >
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.label ?? p.id}
                className="h-full w-full scale-110 rounded-full object-cover"
                draggable={false}
              />
            ) : (
              <span>{p.label ?? p.id.slice(0, 2)}</span>
            )}

            {/* Highlight flash ring (ex: kill, gank, ping) */}
            {p.highlight && !isDead ? (
              <MotionSpan
                key={`flash-${p.id}-${p.highlight}`}
                className="pointer-events-none absolute inset-0 rounded-full border-4"
                style={{ borderColor: border }}
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 2.8 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            ) : null}
          </MotionDiv>
        )
      })}
    </div>
  )
}
