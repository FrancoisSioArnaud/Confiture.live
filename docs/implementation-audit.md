# Audit final de conformité V0 — Confiture.live

Date d’audit : 2026-06-15

## Conforme

- **Event-sourcing** : le backend persiste `JamTransaction` et `JamEvent` comme source de vérité métier. Les modèles backend ne créent pas de tables métier `Participant`, `Participation`, `Appearance` ou `Hole` comme vérité durable.
- **Types d’events V0** : la liste autorisée frontend/backend couvre les events V0 documentés et exclut les events interdits (`play_without_created`, `play_without_removed`, `link_updated`, `conflict_updated`, notes, `temporarily_away`).
- **Payloads frontend** : les factories Zod produisent les payloads principaux attendus pour jam, instruments, participants, participations, appearances, holes, links, conflicts, played et undo.
- **Backend API/event store** : endpoints santé, jams, transactions, snapshots et client-session existent. La validation couvre `transactionId`, `clientId`, `schemaVersion`, types d’events autorisés, payload objet, idempotence et séquence client.
- **Client sessions/lease V0** : le backend impose un client actif par jam et expose acquire, heartbeat, release et takeover.
- **Snapshots** : le backend sait stocker/récupérer un snapshot latest. Les seeds `complex` et `sync` créent un snapshot de métadonnées, sans injecter d’état projeté.
- **Projection pure** : le moteur `frontend/src/features/projection/` est séparé de React, MUI, API, Dexie et DOM. Il prend transactions/events/snapshot et produit un état projeté.
- **Tests moteur** : une suite Vitest couvre création, rounds, links, conflicts, holes, locks, played, skipped, participant left, visibility, undo et seeds demo.
- **Sync local-first** : la couche Dexie/sync queue applique les transactions localement, les marque pending, les projette et tente la sync backend.
- **Routing** : routes `/`, `/jams/new`, `/jams/:jamId` en place.
- **Liste jams** : chargement, erreur, empty state, cards, bouton Ouvrir et suppression avec confirmation sont présents.
- **Création jam** : formulaire avec nom, date indicative, instruments par défaut et instrument custom.
- **Configuration jam** : modification nom/date, ajout/renommage/réordonnancement/masquage instruments, stratégie de link et confirmations de masquage existent.
- **Tableau** : colonnes instrument visibles, compteur, cards, holes, rounds visibles, ajout de trou/participant, scroll horizontal et absence de drag horizontal.
- **Cards** : appearance/hole affichent états played, locked, linked, boutons link/lock, menu trois-points et drag vertical.
- **Mode link** : déclenché par bouton link, sans drawer link, avec sélection par autres colonnes, création/suppression `link_created`/`link_removed` et refus conflict.
- **Mode conflict** : déclenché par menu, sans drawer conflict, avec scope appearance/participation et `conflict_created`/`conflict_removed`.
- **Holes et “Jouer sans…”** : holes linkables/lockables/played ; “Jouer sans…” produit `hole_added` + `link_created`, sans events dédiés interdits.
- **Plateau joué/unplayed** : `plateau_played` depuis rail/drawer ; `plateau_unplayed` limité au dernier plateau joué avec confirmation.
- **Undo linéaire** : bouton header, `transaction_reverted`, projection ignore la transaction annulée sans supprimer physiquement les events, warning sur undo non linéaire.
- **Feedback UX** : queue snackbar globale, confirmations partagées, indicateur sync discret/positif, focus visible et tailles tactiles.
- **Seeds demo** : seeds backend et frontend disponibles pour `simple`, `rounds`, `links`, `multi`, `complex`, `sync`.
- **Responsive mobile/tablette** : base mobile-first, drawers full screen mobile / larges tablette, colonnes scrollables horizontalement.

## Partiellement conforme

- **Projection engine** : couvre les règles majeures mais reste simplifié pour l’algorithme d’ordre (`orderScore` numérique), le ranking des remplaçants, le déplacement automatique conflict/link et certains warnings de cibles manquantes.
- **Drawer d’appel** : fonctionne pour appeler, marquer joué, introuvable, remplaçant et faire sans musicien. Le choix de confirmation de delink utilise maintenant le dialog central MUI ; les règles de remplacement restent simplifiées.
- **Drawer participant** : création/édition et validation de base existent, mais l’impact détaillé retrait instrument / links / locks / played demande davantage de cas de tests et de confirmations fines.
- **Drag vertical** : dnd-kit est intégré et refuse played/locked/conflict, mais le déplacement de groupe linké et le feedback impossible restent simplifiés.
- **Sync local-first** : queue et retry existent, mais les scénarios offline réels, conflits serveur, reprise de lease et réhydratation avancée restent peu testés.
- **Backend validation payload** : valide l’enveloppe, types et payload objet ; ne valide pas encore exhaustivement chaque schéma payload côté serveur.
- **Seeds demo** : conformes au format event-sourced, mais les définitions backend/frontend sont dupliquées et doivent être consolidées à terme.
- **Tests UI** : smoke tests présents, mais pas d’e2e mobile/tablette, ni tests a11y/visual regression.

## Non conforme

- **Projection de remplacement avancée** : les règles “remplaçant linké”, “déplacer target non-anchor”, “respect maximal conflicts/links” sont approximées, pas garanties dans tous les cas.
- **Validation backend payload complète** : le backend accepte tout payload objet pour un type autorisé ; la validation stricte de chaque payload V0 est absente.
- **Environnement de validation local** : les dépendances Python/Node ne sont pas installées dans l’environnement d’audit, empêchant `pytest`, `npm test` et `npm run build`.

## Reporté

- Auth organisateur, QR participant, multi-client temps réel et résolution de conflits multi-client : hors V0 selon specs.
- Projection serveur complète : hors scope, le serveur reste event store.
- E2E Playwright, tests perf projection, tests a11y automatisés : P2/P3.
- Algorithme d’ordre fractionnaire robuste remplaçant `orderScore` numérique.
- Outils demo frontend interactifs permettant d’importer les seeds dans IndexedDB sans backend.

## Risques techniques

- **Dette projection** : certaines règles métier complexes sont dans des helpers UI/transaction plutôt que totalement garanties par le moteur.
- **Divergence seeds** : duplication Python/JS possible entre seeds backend et tests frontend.
- **Dépendances non installables dans l’environnement actuel** : CI/local doit valider avec accès package index fonctionnel.
- **Transactions concurrentes** : V0 single-client limite le risque, mais la reprise/takeover et le retry offline demandent des tests de bout en bout.
- **Accessibilité réelle** : labels ARIA et focus visible existent, mais aucun audit automatique n’a été exécuté.

## Tests exécutés

- `pytest` : échec environnement, `ModuleNotFoundError: No module named 'django'` et `pytest-django` absent.
- `python -m pip install -r backend/requirements.txt` : échec environnement, tunnel package index `403 Forbidden` pour Django.
- `npm test` : échec environnement, `vitest: not found`.
- `npm run build` : échec environnement, `vite: not found`.
- `npm install` : échec environnement, registry `403 Forbidden` sur `@dnd-kit/core`.
- `node --check frontend/src/features/demo/demoSeeds.js` : passé.
- `node --check frontend/src/features/demo/demoSeeds.test.js` : passé.
- `node --check frontend/src/features/demo/importDemoSeed.js` : passé.
- `node --check frontend/src/features/projection/benchmarkProjection.js` : passé.
- `python -m py_compile backend/jams/demo_seeds.py backend/jams/management/commands/seed_demo_jams.py backend/jams/tests/test_seed_demo_jams.py` : passé.
- `python -m py_compile backend/jams/services/validation.py backend/jams/tests/test_event_store_api.py` : passé.
- `git diff --check` : passé.

## Recommandations

1. Installer les dépendances dans un environnement réseau fonctionnel et exécuter `pytest`, `npm test`, `npm run build` avant toute release V0.
2. Compléter la validation backend payload par types primitifs/listes imbriquées, idéalement depuis une source commune.
3. Renforcer les règles de remplacement du drawer d’appel dans des helpers purs et testés.
4. Renforcer les tests projection sur remplacement, conflicts/link edge cases et offline sync.
5. Factoriser les seeds demo pour éviter la duplication Python/JS.
6. Ajouter un run e2e mobile/tablette minimal dès que le build frontend est exécutable.
