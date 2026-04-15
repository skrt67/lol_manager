const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Replace all instances of the hardcoded URLs with the helper!

// 1. In the map for top banner (friendly bans)
code = code.replace(
  /const img = champ \? `https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[A-Za-z0-9\.]+\/img\/champion\/\$\{champ\.id\}\.png` : null/g,
  'const img = champ ? getChampionImageUrl(champ) : null'
);

// 2. In the map for enemy bans
code = code.replace(
  /const img = champ \? `https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[A-Za-z0-9\.]+\/img\/champion\/\$\{champ\.id\}\.png` : null/g,
  'const img = champ ? getChampionImageUrl(champ) : null'
);

// 3. In the center grid
code = code.replace(
  /const img = `https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[A-Za-z0-9\.]+\/img\/champion\/\$\{champion\.id\}\.png`/g,
  'const img = getChampionImageUrl(champion)'
);

// Wait, the splash images!
// Left Side (Blue)
// `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg`
// Let's use the override logic directly
code = code.replace(
  /`https:\/\/ddragon\.leagueoflegends\.com\/cdn\/img\/champion\/splash\/\$\{champ\.id\}_0\.jpg`/g,
  '`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${CHAMPION_IMAGE_ID_OVERRIDES[champ.id] ?? champ.id}_0.jpg`'
);

fs.writeFileSync('src/App.jsx', code);
console.log('done fixing images');
