import re

with open('src/App.jsx', 'r') as f:
    text = f.read()

# 1. Replace Object.values(engineChampions).find(c => c.key === ...)
text = re.sub(
    r'Object\.values\(engineChampions\)\.find\(c => c\.key === ([a-zA-Z0-y]+)\)',
    r'CHAMPIONS_DB.find(c => toChampionKey(c) === \1)',
    text
)

# 2. Replace {Object.values(engineChampions).map(champion => {
text = re.sub(
    r'\{Object\.values\(engineChampions\)\.map\(champion => \{',
    r'{(step === 2 ? allChampionBanOptions : allChampionPickOptions).map(champion => {',
    text
)

# 3. Replace all instances of `champion.key` in the map body up to </a> or </button>
# Instead of doing that, I'll just write a script to rewrite Lines 3995..4024

with open('src/App.jsx', 'w') as f:
    f.write(text)
