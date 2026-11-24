# AUBM PCheck — Fiches Todo PC

Application desktop Windows pour créer des fiches de préparation PC avec checklist, export PDF / impression, et historique des fiches finalisées.

## Fonctionnalités

- **Fiche Todo PC** avec :
  - Version du Todo PC
  - Nom du propriétaire
  - Nom complet du PC
  - Date de début de préparation
  - Liste de tâches saisies, ajoutées, puis cochées
- **Brouillons** : enregistrer une fiche en cours
- **Finalisation** : date de fin de préparation → passage dans l’historique
- **Historique** : consultation, recherche, export PDF / impression
- **Export PDF** et **impression directe**

## Prérequis

- Node.js 18+ (recommandé 20 ou 22)
- Windows pour l’installateur / le portable (développement possible sous Linux/macOS)

## Installation

```bash
npm install
```

## Lancer en développement

```bash
npm start
```

## Construire pour Windows

```bash
npm run dist
```

Les fichiers générés se trouvent dans `dist/` :

- Installateur NSIS (`.exe`)
- Version portable (`.exe`)

## Données

Les brouillons et l’historique sont stockés localement dans le dossier userData d’Electron :

`%APPDATA%/aubm-pcheck/data/todos.json`

## Utilisation rapide

1. Renseigner version, propriétaire, nom du PC et date de début
2. Ajouter les tâches une par une
3. Cocher les tâches au fur et à mesure
4. Enregistrer en brouillon si besoin
5. Finaliser avec une date de fin → historique
6. Exporter en PDF ou imprimer à tout moment
