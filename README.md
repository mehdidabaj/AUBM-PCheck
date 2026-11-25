# AUBM PCheck (Next.js + SQLite)

Application web de fiches de préparation PC avec checklist, historique, export PDF et impression.

## Fonctionnalités

- Version, propriétaire, nom du PC, date de début
- Tâches : ajout, coches, suppression
- Brouillons + finalisation (date de fin) → historique recherchable
- Export PDF / impression
- Stockage **SQLite** (`data/todos.db`)

## Prérequis Windows

1. [Node.js 20+](https://nodejs.org) (cochez “Add to PATH”)
2. Outils de build pour `better-sqlite3` :
   - Visual Studio Build Tools avec **Desktop development with C++**
   - ou : `npm install -g windows-build-tools` (selon environnement)

## Déploiement propre (Windows)

### Première installation

```powershell
cd D:\AUBM-PCheck
git fetch origin
git checkout cursor/nextjs-sqlite-8e0b
git reset --hard origin/cursor/nextjs-sqlite-8e0b

# Option A — double-clic
deploy.bat

# Option B — PowerShell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-windows.ps1
```

### Démarrer l’app (production)

```powershell
# Option A — double-clic
start.bat

# Option B — PowerShell
powershell -ExecutionPolicy Bypass -File .\scripts\start-windows.ps1
```

Ouvre : **http://localhost:3000**

Sur le même réseau (téléphone / autre PC) : `http://IP-DU-PC:3000`

### Commandes manuelles

```powershell
npm install
npm run build
npm start
```

## Développement

```powershell
npm install
npm run dev
```

## Données

Base SQLite créée automatiquement :

`data\todos.db`

Sauvegardez ce fichier pour conserver l’historique.

## Mise à jour

```powershell
git pull origin cursor/nextjs-sqlite-8e0b
.\deploy.bat
.\start.bat
```
