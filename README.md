# AUBM PCheck (Express + React + MySQL)

Application de fiches de préparation PC.

- **API** : Node.js + Express + **MySQL/MariaDB**
- **UI** : React (Vite) + Tailwind
- **Écoute production** : `0.0.0.0:8091` → `http://195.200.200.16:8091`

## Fonctionnalités

- Version, propriétaire, nom du PC, dates
- Tâches admin / utilisateur (listes séparées), import, édition, suppression, réordonnancement
- Brouillons, finalisation, historique
- Export PDF / impression

## Variables d’environnement

Voir `.env.example` :

| Variable | Défaut | Rôle |
|----------|--------|------|
| `HOST` | `0.0.0.0` | Interface d’écoute |
| `PORT` | `8091` | Port HTTP |
| `MYSQL_HOST` | `127.0.0.1` | Hôte MySQL |
| `MYSQL_PORT` | `3306` | Port MySQL |
| `MYSQL_USER` | `aubm` | Utilisateur |
| `MYSQL_PASSWORD` | `aubm_pcheck` | Mot de passe |
| `MYSQL_DATABASE` | `aubm_pcheck` | Base |

## Développement

Prérequis : Node.js 20+, MySQL/MariaDB local.

```bash
cp .env.example .env
# créez la base/utilisateur MySQL, puis :
npm install
npm run dev
```

- API : http://127.0.0.1:8091  
- UI Vite : http://127.0.0.1:5173  

## Production

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=8091 npm start
```

## Déploiement Debian (`195.200.200.16:8091`)

```bash
sudo bash deploy/install-debian.sh
```

Le script installe Node 20 + MariaDB, crée la base, build l’app et active `systemd` sur le port **8091**.

```bash
sudo systemctl status aubm-pcheck
sudo journalctl -u aubm-pcheck -f
curl -s http://195.200.200.16:8091/api/health
```
