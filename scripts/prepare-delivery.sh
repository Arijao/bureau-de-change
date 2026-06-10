#!/bin/bash

echo "⚠️  ATTENTION : Cette opération va SUPPRIMER toutes les données existantes de la base de données !"
echo "📋 Base de données cible : $(grep DATABASE_URL .env | cut -d'=' -f2)"
echo ""
read -p "Êtes-vous sûr de vouloir continuer ? (tapez 'oui' pour confirmer) : " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
  echo "❌ Opération annulée."
  exit 1
fi

echo ""
echo "🔄 1/4 - Reset complet de la base de données..."
npx prisma migrate reset --force

echo ""
echo "🌱 2/4 - Exécution du seed de production..."
npx tsx prisma/seed.prod.ts

echo ""
echo "📊 3/4 - Initialisation des comptes comptables..."
npx tsx scripts/init-charges-accounts.ts

echo ""
echo "✅ 4/4 - Préparation terminée !"
echo ""
echo "─────────────────────────────────────────────────────────"
echo "│  PROCHAINES ÉTAPES OBLIGATOIRES                       │"
echo "│  1. Lancer le serveur : npm run dev                   │"
echo "│  2. Admin : admin / Admin123                    │"
echo "│  3. Caissier : caissier / Caissier123               │"
echo "│  4. ⚠️  CHANGER LES MOTS DE PASSE IMMÉDIATEMENT      │"
echo "│  5. Personnaliser les paramètres du bureau            │"
echo "│  6. Faire un backup final (page 💾 Backups)           │"
echo "─────────────────────────────────────────────────────────"
