with open("src/components/MatchMap.jsx", "r") as f:
    text = f.read()

import re

# Swap respawnUntil state
text = re.sub(
    r'const \[respawnUntil,\s*setRespawnUntil\]\s*=\s*useState\(\{\}\)',
    r'const [deadRecords, setDeadRecords] = useState({})',
    text, count=1
)

old_effect = r"""  useEffect\(\(\) => \{
    if \(\!killLoserSide \|\| !killVictimRole\) \{
      return undefined
    \}

    const victimId = `\$\{killLoserSide\}-\$\{killVictimRole\}`
    const until = Date\.now\(\) \+ 5000

    const applyRespawnTimeoutId = setTimeout\(\(\) => \{
      setRespawnUntil\(\(previous\) => \(\{
        \.\.\.previous,
        \[victimId\]: until,
      \}\)\)
    \}, 0\)

    const timeoutId = setTimeout\(\(\) => \{
      setRespawnUntil\(\(previous\) => \{
        const next = \{ \.\.\.previous \}
        delete next\[victimId\]
        return next
      \}\)
    \}, 5000\)

  
  return \(\) => \{
      clearTimeout\(applyRespawnTimeoutId\)
      clearTimeout\(timeoutId\)
    \}
  \}, \[killLoserSide, killVictimRole, currentEvent\?\.minute\]\)"""

new_effect = """  useEffect(() => {
    if (!killLoserSide || !killVictimRole) {
      return undefined
    }

    const victimId = `${killLoserSide}-${killVictimRole}`
    const minute = currentEvent?.minute ?? 0

    setDeadRecords((prev) => ({
      ...prev,
      [victimId]: minute,
    }))
  }, [killLoserSide, killVictimRole, currentEvent?.minute])"""

text = re.sub(old_effect, new_effect, text, count=1)

text = re.sub(
    r'const isRespawning = \(respawnUntil\[unitId\] \?\? 0\) > Date\.now\(\)',
    r'const isRespawning = deadRecords[unitId] === (currentEvent?.minute ?? -1)',
    text, count=1
)

with open("src/components/MatchMap.jsx", "w") as f:
    f.write(text)
