# 🚀 Guide de mise en production — Bureau de Change FX Mada

## Vue d'ensemble

| Aspect | État actuel (test) | État cible (prod) |
|--------|-------------------|-------------------|
| Base de données | `dev.db` avec données fictives | `prod.db` propre |
| Mots de passe | `admin123` / `caissier123` | Sécurisés |
| Taux | Exemples | Taux du marché du jour |
| Stocks | Fictifs | Inventaire réel |
| Transactions | Tests | Zéro au démarrage |

---

## ÉTAPE 1 — Personnaliser le seed de production

Ouvrir `prisma/seed.prod.ts` et modifier les 3 sections en haut du fichier :

```ts
// 1. Informations du bureau
const BUREAU_INFO = {
  bureauName: 'Votre Vrai Nom',        // ex: "FX Mada Change"
  address:    'Votre adresse réelle',
  phone:      '+261 XX XX XXX XX',
  footer:     'Merci pour votre confiance',
}

// 2. Mots de passe (à changer avant lancement)
const ADMIN_PASSWORD    = 'MotDePasseAdmin!'
const CAISSIER_PASSWORD = 'MotDePasseCaissier!'
const CAISSIER_NOM      = 'Prénom Nom du caissier'

// 3. Taux du jour et stocks initiaux
//    → Consultez votre source habituelle (BFM, BOA, etc.)
```

---

## ÉTAPE 2 — Initialisation de la base de production

```bash
# Renommer la base pour ne pas écraser les données test
# (optionnel si vous voulez repartir de zéro)

# Option A : base fraîche (recommandé pour la production)
DATABASE_URL="file:./prisma/prod.db" npx prisma db push
DATABASE_URL="file:./prisma/prod.db" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.prod.ts

# Option B : reset complet si dev.db suffit (perd tout)
npm run db:reset
```

Mettre à jour `.env` :
```env
DATABASE_URL="file:./prisma/prod.db"
```

---

## ÉTAPE 3 — Configuration `next.config.ts`

```ts
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Remplacer 'localhost:3000' par votre IP/hostname réel
      // Ex: "192.168.1.10:3000" pour accès réseau local
      allowedOrigins: ['localhost:3000', '192.168.1.10:3000'],
    },
  },
}
```

---

## ÉTAPE 4 — Démarrage en production

```bash
npm run build
npm run start
# ou en arrière-plan :
npm run build && nohup npm run start > bdc.log 2>&1 &
```

---

## ÉTAPE 5 — Premier login

1. Ouvrir `http://localhost:3000`
2. Se connecter avec le compte admin
3. **Aller dans Paramètres → Utilisateurs**
4. Changer immédiatement les mots de passe (bouton 🔑)
5. Vérifier les informations du bureau (nom, adresse, téléphone)
6. Aller dans **Devises & Taux** et ajuster les taux du jour

---

## Gestion quotidienne des taux

Les taux doivent être mis à jour chaque matin :

**Via l'interface :** Devises & Taux → bouton 📈 Taux → saisir les nouveaux taux

L'historique complet est conservé automatiquement (table `ExchangeRate`).

> **Conseil :** Mettre à jour les taux AVANT d'ouvrir le bureau. Tout achat/vente
> utilise le dernier taux enregistré.

---

## Stratégie de backup

### Backup manuel (via l'interface)
Paramètres → **⬇ Télécharger backup DB**

Le fichier `.db` téléchargé contient **toute la base** (transactions, stocks, historique).

### Backup automatique (recommandé)
Créer un cron job sur la machine locale :

```bash
# Exemple : backup tous les jours à 18h00
# Ajouter dans crontab (crontab -e) :
0 18 * * * cp /chemin/vers/prisma/prod.db /chemin/backup/bdc_$(date +\%Y-\%m-\%d).db
```

### Restauration
```bash
# Arrêter l'application
# Remplacer le fichier .db
cp bdc_backup_2024-01-15.db prisma/prod.db
# Redémarrer
npm run start
```

---

## Structure des rôles

| Fonctionnalité | Caissier | Admin |
|----------------|----------|-------|
| Nouvelle transaction | ✅ | ✅ |
| Consulter historique | ✅ | ✅ |
| Tableau de bord | ✅ | ✅ |
| Modifier taux | ❌ | ✅ |
| Gérer stocks | ❌ | ✅ |
| Ajouter/modifier devises | ❌ | ✅ |
| Paramètres & utilisateurs | ❌ | ✅ |
| Backup base | ❌ | ✅ |

---

## Optimisations UX pour le caissier

### Raccourci clavier (déjà disponible)
- **Ctrl + Entrée** → valider la transaction directement

### Workflow optimal (3 étapes)
1. Sélectionner la devise dans le menu
2. Saisir le montant
3. Ctrl+Entrée → ticket généré

### Conseils pratiques
- Laisser l'onglet "Nouvelle transaction" ouvert en permanence
- Utiliser le raccourci Ctrl+Entrée au lieu de la souris
- Le taux est affiché automatiquement à la sélection de la devise
- L'alerte stock faible ⚠️ est visible directement dans la liste des devises

---

## Points de vigilance

### Numérotation des reçus
La numérotation est basée sur `COUNT(transactions) + 1001`. En production :
- Ne jamais supprimer de transactions directement en base
- La séquence sera continue tant qu'aucune suppression n'est faite

### Sécurité
- Le mot de passe est haché (SHA-256 + sel) — suffisant pour usage local
- Les sessions expirent après 7 jours
- Toute désactivation d'utilisateur ferme ses sessions actives immédiatement
- Le cookie session est `httpOnly` + `secure` en production

### Performance SQLite
SQLite est parfaitement adapté pour un usage local mono-poste ou petit réseau.
Pour une utilisation multi-postes simultanés (>3 caisses), envisager PostgreSQL.

---

## Checklist avant ouverture

- [ ] `DATABASE_URL` pointe vers `prod.db`
- [ ] Mot de passe admin changé
- [ ] Mot de passe caissier changé
- [ ] Informations bureau correctes (tickets)
- [ ] Taux du jour saisis
- [ ] Stocks initiaux reflètent la caisse réelle
- [ ] Test d'une transaction ACHAT et VENTE
- [ ] Test impression ticket
- [ ] Premier backup téléchargé
