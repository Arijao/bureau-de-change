# 💱 Bureau de Change FX Mada

Système complet de gestion de bureau de change — **Next.js 15 + Prisma 5 + SQLite**

---

## 🚀 Installation

### Prérequis
- **Node.js 18+** (vérifier avec `node -v`)
- **npm 9+**

### Démarrage rapide

```bash
# 1. Copier le fichier d'environnement
cp .env.example .env

# 2. Lancer le script d'installation automatique
chmod +x install.sh && ./install.sh

# 3. Démarrer l'application
npm run dev
```

→ Ouvrir **http://localhost:3000**

### Installation manuelle (étape par étape)

```bash
npm install                  # Dépendances
npx prisma db push           # Créer la base SQLite
npm run db:seed              # Données initiales
npm run dev                  # Serveur de développement
```

---

## 🔐 Comptes par défaut

| Rôle | Username | Mot de passe |
|------|----------|-------------|
| **Admin** | `admin` | `admin123` |
| **Caissier** | `caissier` | `caissier123` |

> ⚠️ Changez ces mots de passe avant toute mise en production !

---

## 🏗️ Architecture

```
bureau-de-change/
│
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Groupe de routes protégées
│   │   ├── layout.tsx            # ← Navbar partagée
│   │   ├── dashboard/            # Tableau de bord + stats
│   │   ├── transactions/         # Historique des opérations
│   │   ├── transactions/new/     # Formulaire nouvelle transaction
│   │   ├── currencies/           # Gestion devises & taux
│   │   └── settings/             # Paramètres (Admin seulement)
│   ├── login/                    # Page de connexion
│   └── api/
│       ├── login/                # POST → crée la session
│       ├── logout/               # POST → détruit la session
│       └── backup/               # GET  → télécharge le fichier .db
│
├── actions/                      # Server Actions (mutations)
│   ├── auth.actions.ts
│   ├── transaction.actions.ts
│   ├── currency.actions.ts
│   └── settings.actions.ts
│
├── services/                     # Logique métier (requêtes DB)
│   ├── transaction.service.ts
│   ├── currency.service.ts
│   └── settings.service.ts
│
├── components/
│   ├── layout/                   # Navbar, AppLayout
│   ├── dashboard/                # StatCard, ActivityChart
│   ├── transactions/             # TransactionForm, Table, Filters
│   ├── currencies/               # CurrenciesClient
│   ├── ticket/                   # TicketModal (impression thermique)
│   └── settings/                 # SettingsClient
│
├── lib/
│   ├── prisma.ts                 # Client Prisma singleton
│   ├── auth.ts                   # Session, hash, cookies
│   ├── types.ts                  # Types locaux (miroir du schéma)
│   └── utils.ts                  # Formatage, helpers
│
├── prisma/
│   ├── schema.prisma             # Modèle de données
│   └── seed.ts                   # Données initiales
│
└── middleware.ts                 # Protection des routes (redirect → /login)
```

---

## 📋 Modèle de données (Prisma)

| Table | Description |
|-------|-------------|
| `User` | Comptes (Admin / Caissier), hash SHA-256 |
| `Session` | Sessions actives avec token HTTP-only |
| `Currency` | Devises : code, nom, drapeau, taux achat/vente |
| `RateHistory` | Audit trail de toutes les modifications de taux |
| `Transaction` | Opérations Achat/Vente avec montants et commission |
| `Receipt` | Tickets de caisse liés aux transactions |
| `Settings` | Configuration globale du bureau |

---

## 🧾 Tickets thermiques

- **Format 58mm** → imprimantes thermiques étroites
- **Format 80mm** → imprimantes thermiques standard
- Impression via `window.open()` + `window.print()`
- Raccourci clavier : `Ctrl+P` dans la modal

---

## 📦 Scripts disponibles

```bash
npm run dev          # Serveur développement (http://localhost:3000)
npm run build        # Build production optimisé
npm run start        # Serveur production
npm run lint         # ESLint

npm run db:push      # Appliquer le schéma Prisma à SQLite
npm run db:seed      # Insérer les données initiales
npm run db:studio    # Prisma Studio (interface visuelle DB)
npm run db:reset     # Reset complet DB + reseed
```

---

## 🔒 Sécurité

- Mots de passe : **SHA-256 + sel** (`bdc_salt`)
- Sessions : cookies HTTP-only, durée 7 jours
- Routes protégées par `middleware.ts`
- Accès admin/caissier séparé par rôle

---

## 🚀 Production

```bash
# Build
npm run build

# .env de production
DATABASE_URL="file:/var/data/bdc.db"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://votre-domaine.mg"

# Démarrer
npm run start
```

Sauvegardez régulièrement le fichier `prisma/dev.db` (ou le chemin défini dans `DATABASE_URL`).

---

*Conçu pour une utilisation offline-ready dans un bureau de change à Madagascar.*
