import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# 1. Patch isImmersiveMode to include ALL match-day steps
content = re.sub(
    r"const isImmersiveMode = activePage === 'match-live' \|\| \(activePage === 'match-day' && \(activeMatchFlowStep === 1 \|\| activeMatchFlowStep === 2 \|\| activeMatchFlowStep === 3\)\)",
    r"const isImmersiveMode = activePage === 'match-live' || activePage === 'match-day'",
    content
)

with open('src/App.jsx', 'w') as f:
    f.write(content)
print("Immersive mode patched")
