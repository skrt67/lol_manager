const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Fix `\${...}` to `${...}`
code = code.replace(/\\\${/g, '${');

// Function to deduplicate options
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
if (!code.includes('uniqueChampionOptions')) {
  code = code.replace(
    '  const allChampionBanOptions = CHAMPIONS_DB',
    dedupCode + '\n  const allChampionBanOptions = uniqueChampionOptions'
  );
  code = code.replace(
    '  const allChampionPickOptions = CHAMPIONS_DB',
    '  const allChampionPickOptions = CHAMPIONS_DB // we might want to filter this by role later, but for now we use unique options?\n  // Wait, the pick options in the grid should be unique as well.\n'
  );
  // Actually, for step 3, maybe we filter by current role, or maybe we just show all unique champions. Let's just use uniqueChampionOptions for both.
  code = code.replace(
    '{(step === 2 ? allChampionBanOptions : allChampionPickOptions).map(champion => {',
    '{(step === 2 ? allChampionBanOptions : uniqueChampionOptions).map(champion => {'
  );
}

fs.writeFileSync('src/App.jsx', code);
console.log('done fixing esc and dedup');
