import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

start_idx = content.find("  return (\n    <div className=\"space-y-3\">\n      <Panel title=\"Live Match\" subtitle={`${liveSession.teamName} vs ${liveSession.opponentName} - FM Live Center`}>")
if start_idx == -1:
    print("Could not find start idx")
    exit(1)

end_idx = content.find("function MatchResultPage", start_idx)
if end_idx == -1:
    print("Could not find end idx")
    exit(1)

# Backtrack end_idx to just after the closing bracket of the return statement
end_match = content.rfind("  )\n}", start_idx, end_idx) + 5

new_return = """  return (
    <div className="flex h-full w-full flex-col bg-[#050505] text-white">
      {/* Top Banner (Scoreboard) */}
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-800 bg-[#0a0a0c] px-6 shadow-md">
        {/* Left Team (Blue) */}
        <div className="flex items-center gap-6">
          <div className="text-3xl font-black italic tracking-wider text-blue-400">{liveSession.teamName}</div>
          <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-widest text-blue-200/80">
            <span title="Kills" className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-500" /> {scoreboard.team.kills} KL</span>
            <span title="Towers" className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-400" /> {scoreboard.team.towers} TW</span>
            <span title="Dragons" className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-blue-300" /> {scoreboard.team.dragons} DR</span>
            <span title="Gold" className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-yellow-400" /> {(scoreboard.team.gold / 1000).toFixed(1)}K</span>
          </div>
        </div>

        {/* Center: Match Time & State */}
        <div className="flex flex-col items-center justify-center">
          <div className="text-2xl font-bold tracking-[0.15em] text-white">{String(liveMinute).padStart(2, '0')}:00</div>
          <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-widest text-gray-500">
            <span>Gold Var: <span className={(currentEvent?.goldDiff ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}>{(currentEvent?.goldDiff ?? 0) > 0 ? '+' : ''}{Math.round((currentEvent?.goldDiff ?? 0)/1000 * 10)/10}K</span></span>
            <span>•</span>
            <span className="text-cyan-400">{isFinished ? 'FIN' : isAutoPaused ? 'PAUSE' : 'LIVE'}</span>
          </div>
        </div>

        {/* Right Team (Red) */}
        <div className="flex items-center gap-6 text-right">
          <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-widest text-red-200/80">
            <span title="Gold" className="flex items-center gap-1.5">{(scoreboard.enemy.gold / 1000).toFixed(1)}K <div className="h-2 w-2 rounded-full bg-yellow-400" /></span>
            <span title="Dragons" className="flex items-center gap-1.5">{scoreboard.enemy.dragons} DR <div className="h-2 w-2 rounded-full bg-red-300" /></span>
            <span title="Towers" className="flex items-center gap-1.5">{scoreboard.enemy.towers} TW <div className="h-2 w-2 rounded-full bg-red-400" /></span>
            <span title="Kills" className="flex items-center gap-1.5">{scoreboard.enemy.kills} KL <div className="h-2 w-2 rounded-full bg-red-500" /></span>
          </div>
          <div className="text-3xl font-black italic tracking-wider text-red-500">{liveSession.opponentName}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex flex-1 overflow-hidden bg-[url('https://ddragon.leagueoflegends.com/cdn/6.8.1/img/map/map11.png')] bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:bg-black/80">
        
        {/* Left Sidebar - Blue Team Stats */}
        <div className="relative z-10 flex w-[320px] shrink-0 flex-col border-r border-gray-800/60 bg-gradient-to-r from-[#030d1a]/80 to-transparent p-4">
          <div className="flex flex-1 flex-col justify-around gap-2">
            {teamLiveRows.map((row) => (
              <div key={`blue-${row.role}`} className="flex flex-col gap-1 rounded-sm border-l-2 border-blue-500 bg-blue-950/30 p-2 shadow backdrop-blur-sm">
                <div className="flex items-end justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200">{row.playerName}</span>
                  <span className="text-[10px] uppercase text-blue-400/80">{row.role}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold text-white">{row.championName}</div>
                  <div className="flex gap-3 text-xs font-mono text-gray-300">
                    <span className="text-white">{row.kills} K</span>
                    <span>{row.farm} CS</span>
                  </div>
                </div>
                <div className="truncate text-right text-[10px] text-gray-400" title={row.items}>{row.items}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Center Canvas - Map & Timeline */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
          <div className="relative flex aspect-square h-[65vh] max-h-[800px] w-[65vh] max-w-[800px] items-center justify-center overflow-hidden rounded-full border-4 border-gray-800/80 shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-sm">
             <MatchMap
              liveSession={liveSession}
              currentIndex={currentIndex}
              focusRole={liveSession.focusRole}
            />
          </div>

          {/* Timeline events ticker */}
          <div className="absolute bottom-6 left-0 right-0 mx-auto w-full max-w-2xl px-4">
            <div className="flex flex-col gap-2 rounded-lg border border-gray-800/60 bg-black/60 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8aa6e]">Play by Play</span>
                
                {/* Control Panel inside the ticker */}
                <div className="flex items-center gap-3">
                  {!isFinished && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {[1, 2, 4].map(s => (
                        <button key={'s'+s} type="button" onClick={() => setAutoSpeedMultiplier(s)} className={`px-1.5 py-0.5 rounded ${autoSpeedMultiplier === s ? 'bg-[#c8aa6e] text-black font-bold' : 'text-gray-400 hover:text-white'}`}>x{s}</button>
                      ))}
                      <span className="mx-1 text-gray-600">|</span>
                      <button type="button" onClick={() => setIsAutoPaused(!isAutoPaused)} className="text-gray-300 hover:text-white uppercase transition">{isAutoPaused ? '▶ Play' : '⏸ Pause'}</button>
                      <button type="button" onClick={onSkip} className="text-gray-500 hover:text-gray-300 ml-2">Skip</button>
                    </div>
                  )}
                  {isFinished && (
                    <button type="button" onClick={onFinish} className="bg-[#c8aa6e] text-black px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-yellow-500 transition">Resultats</button>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-1.5 text-sm">
                {recentComments.map((event, idx) => (
                  <div key={'evt-'+event.minute} className={`flex gap-3 items-start ${idx === 0 ? 'text-white' : 'text-gray-500'}`}>
                    <span className={`font-mono text-xs w-8 text-right shrink-0 mt-0.5 ${idx === 0 ? 'text-[#c8aa6e]' : 'text-gray-600'}`}>{event.minute}'</span>
                    <span className={idx === 0 ? 'font-medium' : ''}>{event.commentary}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Red Team Stats */}
        <div className="relative z-10 flex w-[320px] shrink-0 flex-col border-l border-gray-800/60 bg-gradient-to-l from-[#1a0505]/80 to-transparent p-4">
          <div className="flex flex-1 flex-col justify-around gap-2">
            {enemyLiveRows.map((row) => (
              <div key={`red-${row.role}`} className="flex flex-col gap-1 rounded-sm border-r-2 border-red-500 bg-red-950/20 p-2 shadow backdrop-blur-sm text-right">
                <div className="flex items-end justify-between flex-row-reverse">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-200">{row.playerName}</span>
                  <span className="text-[10px] uppercase text-red-400/80">{row.role}</span>
                </div>
                <div className="flex items-center justify-between flex-row-reverse text-sm">
                  <div className="font-semibold text-white">{row.championName}</div>
                  <div className="flex gap-3 text-xs font-mono text-gray-300 flex-row-reverse">
                    <span className="text-white">{row.kills} K</span>
                    <span>{row.farm} CS</span>
                  </div>
                </div>
                <div className="truncate text-left text-[10px] text-gray-400" title={row.items}>{row.items}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
"""

new_content = content[:start_idx] + new_return + content[end_match:]

with open('src/App.jsx', 'w') as f:
    f.write(new_content)

print("success")
