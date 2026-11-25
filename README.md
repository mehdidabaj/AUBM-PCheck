# AUBM PCheck (Express + React + MySQL)

Application de fiches de préparation PC, protégée par authentification.

- **API** : Node.js + Express + MySQL/MariaDB
- **UI** : React (Vite)
- **Auth** : sessions cookie httpOnly, rôles **admin** / **lecteur**
- **Prod** : `http://195.200.200.16:8091`

## Premier démarrage

Si aucun utilisateur n’existe, la **première page** propose de **créer le compte administrateur** (identifiant + mot de passe). Aucun mot de passe admin dans `.env`.

Réinitialiser les comptes (réaffiche l’écran de setup) :

```bash
sudo bash /opt/aubm-pcheck/deploy/reset-auth.sh
```

## Rôles

| Rôle | Droits |
|------|--------|
| **admin** | CRUD fiches, checklist, finalisation, gestion des utilisateurs |
| **lecteur** | Consultation brouillons/historique + PDF/impression |

## Sécurité

- Mots de passe applicatifs hashés (bcrypt) en MySQL
- Pas de `ADMIN_PASSWORD` en clair dans `.env`
- `.env` en `chmod 600` (secret MySQL de connexion uniquement)
- Sessions + cookie httpOnly, rate-limit, Helmet/CSP, SQL paramétré
- **Recommandé** : HTTPS (nginx) + `COOKIE_SECURE=true`

## Déploiement Debian

```bash
git config --global --add safe.directory /opt/aubm-pcheck
cd /opt/aubm-pcheck
git fetch origin && git checkout cursor/debian-express-8091-8e0b
git reset --hard origin/cursor/debian-express-8091-8e0b
sudo bash deploy/install-debian.sh
sudo bash deploy/reset-auth.sh   # optionnel : forcer l’écran de création admin
```

## Développement

```bash
cp .env.example .env
npm install
npm run dev
```
