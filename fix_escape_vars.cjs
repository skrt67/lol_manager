const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Fix `\${...}` to `${...}`
code = code.replace(/\\\${/g, '${');

// Filter duplicates
if (!code.includes('uniqueChampionOptions')) {
  const dedupCode = `
  const uniqueChampionOptions = useMemo(() => {
    const seen = new Set();
    return CHAMPIONS_DB.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, []);
`;
  code = code.replace('  const allChampionBanOptions = CHAMPIONS_DB', dedupCode + '\n  const allChampionBanOptions = uniqueChampionOptions');
  code = code.replace('  const allChampionPickOptions = CHAMPIONS_DB', '  const allChampionPickOptions = uniqueChampionOptions');
}

fs.writeFileSync('src/App.jsx', code);
console.log('done fixing esc and dedup');
