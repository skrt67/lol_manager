with open('src/App.jsx', 'r') as f:
    content = f.read()

content = content.replace('Object.values(engineChampions).find(c => c.key === banKey)', "CHAMPIONS_DB.find(c => toChampionKey(c) === banKey)")
content = content.replace('Object.values(engineChampions).find(c => c.key === champKey)', "CHAMPIONS_DB.find(c => toChampionKey(c) === champKey)")
# the map logic
map_logic_old = """                         {Object.values(engineChampions).map(champion => {
                           const img = `https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${champion.id}.png`
                           
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
                               }}"""
map_logic_new = """                         {(step === 2 ? allChampionBanOptions : allChampionPickOptions).map(champion => {
                           const champKey = toChampionKey(champion)
                           const img = getChampionImageUrl(champion)
                           
                           const isBanned = selectedBans.includes(champKey) || match.draftState?.bans?.enemy?.includes(champKey)
                           const isPicked = Object.values(draftState?.playerPicks || {}).includes(champKey) || Object.values(draftState?.enemyPicks || {}).includes(champKey)
                           const isLocked = isBanned || isPicked

                           return (
                             <button 
                               key={'opt-'+champKey} 
                               disabled={isLocked && step === 3}
                               onClick={() => {
                                 if (step === 2) {
                                   if (selectedBans.includes(champKey)) {
                                     onToggleDraftBan(match.id, champKey) /* Custom helper instead of manually managing array if possible, or stick to onToggleDraftBan */
                                   } else if (selectedBans.length < 5) {
                                     onToggleDraftBan(match.id, champKey)
                                   }
                                 }
                                 if (step === 3 && currentBlueRoles.length > 0) {
                                   onSelectDraftPick(match.id, currentBlueRoles[0], champKey)
                                 }
                               }}"""
content = content.replace(map_logic_old, map_logic_new)

with open('src/App.jsx', 'w') as f:
    f.write(content)
print('patched')
