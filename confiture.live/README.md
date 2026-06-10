# Confiture.live

Application web mobile/tablette pour organiser des jam sessions en bar.

## Objectif

Confiture permet aux organisateurs de jam de gérer les inscriptions de musiciens, les instruments, les plateaux, les passages joués, les liens entre musiciens, les trous volontaires et les remplacements rapides pendant une soirée.

## État actuel du repo

Ce dépôt contient les fichiers de cadrage prêts à être ajoutés à Git.

Le code applicatif n’est pas encore généré. Les dossiers `backend/` et `frontend/` sont présents pour préparer la structure du monorepo.

## Structure

```text
confiture.live/
├── AGENTS.md
├── README.md
├── backend/
│   └── .gitkeep
├── frontend/
│   └── .gitkeep
└── docs/
    ├── README.md
    ├── product-spec.md
    ├── visual-spec-table-cards.md
    ├── technical-stack.md
    └── codex-ready-technical-spec.md
```

## Stack prévue

Backend :

- Django
- Django REST Framework
- PostgreSQL
- Django admin
- pytest + pytest-django

Frontend :

- React
- JavaScript
- MUI
- React Router
- TanStack Query
- Zustand
- Dexie.js
- dnd-kit
- React Hook Form
- Zod
- date-fns
- Vitest
- React Testing Library

## Décisions clés

- Frontend en JavaScript, pas TypeScript.
- Design system centralisé dans `frontend/src/theme/designTokens.js` une fois le front créé.
- Drag and drop vertical uniquement, jamais horizontal.
- V0 sans authentification : toutes les jams du service sont visibles.
- V1 avec compte organisateur.
- Moteur de tableau pur, testé, indépendant de React/MUI.
- Sync local-first avec Dexie + retry backend.
- Édition simultanée multi-appareil bloquée en V0.

## Démarrage Codex recommandé

Lire d’abord :

```text
AGENTS.md
docs/codex-ready-technical-spec.md
docs/product-spec.md
docs/visual-spec-table-cards.md
docs/technical-stack.md
```

Puis avancer par phases :

1. setup monorepo ;
2. setup frontend React JS + MUI + thème ;
3. setup backend Django ;
4. moteur pur de tableau + tests ;
5. UI tableau avec fake data ;
6. actions locales Zustand ;
7. drawers principaux ;
8. API Django ;
9. Dexie + sync ;
10. polish responsive.
