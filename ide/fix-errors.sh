#!/bin/bash

# Fix trench-integration.ts
echo "Fixing trench-integration.ts..."
sed -i '' 's/const process = /const ptyProcess = /g' src/main/trench-integration.ts
sed -i '' 's/process\.stdout/ptyProcess.stdout/g' src/main/trench-integration.ts
sed -i '' 's/process\.stderr/ptyProcess.stderr/g' src/main/trench-integration.ts
sed -i '' 's/process\.on/ptyProcess.on/g' src/main/trench-integration.ts

# Fix App.tsx imports
echo "Fixing App.tsx..."
sed -i '' 's/import { FileExplorer }/import FileExplorer/g' src/renderer/App.tsx
sed -i '' 's/import { Editor }/import { Editor as EditorComponent }/g' src/renderer/App.tsx
sed -i '' 's/import { StatusBar }/import StatusBar/g' src/renderer/App.tsx
sed -i '' 's/import { TitleBar }/import TitleBar/g' src/renderer/App.tsx
sed -i '' 's/<Editor /<EditorComponent /g' src/renderer/App.tsx

# Fix Editor.tsx
echo "Fixing Editor.tsx..."
sed -i '' 's/enabled: "on"/enabled: true/g' src/renderer/components/Editor.tsx
sed -i '' 's/theme === "dark" ? "vs-dark"/theme === "dark" ? "vs-dark" as const/g' src/renderer/components/Editor.tsx

# Fix index.tsx
echo "Fixing index.tsx..."
sed -i '' 's/import App from/import { App } from/g' src/renderer/index.tsx

# Remove missing imports from Terminal.tsx
echo "Fixing Terminal.tsx..."
sed -i '' "/import.*xterm-addon-serialize/d" src/renderer/components/Terminal.tsx
sed -i '' "/import.*xterm-addon-unicode11/d" src/renderer/components/Terminal.tsx
sed -i '' "/SerializeAddon/d" src/renderer/components/Terminal.tsx
sed -i '' "/Unicode11Addon/d" src/renderer/components/Terminal.tsx

# Fix TitleBar.tsx
echo "Fixing TitleBar.tsx..."
sed -i '' 's/WebkitAppRegion:/WebkitAppRegion: undefined,/g' src/renderer/components/TitleBar.tsx

echo "Done fixing!"
