#!/bin/bash

echo "🚀 Запуск Kimi IDE..."
echo ""

cd /Users/mac/kimi-vscode/ide

# Проверка установки зависимостей
if [ ! -d "node_modules" ]; then
    echo "⚠️ Установка зависимостей..."
    npm install --legacy-peer-deps
fi

# Сборка если нужно
if [ ! -d "dist" ] || [ ! -f "dist/main.js" ]; then
    echo "🔨 Сборка проекта..."
    npm run build
fi

echo "✅ Запуск Electron..."
echo ""

# Запуск Electron
npm start
