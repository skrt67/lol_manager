with open("src/App.jsx", "r") as f:
    text = f.read()

match_day_start = text.find('function MatchDayPage({')
if match_day_start == -1:
    print("Could not find MatchDayPage")
    exit(1)

match_day_end = text.find('\nfunction', match_day_start + 1)
match_day_content = text[match_day_start:match_day_end]

return_idx = match_day_content.find('  return (\n', match_day_content.find('  const canGoNext ='))
if return_idx == -1:
    print("could not find return (\n")
    exit(1)

start_idx = return_idx

stack = []
end_idx = -1
in_return = False
for i, c in enumerate(match_day_content[start_idx:]):
    if c == '(':
        stack.append(c)
        in_return = True
    elif c == ')':
        stack.pop()
        if in_return and not stack:
            end_idx = start_idx + i
            break

print(f"start: {start_idx}, end: {end_idx}")
with open("content.txt", "w") as f2:
    f2.write(match_day_content[start_idx:end_idx+1])
