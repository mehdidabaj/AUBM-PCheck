# AUBM PCheck (Express + React + SQLite)

Application de fiches de préparation PC, sans Next.js.

- **API** : Node.js + Express + SQLite (`better-sqlite3`)
- **UI** : React (Vite) + Tailwind
- **Écoute production** : `0.0.0.0:8091` → `http://195.200.200.16:8091`

## Fonctionnalités

- Version, propriétaire, nom du PC, dates
- Tâches admin / utilisateur (listes séparées), import, édition, suppression, réordonnancement
- Brouillons, finalisation, historique
- Export PDF / impression
- Données : `data/todos.db`

## Développement

Prérequis : Node.js 20+

```bash
npm install
npm run dev
```

- API : http://127.0.0.1:8091  
- UI Vite (proxy API) : http://127.0.0.1:5173  

## Production (locale)

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=8091 npm start
```

## Déploiement Debian (`195.200.200.16:8091`)

Sur le serveur :

```bash
sudo bash deploy/install-debian.sh
```

Le script installe Node 20, clone la branche, build, crée l’utilisateur `aubm`, active le service systemd `aubm-pcheck` sur le port **8091**.

Commandes utiles :

```bash
sudo systemctl status aubm-pcheck
sudo journalctl -u aubm-pcheck -f
curl -s http://195.200.200.16:8091/api/health
```

Variables (fichier `/opt/aubm-pcheck/.env`) :

| Variable  | Défaut        | Rôle                |
|-----------|---------------|---------------------|
| `HOST`    | `0.0.0.0`     | Interface d’écoute  |
| `PORT`    | `8091`        | Port HTTP           |
| `DATA_DIR`| `./data`      | Dossier SQLite      |
