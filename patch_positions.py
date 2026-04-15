with open("src/components/MatchMap.jsx", "r") as f:
    text = f.read()

import re

team_repl = """const TEAM_LANE_POSITIONS = {
  Top: { x: 18, y: 26 },
  Jungle: { x: 35, y: 65 },
  Mid: { x: 46, y: 54 },
  ADC: { x: 74, y: 82 },
  Support: { x: 70, y: 86 },
}"""

enemy_repl = """const ENEMY_LANE_POSITIONS = {
  Top: { x: 26, y: 18 },
  Jungle: { x: 65, y: 35 },
  Mid: { x: 54, y: 46 },
  ADC: { x: 82, y: 74 },
  Support: { x: 86, y: 70 },
}"""

text = re.sub(r'const TEAM_LANE_POSITIONS = \{[^}]+\}', team_repl, text, count=1)
text = re.sub(r'const ENEMY_LANE_POSITIONS = \{[^}]+\}', enemy_repl, text, count=1)

with open("src/components/MatchMap.jsx", "w") as f:
    f.write(text)
