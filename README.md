# AUBM PCheck (Express + React + MySQL)

Application de fiches de préparation PC, protégée par authentification.

- **API** : Node.js + Express + MySQL/MariaDB
- **UI** : React (Vite)
- **Auth** : sessions cookie httpOnly, rôles **admin** / **lecteur**
- **Prod** : `http://195.200.200.16:8091`

## Rôles

| Rôle | Droits |
|------|--------|
| **admin** | CRUD fiches, checklist, finalisation, gestion des utilisateurs |
| **lecteur** | Consultation brouillons/historique + PDF/impression |

Au premier démarrage, un admin est créé via `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Sécurité (corrigée / recommandée)

- Auth obligatoire sur l’API (sauf `/api/health`)
- Mots de passe hashés (bcrypt)
- Sessions serveur en MySQL + cookie httpOnly / SameSite
- Rate-limit login + API
- En-têtes Helmet / CSP
- Requêtes SQL paramétrées
- **Recommandé** : reverse proxy HTTPS (nginx) puis `COOKIE_SECURE=true`

## Déploiement Debian

```bash
git config --global --add safe.directory /opt/aubm-pcheck
cd /opt/aubm-pcheck
git fetch origin && git checkout cursor/debian-express-8091-8e0b
git reset --hard origin/cursor/debian-express-8091-8e0b
sudo bash deploy/install-debian.sh
curl -s http://127.0.0.1:8091/api/health
```

Identifiants admin initiaux : voir `/opt/aubm-pcheck/.env`.

## Développement

```bash
cp .env.example .env
npm install
npm run dev
```
