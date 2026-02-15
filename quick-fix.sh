#!/bin/bash

# Fix extension.ts - add type assertions
echo "Fixing extension.ts..."
sed -i '' 's/\.on('\''ready'\''/\.on('\''ready'\'' as string/g' src/extension.ts
sed -i '' 's/\.on('\''error'\''/\.on('\''error'\'' as string/g' src/extension.ts
sed -i '' 's/\.on('\''statsUpdated'\''/\.on('\''statsUpdated'\'' as string/g' src/extension.ts
sed -i '' 's/\.on('\''terminalData'\''/\.on('\''terminalData'\'' as string/g' src/extension.ts
sed -i '' 's/orchestrator\./orchestrator!\./g' src/extension.ts

# Fix apiAdapter.ts
echo "Fixing apiAdapter.ts..."
sed -i '' 's/errorData:/errorData as any:/g' src/kimi/apiAdapter.ts
sed -i '' 's/data:/data as any:/g' src/kimi/apiAdapter.ts

# Fix client.ts
echo "Fixing client.ts..."
sed -i '' 's/StreamMessageReader/MessageReader/g' src/kimi/client.ts
sed -i '' 's/StreamMessageWriter/MessageWriter/g' src/kimi/client.ts

echo "Done!"
