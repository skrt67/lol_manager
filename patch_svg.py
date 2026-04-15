with open("src/components/MatchMap.jsx", "r") as f:
    text = f.read()

import re

# We want to replace the first 3 paths
text = re.sub(
    r'<path d="M10 70 L30 50 L50 35 L72 20 L90 8"[^>]+/>',
    r'<path d="M 14 85 L 12 68 L 15 48 L 18 28 Q 18 14 26 14 L 48 14 L 68 14 L 85 14" fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth="1.6" />',
    text,
    count=1
)
text = re.sub(
    r'<path d="M10 90 L50 50 L90 10"[^>]+/>',
    r'<path d="M 10 90 L 50 50 L 90 10" fill="none" stroke="rgba(226,232,240,0.15)" strokeWidth="2.1" />',
    text,
    count=1
)
text = re.sub(
    r'<path d="M8 92 L26 74 L45 55 L66 37 L92 28"[^>]+/>',
    r'<path d="M 14 85 L 30 86 L 50 86 L 74 86 Q 86 86 86 72 L 86 52 L 86 32 L 85 14" fill="none" stroke="rgba(226,232,240,0.12)" strokeWidth="1.6" />',
    text,
    count=1
)

with open("src/components/MatchMap.jsx", "w") as f:
    f.write(text)
