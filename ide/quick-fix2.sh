#!/bin/bash

# Fix useTerminal.ts
echo "Fixing useTerminal.ts..."
sed -i '' 's/(event: any, data: { ptyId: string; data: string; })/(event: any, data: any)/g' src/renderer/hooks/useTerminal.ts
sed -i '' 's/(event: any, data: { ptyId: string; exitCode: number; })/(event: any, data: any)/g' src/renderer/hooks/useTerminal.ts

# Fix index.tsx
echo "Fixing index.tsx..."
sed -i '' 's/window.electron.logError/console.error/g' src/renderer/index.tsx
sed -i '' 's/window.electron.logError/console.error/g' src/renderer/index.tsx
sed -i '' '/declare global/,/}/d' src/renderer/index.tsx
sed -i '' 's/module.hot.accept()/(module as any).hot.accept()/g' src/renderer/index.tsx
sed -i '' 's/module.hot.dispose()/(module as any).hot.dispose()/g' src/renderer/index.tsx

echo "Done!"
