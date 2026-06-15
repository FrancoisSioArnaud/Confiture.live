# Remaining work — V0 audit follow-up

## Appliqué dans le correctif P0/P1/P2

| Priorité | Tâche | Statut | Fichier(s) |
|---|---|---|---|
| P0 | Remplacer `window.confirm` dans le drawer d’appel | Fait : confirmation via `ConfirmDialog` | `frontend/src/features/table/components/JamTable.jsx` |
| P0 | Ajouter une validation backend payload plus stricte | Fait partiel robuste : champs requis + enums + targets pour les events V0 | `backend/jams/services/validation.py`, `backend/jams/tests/test_event_store_api.py` |
| P2 | Ajouter outil demo frontend local-only | Fait : import local du seed `complex` si `VITE_ENABLE_DEMO_TOOLS=true` | `frontend/src/features/demo/importDemoSeed.js`, `frontend/src/features/jams/pages/JamListPage.jsx` |
| P2 | Documenter/mesurer performance projection | Fait minimal : benchmark projection scriptable sur seed demo | `frontend/src/features/projection/benchmarkProjection.js` |

## Restant après correctif

| Priorité | Tâche restante | Fichier(s) concerné(s) | Raison | Proposition d’implémentation |
|---|---|---|---|---|
| P0 | Exécuter la validation complète dans un environnement avec dépendances installables | `backend/requirements.txt`, `frontend/package.json` | `pytest`, `npm test`, `npm run build` sont bloqués par dépendances absentes/403 dans l’environnement actuel | Lancer CI ou environnement local avec accès PyPI/npm, corriger toute erreur réelle |
| P1 | Compléter la validation backend par types plus profonds | `backend/jams/services/validation.py` | Le correctif valide champs requis/enums/targets mais pas tous les types primitifs/listes imbriquées | Ajouter validateurs par event avec types précis et tests négatifs dédiés |
| P1 | Renforcer projection remplacement drawer d’appel | `frontend/src/features/projection/applyEvent.js`, `frontend/src/features/table/utils/buildCallDrawerTransaction.js` | Les edge cases link/conflict/locked/played sont approximés | Déplacer plus de règles dans helpers purs/testables et ajouter tests pour remplaçant linké, conflict avec plateau, impossible move |
| P1 | Améliorer algorithme d’ordre | `frontend/src/features/projection/ordering.js` | `orderScore` numérique suffit en V0 courte mais peut dériver avec beaucoup d’insertions | Implémenter position keys fractionnaires stables et tests de non-renumérotation |
| P1 | Compléter tests sync offline/lease | `frontend/src/features/sync/*`, `backend/jams/services/sessions.py` | Les scénarios retry/takeover/réhydratation sont critiques pendant une jam | Ajouter tests unitaires et intégration avec API mockée pour offline, retry, takeover, expiration lease |
| P1 | Consolider seeds backend/frontend | `backend/jams/demo_seeds.py`, `frontend/src/features/demo/demoSeeds.js` | Duplication actuelle risque une divergence | Générer un JSON seed commun sous `docs/` ou `fixtures/`, consommé par Python et JS |
| P1 | Ajouter audit a11y et responsive automatisé | `frontend/src/**` | Les labels/focus existent, mais pas de validation automatisée | Ajouter tests Testing Library + axe ou Playwright mobile viewport |
| P2 | Ajouter e2e V0 de bout en bout | `frontend/`, `backend/` | Les flows UI critiques ne sont pas couverts en vrai navigateur | Playwright : créer jam, ajouter participants, link, conflict, call drawer, played, undo |
| P2 | Étendre l’outil demo frontend local-only | `frontend/src/features/demo/*`, `frontend/src/features/sync/localDb.js` | Le bouton importe seulement le seed complexe | Ajouter un sélecteur de seed et un reset local demo |
| P2 | Ajouter seuils de performance projection | `frontend/src/features/projection/*` | Le benchmark existe sans seuil CI | Ajouter test perf optionnel avec seuil indicatif hors environnement lent |
