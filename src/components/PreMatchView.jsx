import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Trophy, Zap, Shield, Swords, Target, Users, Brain, Heart, AlertTriangle } from 'lucide-react'
import { findRivalry } from '../utils/rivalries'

export default function PreMatchView({
  match,
  blueTeamName,
  redTeamName,
  synergy = 75,
  draftBonus = 0,
  baseWinRate = 50,
  projectedWinRate = 50,
  opponentPower = 72,
  readinessScore = {},
  approachOptions = [],
  selectedApproachId,
  onSelectApproach,
  onNext,
  onQuit,
}) {
  const [activeTab, setActiveTab] = useState('overview')

  const rivalry = findRivalry(blueTeamName, redTeamName)
  const selectedApproach = approachOptions.find(a => a.id === selectedApproachId) || approachOptions[0]

  const h2hHistory = match?.h2h || []
  const recentH2H = h2hHistory.slice(-5).reverse()
  const h2hWins = h2hHistory.filter(m => m.winner === blueTeamName).length
  const h2hLosses = h2hHistory.filter(m => m.winner === redTeamName).length

  const readinessItems = [
    { key: 'form', label: 'Forme', icon: TrendingUp, value: readinessScore.formScore ?? 75, color: 'emerald' },
    { key: 'mental', label: 'Mental', icon: Brain, value: readinessScore.mentalScore ?? 75, color: 'purple' },
    { key: 'synergy', label: 'Synergie', icon: Users, value: synergy, color: 'blue' },
    { key: 'draft', label: 'Draft Prep', icon: Target, value: Math.min(100, 50 + draftBonus * 5), color: 'amber' },
  ]

  const powerDiff = projectedWinRate - 50
  const powerDiffAbs = Math.abs(powerDiff)
  const powerDiffColor = powerDiff > 10 ? 'text-emerald-400' : powerDiff < -10 ? 'text-red-400' : 'text-gray-400'
  const PowerDiffIcon = powerDiff > 5 ? TrendingUp : powerDiff < -5 ? TrendingDown : Minus

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-br from-[#0a0a0f] via-[#0f0f18] to-[#0a0a0f] text-white overflow-hidden">
      {/* Header with team matchup */}
      <div className="relative shrink-0 border-b border-gray-800 bg-gradient-to-r from-blue-950/30 via-gray-950/50 to-red-950/30 px-8 py-6">
        <div className="absolute inset-0 bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Azir_0.jpg')] bg-cover bg-center opacity-5" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex flex-1 flex-col items-start">
            <div className="text-[10px] uppercase tracking-[0.15em] text-blue-400/80 mb-1">Blue Side</div>
            <div className="text-3xl font-black uppercase tracking-wide text-blue-400">{blueTeamName}</div>
            <div className="mt-1 text-xs text-gray-400">{match?.stage ?? 'Regular Season'} • {match?.seriesType ?? 'BO3'}</div>
          </div>

          <div className="flex flex-col items-center px-8">
            <div className="text-5xl font-black text-gray-600">VS</div>
            {rivalry && (
              <div className="mt-2 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1">
                <Zap size={12} className="text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{rivalry.label}</span>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col items-end">
            <div className="text-[10px] uppercase tracking-[0.15em] text-red-400/80 mb-1">Red Side</div>
            <div className="text-3xl font-black uppercase tracking-wide text-red-500">{redTeamName}</div>
            <div className="mt-1 text-xs text-gray-400">Power: {opponentPower}</div>
          </div>
        </div>

        {match?.stake && (
          <div className="relative z-10 mt-4 flex items-center justify-center gap-2 rounded border border-amber-600/30 bg-amber-600/10 px-4 py-2">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">{match.stake}</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="shrink-0 flex gap-1 border-b border-gray-800 bg-gray-950/50 px-6">
        {[
          { id: 'overview', label: 'Vue d\'ensemble', icon: Target },
          { id: 'h2h', label: 'Historique H2H', icon: Trophy },
          { id: 'tactics', label: 'Tactiques', icon: Swords },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                isActive
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Win Probability */}
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Probabilité de victoire</h3>
                <div className={`flex items-center gap-1 text-sm font-bold ${powerDiffColor}`}>
                  <PowerDiffIcon size={16} />
                  {powerDiffAbs > 1 ? `${powerDiffAbs.toFixed(0)}%` : ''}
                </div>
              </div>

              <div className="mb-6 flex items-center justify-between">
                <div className="text-center">
                  <div className="text-4xl font-black text-blue-400">{baseWinRate}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Base</div>
                </div>
                <div className="text-2xl text-gray-600">→</div>
                <div className="text-center">
                  <div className="text-5xl font-black text-cyan-400">{projectedWinRate}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Projeté</div>
                </div>
              </div>

              <div className="relative h-3 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${projectedWinRate}%` }}
                />
              </div>
            </div>

            {/* Team Readiness */}
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-6 backdrop-blur-sm">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-400">État de l'équipe</h3>
              <div className="grid grid-cols-2 gap-3">
                {readinessItems.map(item => {
                  const Icon = item.icon
                  const colorClass = {
                    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                  }[item.color]

                  return (
                    <div key={item.key} className={`rounded border ${colorClass} p-3`}>
                      <div className="mb-2 flex items-center justify-between">
                        <Icon size={14} />
                        <span className="text-xs font-bold">{item.value}</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider opacity-80">{item.label}</div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full bg-current transition-all duration-300"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rivalry Info */}
            {rivalry && (
              <div className="lg:col-span-2 rounded-lg border border-amber-600/40 bg-gradient-to-r from-amber-950/40 to-orange-950/40 p-6 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-amber-500/20 p-3">
                    <Zap size={24} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-black uppercase tracking-wide text-amber-400">{rivalry.label}</h3>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        rivalry.tier === 'legendary' ? 'bg-purple-500/20 text-purple-300' :
                        rivalry.tier === 'historic' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {rivalry.tier}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{rivalry.description}</p>
                    {rivalry.stakes && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rivalry.stakes.map((stake, i) => (
                          <span key={i} className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                            {stake}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'h2h' && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-blue-800/40 bg-blue-950/30 p-4 text-center">
                <div className="text-3xl font-black text-blue-400">{h2hWins}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">Victoires</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4 text-center">
                <div className="text-3xl font-black text-gray-400">{h2hHistory.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">Matchs</div>
              </div>
              <div className="rounded-lg border border-red-800/40 bg-red-950/30 p-4 text-center">
                <div className="text-3xl font-black text-red-400">{h2hLosses}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400">Défaites</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">5 derniers matchs</h3>
              {recentH2H.length > 0 ? (
                recentH2H.map((game, idx) => {
                  const isWin = game.winner === blueTeamName
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        isWin
                          ? 'border-blue-700/40 bg-blue-950/20'
                          : 'border-red-700/40 bg-red-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded px-2 py-1 text-xs font-black ${
                          isWin ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {isWin ? 'W' : 'L'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{game.score || '2-1'}</div>
                          <div className="text-xs text-gray-400">{game.date || 'Split précédent'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{game.stage || 'Regular Season'}</div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-8 text-center">
                  <AlertTriangle size={32} className="mx-auto mb-2 text-gray-600" />
                  <p className="text-sm text-gray-500">Aucun historique disponible</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tactics' && (
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 rounded-lg border border-cyan-700/40 bg-cyan-950/20 p-4">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-cyan-300">Plan de jeu sélectionné</h3>
                  <p className="text-xs text-gray-400">Choisissez votre approche tactique pour ce match</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {approachOptions.map(approach => {
                const isSelected = selectedApproach?.id === approach.id
                return (
                  <button
                    key={approach.id}
                    onClick={() => onSelectApproach(approach.id)}
                    className={`group relative overflow-hidden rounded-lg border p-6 text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                        : 'border-gray-800 bg-gray-950/60 hover:border-gray-600'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-cyan-400" />
                    )}
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-base font-black uppercase tracking-wide text-white group-hover:text-cyan-300">
                        {approach.label}
                      </h4>
                      {isSelected && (
                        <div className="rounded-full bg-cyan-400 p-1">
                          <Target size={12} className="text-black" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-400">{approach.summary}</p>
                    {approach.effects && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {approach.effects.map((effect, i) => (
                          <span
                            key={i}
                            className="rounded bg-gray-800/50 px-2 py-1 text-[10px] text-gray-300"
                          >
                            {effect}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 flex items-center justify-between border-t border-gray-800 bg-gray-950/80 px-8 py-4">
        <button
          onClick={onQuit}
          className="rounded border border-gray-700 bg-gray-900/50 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
        >
          Quitter
        </button>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Synergie: {synergy}% • Draft: +{draftBonus}</div>
            <div className="text-xs font-bold text-cyan-400">Win Rate projeté: {projectedWinRate}%</div>
          </div>
          <button
            onClick={onNext}
            disabled={!selectedApproach}
            className={`flex items-center gap-2 rounded px-8 py-3 text-sm font-black uppercase tracking-wider shadow-lg transition-all ${
              selectedApproach
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-500/50 hover:shadow-cyan-500/70'
                : 'cursor-not-allowed bg-gray-800 text-gray-600'
            }`}
          >
            <Swords size={16} />
            Entrer dans la draft
          </button>
        </div>
      </div>
    </div>
  )
}
