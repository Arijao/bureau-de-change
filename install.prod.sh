#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Bureau de Change — Installation Prod   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Vérification Node.js ─────────────────────────────────────
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js 18+ requis. Télécharger : https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ── Adresse IP du serveur ────────────────────────────────────
echo ""
echo "📡 Adresse IP de ce PC sur le réseau local :"
echo "   (Les caissiers utiliseront cette adresse)"
echo "   Exemple : 192.168.1.10"
echo "   Appuyez sur Entrée pour garder localhost uniquement"
echo ""
read -p "   IP du serveur : " SERVER_IP
echo ""

if [ -z "$SERVER_IP" ]; then
  ORIGINS="localhost:3000"
  echo "   ⚠️  Accessible uniquement sur ce PC"
else
  ORIGINS="localhost:3000,${SERVER_IP}:3000"
  echo "   ✓ Accessible depuis le réseau : http://${SERVER_IP}:3000"
fi

# ── Fichier .env ─────────────────────────────────────────────
cat > .env << EOF
DATABASE_URL="file:./prisma/prod.db"
ALLOWED_ORIGINS="${ORIGINS}"
EOF
echo "✓ Fichier .env créé"

# ── Dépendances ───────────────────────────────────────────────
echo ""
echo "📦 Installation des dépendances..."
npm install --silent

# ── Base de données ───────────────────────────────────────────
echo ""
echo "🗄️  Création de la base de données..."
./node_modules/.bin/prisma generate --silent
DATABASE_URL="file:./prisma/prod.db" ./node_modules/.bin/prisma db push --skip-generate

echo ""
echo "🌱 Initialisation des données..."
DATABASE_URL="file:./prisma/prod.db" ./node_modules/.bin/ts-node \
  --compiler-options '{"module":"CommonJS"}' prisma/seed.prod.ts

# ── Build production ──────────────────────────────────────────
echo ""
echo "🔨 Build de l'application (peut prendre 1-2 minutes)..."
npm run build

# ── PM2 (démarrage automatique) ───────────────────────────────
echo ""
echo "🔄 Installation du gestionnaire de processus PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 --silent
  echo "   ✓ PM2 installé"
else
  echo "   ✓ PM2 déjà présent"
fi

pm2 delete bureau-de-change 2>/dev/null || true
pm2 start npm --name "bureau-de-change" -- run prod:start
pm2 save

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅ Installation terminée !                         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║   Accès local   : http://localhost:3000              ║"
if [ -n "$SERVER_IP" ]; then
echo "║   Accès réseau  : http://${SERVER_IP}:3000              ║"
fi
echo "║                                                      ║"
echo "║   Admin         : admin / Admin@BDC2024!             ║"
echo "║   Caissier      : caissier / Caissier@BDC!           ║"
echo "║                                                      ║"
echo "║   ⚠️  CHANGEZ LES MOTS DE PASSE après connexion      ║"
echo "║      Paramètres → Utilisateurs → 🔑                  ║"
echo "║                                                      ║"
echo "║   Commandes utiles :                                 ║"
echo "║   pm2 status          → état de l'application        ║"
echo "║   pm2 logs            → voir les logs                ║"
echo "║   pm2 restart bureau-de-change → redémarrer         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
