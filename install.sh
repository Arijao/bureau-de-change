#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Bureau de Change FX Mada — Setup       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then echo "❌ Node.js 18+ requis"; exit 1; fi
echo "✓ Node.js $(node -v)"

echo ""
echo "📦 Installation des dépendances..."
npm install

echo ""
echo "⚙️  Génération du client Prisma (local v5)..."
./node_modules/.bin/prisma generate

echo ""
echo "🗄️  Création de la base de données SQLite..."
./node_modules/.bin/prisma db push

echo ""
echo "🌱 Insertion des données initiales (8 devises + stock)..."
./node_modules/.bin/ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ Installation terminée !              ║"
echo "║                                          ║"
echo "║   Lancer : npm run dev                   ║"
echo "║   URL    : http://localhost:3000          ║"
echo "║                                          ║"
echo "║   Admin    : admin / admin123            ║"
echo "║   Caissier : caissier / caissier123      ║"
echo "╚══════════════════════════════════════════╝"
echo ""
