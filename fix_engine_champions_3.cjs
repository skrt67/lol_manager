const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(/Object\.values\(engineChampions\)/g, 'CHAMPIONS_DB');
code = code.replace(/champion\.key/g, 'toChampionKey(champion)');
code = code.replace(/c\.key/g, 'toChampionKey(c)');
code = code.replace(/setSelectedBans\(prev => prev.filter\(k => k !== toChampionKey\(champion\)\)\)/g, 'onToggleDraftBan(match.id, toChampionKey(champion))');
code = code.replace(/setSelectedBans\(prev => \[\.\.\.prev, toChampionKey\(champion\)\]\)/g, 'onToggleDraftBan(match.id, toChampionKey(champion))');
code = code.replace(/`https:\/\/ddragon\.leagueoflegends\.com\/cdn\/14\.3\.1\/img\/champion\/\${champion\.id}\.png`/g, 'getChampionImageUrl(champion)');

fs.writeFileSync('src/App.jsx', code);
console.log('done node replace');
