import re

with open('src/App.jsx', 'r') as f:
    text = f.read()

# I also need to ensure that `<button onClick={onNextStep}>` on step 2 does something even if `canGoNext` is false?
# Ah wait, I want to allow checking step 1. Let's make Step 1 fully dark UI.
