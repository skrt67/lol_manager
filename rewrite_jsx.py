import sys

with open('src/App.jsx', 'r') as f:
    lines = f.readlines()

out = []
in_match_day_return = False
braces_count = 0
first_paren = False

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'function MatchDayPage(' in line:
        pass
    
    if line.strip() == 'return (' and 'MATCH_DAY_STEP_COUNT' not in "".join(lines[max(0, i-20):i]):
        if 'step === 1 ? (' in "".join(lines[i:i+30]):
            start_idx = i
            in_match_day_return = True
        
    if in_match_day_return:
        for char in line:
            if char == '(':
                first_paren = True
                braces_count += 1
            elif char == ')':
                braces_count -= 1
        
        if first_paren and braces_count == 0:
            end_idx = i
            in_match_day_return = False
            continue

print(start_idx, end_idx)
