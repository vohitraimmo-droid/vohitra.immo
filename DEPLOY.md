# Guide de déploiement — Vohitra Immobilier

Ce projet utilise **TanStack Start (SSR)** avec Vinxi/Nitro. Il se déploie sur Vercel ou Netlify **sans aucune dépendance Lovable**.

---

## 1. Prérequis

- **Node.js 22.x** (`.nvmrc` ou `.node-version` si besoin)
- Un compte [Vercel](https://vercel.com) (gratuit)
- Un projet [Supabase](https://supabase.com) (gratuit)

---

## 2. Supabase — créer votre propre projet

> Si vous voulez utiliser le **même projet Supabase** qu'avant (déjà en production), passez directement à l'étape 3.

### 2a. Créer un nouveau projet Supabase

1. Allez sur [supabase.com](https://supabase.com) → **New project**
2. Notez votre **Project URL** et votre **anon key** (dans Settings → API)

### 2b. Appliquer les migrations

```bash
# Installer la CLI Supabase
npm install -g supabase

# Connectez-vous
supabase login

# Liez votre projet (remplacez YOUR_PROJECT_ID)
supabase link --project-ref YOUR_PROJECT_ID

# Appliquez toutes les migrations SQL
supabase db push
```

Les migrations se trouvent dans `supabase/migrations/`. Elles créent toutes les tables : `properties`, `profiles`, `user_roles`, `tokens`, `messages`, `favorites`, etc.

---

## 3. Variables d'environnement

Créez un fichier `.env` à la racine (copié depuis `.env.example`) :

```env
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_anon
VITE_SUPABASE_PROJECT_ID=votre_project_id
SUPABASE_URL=https://VOTRE-PROJET.supabase.co
SUPABASE_PUBLISHABLE_KEY=votre_cle_anon
```

> ⚠️ Ne commitez jamais le fichier `.env` — il est dans `.gitignore`.

---

## 4. Déploiement sur Vercel (recommandé)

### 4a. Pousser sur GitHub

```bash
git init
git add .
git commit -m "init: projet vohitra sans dépendances Lovable"
git branch -M main
git remote add origin https://github.com/VOTRE-USER/vohitra-immo.git
git push -u origin main
```

### 4b. Connecter à Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importez votre repo GitHub
3. **Framework Preset** → `Other`
4. Configurez les commandes :

| Réglage | Valeur |
|---------|--------|
| Build Command | `npm run build` |
| Output Directory | *(laisser vide)* |
| Install Command | `npm install` |
| Node Version | `22.x` |

### 4c. Variables d'environnement Vercel

Dans **Settings → Environment Variables**, ajoutez :

| Clé | Valeur |
|-----|--------|
| `VITE_SUPABASE_URL` | `https://VOTRE-PROJET.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | votre clé anon |
| `VITE_SUPABASE_PROJECT_ID` | votre project ID |
| `SUPABASE_URL` | `https://VOTRE-PROJET.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | votre clé anon |
| `NITRO_PRESET` | `vercel` |

### 4d. Cliquez sur Deploy 🚀

---

## 5. Configurer Supabase Auth

Dans votre projet Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://votre-site.vercel.app`
- **Redirect URLs** : `https://votre-site.vercel.app/**`

---

## 6. Développement local

```bash
# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env
# → Remplissez vos vraies valeurs dans .env

# Lancer en mode dev (avec hot reload)
npm run dev
# → http://localhost:3000

# Build de production
npm run build

# Preview du build
npm run preview
```

---

## 7. Modération IA des photos (optionnel)

Par défaut désactivée (non bloquant). Pour l'activer avec OpenAI :

1. Créez un compte [OpenAI](https://platform.openai.com)
2. Créez une API key
3. Ajoutez dans Vercel : `OPENAI_API_KEY` = `sk-...`

Le modèle utilisé est **gpt-4o-mini** (très peu cher : ~$0.01/100 photos).

---

## 8. Fichiers modifiés par rapport à l'original Lovable

| Fichier | Changement |
|---------|-----------|
| `package.json` | Supprimé `@lovable.dev/*`, remplacé `@tanstack/react-start` (stable), ajouté `vinxi` |
| `vite.config.ts` | Remplacé `@lovable.dev/vite-tanstack-config` par config standard |
| `src/start.ts` | Supprimé la référence à la route `/lovable/` |
| `src/routeTree.gen.ts` | Supprimé les 3 routes `lovable/email/*` |
| `src/lib/moderation.functions.ts` | Remplacé gateway Lovable par OpenAI (optionnel, fail-open) |
| `.lovable/` | Dossier supprimé |
| `src/routes/lovable/` | Dossier supprimé |
| `.env` | Supprimé (ajouté `.env.example` à la place) |

---

## 9. Configurer Supabase depuis zéro (nouveau projet)

Si tu crées un **nouveau projet Supabase** (pas le même qu'avant) :

### Méthode rapide — SQL Editor

1. Ouvre ton projet Supabase → **SQL Editor** → **New query**
2. Copie-colle le contenu de `supabase/setup.sql`
3. Clique **Run** — tout est créé en une fois

Ce script crée :
- Toutes les tables avec leurs contraintes
- Toutes les politiques RLS (sécurité)
- Tous les triggers (updated_at, validation, anti-escalade)
- Les fonctions SECURITY DEFINER (debit_tokens, credit_tokens, get_visit_phone…)
- Les buckets Storage (property-photos, site-assets, kyc-documents)
- Les publications Realtime
- Le cron job de nettoyage des comptes non confirmés

### Méthode CLI (si tu as Supabase CLI)

```bash
# Lier ton projet
supabase link --project-ref TON_PROJECT_ID

# Appliquer le script directement
supabase db execute --file supabase/setup.sql
```

### Créer ton premier compte admin

Après inscription sur le site, exécute dans SQL Editor :

```sql
-- Remplace l'email par le tien
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'ton-email@exemple.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Ajouter aussi le rôle proprietaire si tu veux poster des annonces
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'proprietaire'::public.app_role
FROM auth.users
WHERE email = 'ton-email@exemple.com'
ON CONFLICT (user_id, role) DO NOTHING;
```
