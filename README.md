# AUBM PCheck (Next.js + SQLite)

Application web de fiches de préparation PC avec checklist, historique, export PDF et impression.

## Fonctionnalités

- Version, propriétaire, nom du PC, date de début
- Tâches : ajout, coches, suppression
- Brouillons + finalisation (date de fin) → historique recherchable
- Export PDF / impression
- Stockage **SQLite** (`data/todos.db`)

## Prérequis

- Node.js 20+

## Lancer

```bash
npm install
npm run dev
```

Ouvre : http://localhost:3000

## Production

```bash
npm run build
npm start
```

## Données

Base SQLite créée automatiquement dans `data/todos.db`.
