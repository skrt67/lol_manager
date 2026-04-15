import { useEffect, useMemo, useState } from 'react'
import { Frown, Meh, Smile } from 'lucide-react'

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const SLOTS = [
  { id: 'morning', label: 'Matin' },
  { id: 'afternoon', label: 'Apres-midi' },
]

const ACTIVITY_OPTIONS = [
  {
    id: 'scrims',
    label: 'Scrims',
    effectLabel: '+3% Synergie equipe, +1 Teamfight, -15 Fitness',
  },
  {
    id: 'soloq',
    label: 'SoloQ',
    effectLabel: '+1 Mechanics, LP dynamique, -10 Fitness, risque tilt',
  },
  {
    id: 'vod_review',
    label: 'VOD Review',
    effectLabel: '+1 Macro, +1 Vision, -5 Fitness',
  },
  {
    id: 'theorycrafting',
    label: 'Theorycrafting',
    effectLabel: '+Maitrise champions, +Draft Bonus, -5 Fitness',
  },
  {
    id: 'rest',
    label: 'Repos / Team Building',
    effectLabel: '+20 Fitness, +Moral',
  },
]

const ACTIVITY_BY_ID = ACTIVITY_OPTIONS.reduce((acc, activity) => {
  acc[activity.id] = activity
  return acc
}, {})

function slotKey(day, slot) {
  return `${day}-${slot}`
}

function buildDefaultSchedule() {
  return DAYS.reduce((acc, day, index) => {
    acc[slotKey(day, 'morning')] = index % 2 === 0 ? 'scrims' : 'vod_review'
    acc[slotKey(day, 'afternoon')] = index < 4 ? 'soloq' : 'rest'
    return acc
  }, {})
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toFmStat(value) {
  return clamp(Math.round((value / 100) * 20), 1, 20)
}

function stableHash(text) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
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

function getMoodIcon(moral) {
  if (moral === 'Excellent' || moral === 'Bon') {
    return <Smile size={14} className="text-lime-300" />
  }
  if (moral === 'Moyen') {
    return <Meh size={14} className="text-amber-300" />
  }
  return <Frown size={14} className="text-rose-300" />
}

function getFitnessBarColor(fitness) {
  if (fitness >= 70) {
    return 'bg-lime-400'
  }
  if (fitness >= 45) {
    return 'bg-amber-400'
  }
  return 'bg-rose-400'
}

function getLadderLabel(lp) {
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

function buildTrainingRoster(roster) {
  return roster.map((player) => {
    const seed = stableHash(player.playerId ?? player.joueur)
    const fitnessFromForm = clamp(Math.round(Number(player.forme ?? 7) * 10), 20, 100)

    return {
      id: player.playerId ?? player.joueur,
      name: player.joueur,
      role: player.role,
      moral: player.moral ?? 'Moyen',
      fitness: fitnessFromForm,
      ladderLP: 680 + (seed % 360),
      stats: {
        teamfight: toFmStat(player.teamfight ?? 70),
        mechanics: toFmStat(player.mechanics ?? 70),
        macro: toFmStat(player.macro ?? 70),
        vision: toFmStat(((player.teamfight ?? 70) + (player.macro ?? 70)) / 2),
        mental: clamp(player.mental ?? toFmStat(player.macro ?? 70), 1, 20),
      },
      mastery: 52 + (seed % 34),
      traits: [],
    }
  })
}

function clonePlayer(player) {
  return {
    ...player,
    stats: { ...player.stats },
    traits: [...player.traits],
  }
}

export default function TrainingView({
  roster,
  activeLeague,
  activeTeamName,
  onApplyWeeklyResults,
  trainingPlan,
  onTrainingPlanChange,
}) {
  const [schedule, setSchedule] = useState(() => buildDefaultSchedule())
  const [weekNumber, setWeekNumber] = useState(1)
  const [synergy, setSynergy] = useState(62)
  const [draftBonus, setDraftBonus] = useState(0)
  const [weeklyReport, setWeeklyReport] = useState('Programme en attente de validation.')
  const [players, setPlayers] = useState(() => buildTrainingRoster(roster))

  useEffect(() => {
    setPlayers(buildTrainingRoster(roster))
  }, [roster])

  useEffect(() => {
    if (trainingPlan) {
      setSchedule(trainingPlan)
    }
  }, [trainingPlan])

  const selectedActivityCount = useMemo(() => {
    const counts = { scrims: 0, soloq: 0, vod_review: 0, theorycrafting: 0, rest: 0 }

    Object.values(schedule).forEach((activityId) => {
      if (counts[activityId] !== undefined) {
        counts[activityId] += 1
      }
    })

    return counts
  }, [schedule])

  const synergyRing = `conic-gradient(var(--accent) ${synergy}%, rgba(98, 109, 94, 0.35) ${synergy}% 100%)`

  const updateSchedule = (day, slot, activityId) => {
    const key = slotKey(day, slot)
    if (onTrainingPlanChange) {
      onTrainingPlanChange((previous) => ({
        ...previous,
        [key]: activityId,
      }))
      return
    }

    setSchedule((previous) => ({
      ...previous,
      [key]: activityId,
    }))
  }

  const runWeeklySimulation = () => {
    const nextPlayers = players.map(clonePlayer)

    let scrimCount = 0
    let theoryCount = 0
    let soloQCount = 0

    DAYS.forEach((day) => {
      SLOTS.forEach((slot) => {
        const currentKey = slotKey(day, slot.id)
        const activityId = schedule[currentKey]

        nextPlayers.forEach((player) => {
          if (activityId === 'scrims') {
            player.fitness = clamp(player.fitness - 15, 0, 100)
            player.stats.teamfight = clamp(player.stats.teamfight + 1, 1, 20)
            scrimCount += 1
            return
          }

          if (activityId === 'soloq') {
            const roll = (stableHash(`${player.id}-${weekNumber}-${currentKey}`) % 66) - 25
            const mechanicsBonus = player.stats.mechanics >= 17 ? 7 : player.stats.mechanics >= 15 ? 4 : 0
            const lpDelta = roll + mechanicsBonus

            player.fitness = clamp(player.fitness - 10, 0, 100)
            player.stats.mechanics = clamp(player.stats.mechanics + 1, 1, 20)
            player.ladderLP = clamp(player.ladderLP + lpDelta, 0, 1800)
            soloQCount += 1

            if (lpDelta < -10) {
              player.moral = decreaseMorale(player.moral)
            } else if (lpDelta > 20) {
              player.moral = increaseMorale(player.moral)
            }
            return
          }

          if (activityId === 'vod_review') {
            player.fitness = clamp(player.fitness - 5, 0, 100)
            player.stats.macro = clamp(player.stats.macro + 1, 1, 20)
            player.stats.vision = clamp(player.stats.vision + 1, 1, 20)
            return
          }

          if (activityId === 'theorycrafting') {
            player.fitness = clamp(player.fitness - 5, 0, 100)
            player.mastery = clamp(player.mastery + 2, 0, 100)
            theoryCount += 1
            return
          }

          if (activityId === 'rest') {
            player.fitness = clamp(player.fitness + 20, 0, 100)
            player.moral = increaseMorale(player.moral)
          }
        })
      })
    })

    nextPlayers.forEach((player) => {
      player.traits = player.traits.filter((trait) => trait !== 'Confident')
      if (player.ladderLP >= 1200) {
        player.traits.push('Confident')
        player.stats.mental = clamp(player.stats.mental + 1, 1, 20)
      }
    })

    const nextSynergy = clamp(synergy + scrimCount * 3, 0, 100)
    const nextDraftBonus = clamp(draftBonus + theoryCount * 2, 0, 30)

    setPlayers(nextPlayers)
    setSynergy(nextSynergy)
    setDraftBonus(nextDraftBonus)
    setWeekNumber((value) => value + 1)

    if (onApplyWeeklyResults) {
      onApplyWeeklyResults({
        leagueId: activeLeague.id,
        teamName: activeTeamName,
        players: nextPlayers.map((player) => ({
          playerId: player.id,
          fitness: player.fitness,
          moral: player.moral,
          ladderLP: player.ladderLP,
          hasConfidentTrait: player.traits.includes('Confident'),
          mental: player.stats.mental,
        })),
        synergy: nextSynergy,
        draftBonus: nextDraftBonus,
      })
    }

    setWeeklyReport(
      `Semaine validee: ${scrimCount} blocs Scrims, ${soloQCount} blocs SoloQ, bonus draft +${theoryCount * 2} pour le prochain match.`,
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
      <section className="fm-panel">
        <header className="mb-3 flex items-end justify-between gap-3 border-b border-[var(--border-strong)] pb-2">
          <div>
            <h2 className="font-heading text-[1.05rem] uppercase tracking-[0.07em] text-[var(--text-main)]">TrainingView</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Agenda hebdo esports - {activeLeague.name} - {activeTeamName}
            </p>
          </div>
          <span className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1 text-xs uppercase tracking-[0.08em] text-[var(--text-soft)]">
            Week {weekNumber}
          </span>
        </header>

        <div className="overflow-x-auto">
          <table className="fm-data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Jour</th>
                <th>Matin</th>
                <th>Apres-midi</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <td>{day}</td>
                  {SLOTS.map((slot) => {
                    const key = slotKey(day, slot.id)
                    return (
                      <td key={key}>
                        <select
                          value={schedule[key]}
                          onChange={(event) => updateSchedule(day, slot.id, event.target.value)}
                          className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                        >
                          {ACTIVITY_OPTIONS.map((activity) => (
                            <option key={activity.id} value={activity.id}>
                              {activity.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ACTIVITY_OPTIONS.map((activity) => (
            <article key={activity.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2 text-sm">
              <p className="font-semibold text-[var(--text-main)]">{activity.label}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{activity.effectLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">Slots: {selectedActivityCount[activity.id] ?? 0}</p>
            </article>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
          <p className="text-sm text-[var(--text-soft)]">{weeklyReport}</p>
          <button
            type="button"
            onClick={runWeeklySimulation}
            className="rounded border border-[var(--accent)] bg-[color:rgba(128,155,118,0.18)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-[var(--text-main)] hover:bg-[color:rgba(128,155,118,0.26)]"
          >
            Valider le programme de la semaine
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="fm-panel">
          <header className="mb-3 border-b border-[var(--border-strong)] pb-2">
            <h2 className="font-heading text-[1.05rem] uppercase tracking-[0.07em] text-[var(--text-main)]">Etat de l'Effectif</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Fitness, moral, ladder et traits</p>
          </header>

          <div className="space-y-2">
            {players.map((player) => (
              <article key={player.id} className="rounded border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">{player.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{player.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Ladder</p>
                    <p className="text-xs text-[var(--text-main)]">{getLadderLabel(player.ladderLP)}</p>
                  </div>
                </div>

                <div className="mb-1.5">
                  <div className="mb-0.5 flex items-center justify-between text-xs text-[var(--text-soft)]">
                    <span>Fitness</span>
                    <span>{player.fitness}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-[var(--surface-1)]">
                    <div
                      className={`h-1.5 rounded ${getFitnessBarColor(player.fitness)}`}
                      style={{ width: `${player.fitness}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-soft)]">
                  <span className="inline-flex items-center gap-1">
                    {getMoodIcon(player.moral)}
                    {player.moral}
                  </span>
                  <span>MEC {player.stats.mechanics} | MTL {player.stats.mental}</span>
                </div>

                {player.traits.includes('Confident') ? (
                  <p className="mt-1 rounded border border-[var(--accent)] bg-[color:rgba(128,155,118,0.16)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-main)]">
                    Trait actif: Confident (mental boost)
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="fm-panel">
          <header className="mb-3 border-b border-[var(--border-strong)] pb-2">
            <h2 className="font-heading text-[1.05rem] uppercase tracking-[0.07em] text-[var(--text-main)]">Synergie Totale</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Jauge circulaire equipe</p>
          </header>

          <div className="flex items-center gap-4">
            <div className="relative h-24 w-24 rounded-full p-1" style={{ background: synergyRing }}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--surface-1)]">
                <div className="text-center">
                  <p className="font-heading text-xl text-[var(--text-main)]">{synergy}%</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">SYNC</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-sm text-[var(--text-soft)]">
              <p>
                Draft bonus prochain match: <span className="font-semibold text-[var(--text-main)]">+{draftBonus}</span>
              </p>
              <p>Scrims actives: {selectedActivityCount.scrims} slots</p>
              <p>Theorycrafting: {selectedActivityCount.theorycrafting} slots</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
