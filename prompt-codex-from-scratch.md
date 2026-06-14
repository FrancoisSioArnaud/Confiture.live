# Prompt Codex — Développer Confiture.live from scratch depuis docs/

Tu es dans un repo Git qui contient uniquement un dossier `docs/` avec les specs du projet Confiture.live.

Ta mission : développer le projet from scratch en autonomie, en respectant strictement les specs.

## Contexte produit

Confiture.live est une application mobile/tablette pour organisateurs de jam sessions.

L'application doit permettre de créer une jam, configurer les instruments, ajouter des participants, gérer les passages par instrument, créer des links/conflicts, gérer les holes, marquer les plateaux joués, remplacer un musicien introuvable, fonctionner local-first, puis synchroniser les actions au backend.

Le principe central : la source de vérité métier est une liste de transactions/events. La liste affichée est une projection déterministe de cet historique.

## Étape 1 — Lire les specs

Commence par lire tous les fichiers dans `docs/`, puis crée à la racine si absents :

- `AGENTS.md`
- `implementation-plan.md`
- `repo-structure.md`

Si ces fichiers existent déjà, lis-les et respecte-les.

Ordre de lecture prioritaire :

1. `docs/product-spec.md`
2. `docs/technical-stack.md`
3. `docs/confiture_event_actions_spec.md`
4. `docs/data_model.md`
5. `docs/event-payloads-reference.md`
6. `docs/projection-engine-spec.md`
7. `docs/sync_strategy.md`
8. `docs/backend-api-contract.md`
9. `docs/frontend-architecture.md`
10. `docs/visual_spec_table.md`
11. `docs/visual_spec_table_cards.md`
12. `docs/drawer-participant-spec.md`
13. `docs/drawer-call-spec.md`
14. `docs/ux-feedback-spec.md`
15. `docs/testing-strategy.md`
16. `docs/seed-demo-data.md`

## Règles non négociables

- Développer from scratch.
- Ne pas réintroduire les anciens modèles legacy.
- La source de vérité est l'eventLog.
- Une action UI produit une transaction contenant un ou plusieurs events.
- Le tableau affiché vient uniquement de la projection.
- Le moteur de projection doit être pur et testable sans React.
- Ne pas mettre de logique métier critique dans les composants React.
- Pas de drawer link.
- Pas de drawer conflict.
- Pas de notes participant/appearance.
- Pas de drag horizontal.
- Un seul client actif en édition par jam en V0.
- Local-first : chaque action est appliquée et persistée localement avant sync backend.
- L'undo est linéaire.
- Les tests moteur sont prioritaires.

## Stack à utiliser

Backend :

- Django
- Django REST Framework
- django-cors-headers
- PostgreSQL cible prod, SQLite acceptable en dev si nécessaire
- pytest + pytest-django

Frontend :

- React + Vite
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
- Vitest + React Testing Library

## Ordre de développement obligatoire

Suis `implementation-plan.md`.

Résumé :

1. Setup repo `backend/` + `frontend/`.
2. Backend Django minimal avec `Jam`, `JamTransaction`, `JamEvent`, `JamSnapshot`, `JamClientSession`.
3. API backend de sync selon `backend-api-contract.md`.
4. Event payload constants/validation.
5. Projection engine pur côté frontend.
6. Tests moteur Vitest.
7. Dexie/local-first/sync queue.
8. Pages liste jams + création jam.
9. Rendu tableau par colonnes.
10. Cards appearance/hole.
11. Drawer participant.
12. Mode link.
13. Mode conflict.
14. Drawer d'appel.
15. Feedback UX.
16. Seeds demo.
17. Polish responsive.

Ne commence pas par une UI sophistiquée avant d'avoir un moteur de projection testé.

## Livrables attendus

Crée une application fonctionnelle avec :

- backend Django démarrable ;
- frontend React démarrable ;
- migrations ;
- endpoints principaux ;
- moteur de projection pur ;
- tests moteur ;
- stockage local Dexie ;
- sync queue ;
- lease client actif ;
- tableau par colonnes ;
- cards appearance/hole ;
- drawer participant ;
- mode link ;
- mode conflict ;
- drawer d'appel ;
- feedback snackbar/dialog/animations ;
- seed demo command.

## Définition de terminé

À la fin, exécute ou prépare les commandes suivantes :

```bash
cd backend
python manage.py migrate
pytest
python manage.py seed_demo_jams --reset

cd frontend
npm install
npm run test
npm run build
```

Si une commande ne peut pas être exécutée dans l'environnement courant, explique précisément pourquoi et ce qui reste à faire.

## Gestion des ambiguïtés

Si une règle semble ambiguë :

1. cherche d'abord dans les specs ;
2. choisis l'option la plus simple, déterministe et testable ;
3. n'invente pas de nouvelle grosse logique ;
4. documente l'hypothèse dans `docs/implementation-notes.md` ;
5. continue le chantier sans bloquer.

## Démarrage concret

Commence maintenant par :

1. lister les fichiers docs présents ;
2. créer la structure repo cible ;
3. initialiser backend et frontend ;
4. implémenter d'abord les modèles backend event-sourcing et le moteur de projection pur ;
5. ajouter les tests moteur prioritaires avant les interactions UI complexes.
