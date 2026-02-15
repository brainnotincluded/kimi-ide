#!/bin/bash
set -e

echo "🔨 Building Kimi IDE..."

# Clean
echo "  Cleaning dist..."
rm -rf dist
mkdir -p dist

# Build renderer (webpack - development mode)
echo "  Building renderer (webpack)..."
npx webpack --mode development

# Copy splash screen
cp public/splash.html dist/splash.html

# Build main process with proper tsconfig
echo "  Building main process..."
npx tsc --project tsconfig.main.json

echo "✅ Build complete!"
echo ""
echo "Main files:"
ls -lh dist/main/*.js 2>/dev/null | head -10
echo ""
echo "🚀 Run with: npm start"
