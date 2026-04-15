import fs from 'fs'
const filePath = 'src/App.jsx'
let content = fs.readFileSync(filePath, 'utf-8')

// Replace `activePage === 'match-live'` with a new variable `isImmersiveMode` inside the fullscreen block
const immersiveDef = `    const currentStepIndex =
      activePage === 'match-day'
        ? clamp(activeMatchFlowStep, 1, 4)
        : activePage === 'match-live'
          ? 5
          : 6
    const isImmersiveMode = activePage === 'match-live' || (activePage === 'match-day' && (activeMatchFlowStep === 2 || activeMatchFlowStep === 3))`

content = content.replace(
  /const currentStepIndex =[\s\S]*?\:\ 6/,
  immersiveDef
)

content = content.replace(
  /<div className=\{\`bg-\[var\(--bg-app\)\] text-\[var\(--text-main\)\] \$\{activePage === 'match-live' \? 'h-screen overflow-hidden' \: 'min-h-screen'\}\`\}>/,
  `<div className={\`bg-[var(--bg-app)] text-[var(--text-main)] \${isImmersiveMode ? 'h-screen overflow-hidden' : 'min-h-screen'}\`}>`
)

content = content.replace(
  /<div className=\{\`mx-auto flex w-full flex-col \$\{activePage === 'match-live' \? 'h-screen' \: 'min-h-screen'\} \$\{activePage === 'match-live' \? '' \: 'max-w-\[1820px\] px-4 py-4 md:px-6 md:py-5'\}\`\}>/,
  `<div className={\`mx-auto flex w-full flex-col \${isImmersiveMode ? 'h-screen' : 'min-h-screen'} \${isImmersiveMode ? '' : 'max-w-[1820px] px-4 py-4 md:px-6 md:py-5'}\`}>`
)

content = content.replace(
  /\{activePage !== "match-live" \? \(/,
  `{!isImmersiveMode ? (`
)

content = content.replace(
  /<section className=\{\`flex-1 \$\{activePage === 'match-live' \? 'overflow-hidden flex flex-col' : 'mt-4 overflow-y-auto'\}\`\}>/,
  `<section className={\`flex-1 \${isImmersiveMode ? 'overflow-hidden flex flex-col' : 'mt-4 overflow-y-auto'}\`}>`
)

fs.writeFileSync(filePath, content)
console.log('patched header')
