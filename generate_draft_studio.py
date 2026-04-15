import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# Replace the inner steps with Draft Studio if step is 2 or 3
# Find where step === 2 inside MatchDayPage
start_idx = content.find('{step === 2 ? (')
end_idx = content.find('          {step === 4 ? (')

replacement = """          {(step === 2 || step === 3) ? (
            <div className="absolute inset-0 z-50 flex h-full w-full flex-col bg-[#050505] text-white">
              {/* Top Banner */}
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-800 bg-[#0a0a0c] px-6 shadow-md">
                <div className="flex flex-1 items-center gap-6">
                  <div className="text-2xl font-bold uppercase tracking-wider text-blue-400">{match.player_team}</div>
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const banKey = selectedBans[i]
                      const champ = Object.values(engineChampions).find(c => c.key === banKey)
                      const img = champ ? \`https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/\${champ.id}.png\` : null
                      return (
                        <div key={'bb'+i} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-gray-700 bg-gray-900 border-b-2 border-b-red-600">
                          {img ? (
                            <div className="relative h-full w-full">
                              <img src={img} className="h-full w-full object-cover grayscale brightness-50" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-[2px] w-full rotate-45 bg-[#c8aa6e]"></div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center -mt-2">
                  <div className="text-xl font-bold tracking-[0.1em] text-white">PHASE DE DRAFT</div>
                  <div className="text-[12px] uppercase tracking-widest text-[#c8aa6e] bg-[#1e1e1e] border border-[#c8aa6e]/30 px-4 py-1 rounded-full mt-1">
                    {step === 2 ? 'PHASE DE BANS' : 'PHASE DE PICKS'}
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-end gap-6">
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const banKey = match.draftState?.bans?.enemy?.[i]
                      const champ = Object.values(engineChampions).find(c => c.key === banKey)
                      const img = champ ? \`https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/\${champ.id}.png\` : null
                      return (
                        <div key={'rb'+i} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-gray-700 bg-gray-900 border-b-2 border-b-red-600">
                          {img ? (
                            <div className="relative h-full w-full">
                              <img src={img} className="h-full w-full object-cover grayscale brightness-50" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-[2px] w-full -rotate-45 bg-[#c8aa6e]"></div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-2xl font-bold uppercase tracking-wider text-red-500">{match.opponent}</div>
                </div>
              </div>

              {/* Main Arena */}
              <div className="relative flex flex-1 overflow-hidden bg-[url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg')] bg-cover bg-center before:absolute before:inset-0 before:bg-black/95">
                
                {/* Left Side (Blue) */}
                <div className="relative z-10 flex w-[300px] flex-col justify-around bg-gradient-to-r from-black/100 via-black/80 to-transparent p-4">
                  {DRAFT_ROLES.map(role => {
                    const champKey = draftState?.playerPicks?.[role]
                    const champ = Object.values(engineChampions).find(c => c.key === champKey)
                    const isPickingRow = step === 3 && currentBlueRoles.includes(role)
                    return (
                      <div key={'blue-'+role} className={\`relative flex h-[16vh] overflow-hidden rounded-md border-2 \${isPickingRow ? 'border-[#c8aa6e] shadow-[0_0_15px_rgba(200,170,110,0.6)] animate-pulse' : 'border-blue-900/40 bg-gray-900/40'}\`}>
                         {champ ? (
                           <img src={\`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/\${champ.id}_0.jpg\`} className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-screen" />
                         ) : null}
                         <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                         <div className="absolute bottom-2 left-3">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-[#c8aa6e] drop-shadow-md">{role}</div>
                           <div className="text-lg font-black text-white drop-shadow-md">{champ ? champ.name : (isPickingRow ? 'SÉLECTION...' : 'EN ATTENTE')}</div>
                         </div>
                      </div>
                    )
                  })}
                </div>

                {/* Center / Roster Select */}
                <div className="relative z-10 flex flex-1 flex-col items-center justify-end pb-8">
                   <div className="flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-gray-800 bg-black/80 p-5 shadow-2xl backdrop-blur-md">
                     
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-bold uppercase tracking-widest text-[#c8aa6e]">
                          {step === 2 ? 'Phase de Bannissement' : (currentBlueRoles.length > 0 ? \`À vous ! (\${currentBlueRoles.join(', ')})\` : 'Tour Adversaire')}
                       </span>
                       <div className="flex gap-3">
                         {step > 1 && (
                            <button type="button" onClick={() => setStep(step - 1)} className="text-xs uppercase text-gray-400 hover:text-white transition-colors">Retour</button>
                         )}
                         <button type="button" onClick={() => setStep(step + 1)} className={\`rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all \${true ? 'bg-[#c8aa6e] text-black shadow-[0_0_10px_rgba(200,170,110,0.5)] hover:bg-[#d4b982]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}\`}>
                            Valider la phase
                         </button>
                       </div>
                     </div>
                     
                     <div className="h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                       <div className="grid grid-cols-8 gap-2">
                         {Object.values(engineChampions).map(champion => {
                           const img = \`https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/\${champion.id}.png\`
                           
                           const isBanned = selectedBans.includes(champion.key) || match.draftState?.bans?.enemy?.includes(champion.key)
                           const isPicked = Object.values(draftState?.playerPicks || {}).includes(champion.key) || Object.values(draftState?.enemyPicks || {}).includes(champion.key)
                           const isLocked = isBanned || isPicked

                           return (
                             <button 
                               key={'opt-'+champion.key} 
                               disabled={isLocked && step === 3}
                               onClick={() => {
                                 if (step === 2) {
                                   if (selectedBans.includes(champion.key)) {
                                     setSelectedBans(prev => prev.filter(k => k !== champion.key))
                                   } else if (selectedBans.length < 5) {
                                     setSelectedBans(prev => [...prev, champion.key])
                                   }
                                 }
                                 if (step === 3 && currentBlueRoles.length > 0) {
                                   onSelectDraftPick(match.id, currentBlueRoles[0], champion.key)
                                 }
                               }}
                               className={\`group relative aspect-square overflow-hidden rounded border transition-all \${isLocked ? 'border-red-900/50 opacity-20 grayscale' : 'border-gray-700 hover:border-[#c8aa6e] hover:scale-105'}\`}
                             >
                               {img ? <img src={img} className="absolute inset-0 h-full w-full object-cover" /> : null}
                               <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-center text-[9px] font-bold text-white group-hover:text-[#c8aa6e] truncate">{champion.name}</div>
                             </button>
                           )
                         })}
                       </div>
                     </div>
                   </div>
                </div>

                {/* Right Side (Red) */}
                <div className="relative z-10 flex w-[300px] flex-col justify-around bg-gradient-to-l from-black/100 via-black/80 to-transparent p-4">
                  {DRAFT_ROLES.map(role => {
                    const champKey = draftState?.enemyPicks?.[role]
                    const champ = Object.values(engineChampions).find(c => c.key === champKey)
                    return (
                      <div key={'red-'+role} className={\`relative flex h-[16vh] overflow-hidden rounded-md border-2 border-red-900/40 bg-gray-900/40\`}>
                         {champ ? (
                           <img src={\`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/\${champ.id}_0.jpg\`} className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-screen scale-x-[-1]" />
                         ) : null}
                         <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                         <div className="absolute bottom-2 right-3 text-right">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 drop-shadow-md">{role}</div>
                           <div className="text-lg font-black text-white drop-shadow-md">{champ ? champ.name : 'EN ATTENTE'}</div>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}"""

content = content[:start_idx] + replacement + '\n          {step === 4 ? (' + content[end_idx + len('          {step === 4 ? ('):]

with open('src/App.jsx', 'w') as f:
    f.write(content)
print('patched!')
