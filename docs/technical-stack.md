# Confiture.live — Technical Stack V0

## Objectif du fichier

Ce fichier définit la stack technique à utiliser pour redévelopper Confiture.live from scratch.

Il doit guider Codex sur :

- les technologies à utiliser ;
- l’architecture frontend/backend ;
- la séparation entre eventLog, projection et UI ;
- la stratégie local-first ;
- les conventions de code ;
- les tests prioritaires.

Ce fichier complète :

```text
product-spec.md
confiture_event_actions_spec.md
sync_strategy.md
data_model.md
visual_spec_table.md
visual_spec_table_cards.md
```

---

## Décision stack globale

```text
Backend
- Python
- Django
- Django REST Framework
- PostgreSQL cible production
- SQLite autorisé uniquement en dev local si nécessaire
- django-cors-headers
- Django admin
- Gunicorn
- pytest + pytest-django

Frontend
- JavaScript uniquement, pas TypeScript
- React
- Vite
- MUI
- React Router
- TanStack Query
- Zustand
- Dexie.js / IndexedDB
- dnd-kit
- React Hook Form
- Zod
- date-fns
- Vitest
- React Testing Library

Infra
- Ubuntu VPS
- Nginx
- Gunicorn
- PostgreSQL en production cible
- build React statique servi par Nginx
```

---

## Principe technique principal

Le cœur de l’application n’est pas une collection de tables métier modifiées directement.

Le cœur est :

```text
JamTransaction[] + JamEvent[] + JamSnapshot? → Projection déterministe
```

Conséquence :

- le frontend génère des events ;
- le frontend applique les events localement ;
- le backend stocke les events ;
- la projection est recalculable ;
- les tables backend métier détaillées ne sont pas la source de vérité ;
- les snapshots sont des optimisations.

---

## Backend

### Django

Django sert à :

- exposer l’API REST ;
- stocker les jams ;
- stocker les transactions ;
- stocker les events ;
- stocker les snapshots ;
- gérer la session active unique par jam ;
- fournir Django admin pour inspection/debug ;
- préparer l’authentification organisateur V1.

### Django REST Framework

DRF expose les endpoints du frontend.

Endpoints V0 recommandés :

```text
GET    /api/jams/
POST   /api/jams/
GET    /api/jams/:jamId/
PATCH  /api/jams/:jamId/
DELETE /api/jams/:jamId/

POST   /api/jams/:jamId/session/acquire/
POST   /api/jams/:jamId/session/heartbeat/
POST   /api/jams/:jamId/session/release/
POST   /api/jams/:jamId/session/take-over/

GET    /api/jams/:jamId/events/
POST   /api/jams/:jamId/transactions/
POST   /api/jams/:jamId/snapshot/
GET    /api/jams/:jamId/full-state/
```

`full-state` doit pouvoir renvoyer :

```text
jam metadata
transactions
events
latest snapshot
server sequence info
active session info if useful
```

### PostgreSQL

PostgreSQL est la cible production.

Raisons :

- fiabilité ;
- JSONB utile pour payload d’events ;
- séquences serveur ;
- requêtes admin/debug ;
- évolution future vers comptes organisateurs ;
- meilleure base pour une app durable.

SQLite peut rester autorisé en dev local si cela simplifie le lancement, mais Codex ne doit pas concevoir le modèle autour de SQLite.

### Modèles backend V0

Le modèle détaillé est dans `data_model.md`.

Tables principales :

```text
Jam
JamTransaction
JamEvent
JamSnapshot
JamClientSession
```

Ne pas créer en V0 des tables backend source de vérité comme :

```text
Participant
Participation
Appearance
Hole
Link
Conflict
PlayedPassage
```

Ces entités existent dans la projection, pas comme vérité principale.

Exception possible : si Codex ajoute plus tard des tables d’index/cache, elles doivent être explicitement documentées comme projection/cache, jamais comme source de vérité.

### Django admin

L’admin doit permettre d’inspecter :

- jams ;
- transactions ;
- events ;
- snapshots ;
- sessions actives ;
- séquences serveur ;
- erreurs ou warnings de sync.

L’admin n’est pas l’interface produit.

---

## Frontend

### React + Vite

React est la base du frontend.

Vite est recommandé pour :

- simplicité ;
- rapidité de dev ;
- build statique simple ;
- intégration facile avec Nginx.

Code frontend en JavaScript uniquement.

Ne pas introduire TypeScript sauf décision explicite future.

### MUI

MUI doit être utilisé au maximum pour :

- AppBar ;
- Drawer ;
- Dialog ;
- Snackbar ;
- IconButton ;
- Menu ;
- Button ;
- TextField ;
- Checkbox ;
- Chip ;
- Tabs si utile ;
- responsive helpers ;
- thème global.

CSS custom autorisé uniquement pour :

- tableau ;
- cards ;
- animations de déplacement ;
- layout horizontal/vertical spécifique ;
- états visuels link/conflict/lock/played.

### Design system

Codex doit centraliser le design dans un dossier dédié, par exemple :

```text
frontend/src/shared/theme/
frontend/src/shared/design/
```

Objectif :

- couleurs centralisées ;
- espacements centralisés ;
- tailles de cards ;
- rayons/borders/shadows ;
- z-index ;
- durées d’animation ;
- variantes d’état.

Ne pas disperser les valeurs de design dans les composants.

---

## Routing frontend

Routes recommandées :

```text
/
  Liste des jams

/jams/new
  Création de jam

/jams/:jamId
  Tableau de jam

/jams/:jamId/settings
  Configuration de jam si page dédiée, sinon modale depuis le tableau
```

Le drawer participant, le drawer d’appel, le mode link et le mode conflict ne nécessitent pas forcément des routes dédiées.

Ils peuvent être gérés par Zustand/UI state.

---

## TanStack Query

TanStack Query sert à :

- charger les jams ;
- charger l’eventLog/snapshot depuis le backend ;
- créer une jam ;
- mettre à jour les métadonnées ;
- pousser des transactions ;
- envoyer des snapshots ;
- gérer retry/backoff API ;
- invalider/recharger après reprise de session.

Important : TanStack Query ne doit pas être la source de vérité du tableau live.

Le tableau live dépend de :

```text
IndexedDB + Zustand + moteur de projection
```

---

## Zustand

Zustand sert à l’état d’interface et à l’état live en mémoire.

Stores recommandés :

```text
jamRuntimeStore
  jam courante
  eventLog chargé
  snapshot courant
  projection courante
  activeTransaction draft

uiStore
  drawer participant ouvert
  drawer appel ouvert
  mode link
  mode conflict
  selected anchor
  selected targets
  snackbar queue
  dialog courant
  drag state

syncStore
  sync status
  pending count
  last successful sync
  active client session
```

Zustand ne doit pas persister seul les données critiques.

Les données critiques doivent être persistées dans IndexedDB via Dexie.

---

## Dexie.js / IndexedDB

Dexie est obligatoire pour le local-first.

Object stores recommandés :

```text
jams
transactions
events
snapshots
syncState
clientSessions
outbox
```

Règles :

- chaque transaction est écrite localement avant sync backend ;
- chaque event est écrit localement ;
- le snapshot local est mis à jour régulièrement ;
- l’outbox contient les transactions non confirmées serveur ;
- la jam doit rester utilisable si le réseau tombe.

Le détail est dans `sync_strategy.md` et `data_model.md`.

---

## Moteur de projection

Le moteur de projection est le module le plus important du projet.

Il doit être :

- pur ;
- indépendant de React ;
- sans effets de bord ;
- testé intensivement ;
- déterministe ;
- capable de repartir d’un snapshot puis rejouer les events suivants.

Signature conceptuelle :

```js
projectJamState({ snapshot, events, options }) => projection
```

Le moteur doit gérer :

- participants ;
- participations ;
- appearances calculées/matérialisées ;
- rounds visibles ;
- holes ;
- links ;
- conflicts ;
- locks ;
- played ;
- appearance_skipped ;
- instrument visibility ;
- undo linéaire ;
- warnings internes de projection.

Le moteur ne doit pas dépendre de MUI, DOM, React, Zustand ou Dexie.

Dossier recommandé :

```text
frontend/src/features/jam-engine/
```

Sous-modules possibles :

```text
events/
projection/
ordering/
links/
conflicts/
rounds/
undo/
validation/
fixtures/
```

---

## dnd-kit

dnd-kit est utilisé pour le drag vertical.

Règles :

- jamais de drag horizontal ;
- drag uniquement dans une colonne ;
- desktop : handle visible recommandé ;
- mobile/tablette : long press ou handle selon spec visuelle ;
- card played : non draggable ;
- card locked : non draggable ;
- hole played/locked : non draggable ;
- card linkée : déplacer le groupe si autorisé ;
- toute action impossible doit être refusée proprement avec snackbar.

Le résultat du drag doit produire un event, jamais modifier directement la projection comme vérité durable.

---

## Animations

Les déplacements de cards doivent être animés.

Objectif produit : éviter les téléportations incompréhensibles.

Règles :

- déplacement après link : animation visible ;
- déplacement après conflict : animation visible ;
- remplacement dans drawer d’appel : animation visible ;
- ajout/suppression card : apparition/disparition animée ;
- durée recommandée : 800 à 1000 ms pour les déplacements significatifs ;
- les animations ne doivent pas bloquer la persistance eventLog.

Codex peut utiliser les capacités de dnd-kit, CSS transitions et/ou FLIP animation.

Ne pas ajouter de grosse librairie d’animation sans besoin.

---

## Formulaires

### React Hook Form

À utiliser pour :

- création jam ;
- configuration jam ;
- drawer participant ;
- ajout instrument personnalisé ;
- choix instruments participant ;
- confirmations avec champs si nécessaire.

### Zod

À utiliser pour :

- validation frontend ;
- validation schéma event côté client ;
- helpers partagés de validation payload.

Validations importantes :

- nom de jam requis ;
- nom participant requis ;
- nom participant unique dans la projection ;
- au moins un instrument pour un participant ;
- nom instrument custom requis ;
- stratégie link valide ;
- event payload conforme ;
- impossible de supprimer une appearance/hole joué ;
- impossible de déplacer locked/played.

---

## API client frontend

Dossier recommandé :

```text
frontend/src/shared/api/
```

Modules :

```text
httpClient.js
jamsApi.js
sessionsApi.js
transactionsApi.js
snapshotsApi.js
```

`httpClient.js` doit centraliser :

- base URL ;
- headers ;
- parsing JSON ;
- erreurs API ;
- gestion des codes `409`, `423`, `422`, etc.

---

## Sync frontend

Dossier recommandé :

```text
frontend/src/features/sync/
```

Modules possibles :

```text
localDb.js
outbox.js
syncQueue.js
syncStatus.js
clientSession.js
snapshotWriter.js
```

Règles :

- push par transaction ;
- debounce court autorisé ;
- retry régulier ;
- feedback sync discret ;
- état offline positif ;
- pas de snackbar à chaque succès ;
- en cas de désync serveur, recharger plutôt que merger ;
- un seul client actif.

---

## Structure frontend recommandée

```text
frontend/src/
  app/
    App.jsx
    router.jsx
    providers.jsx

  shared/
    api/
    theme/
    design/
    components/
    utils/

  features/
    jams/
      pages/
      components/
      forms/

    jam-engine/
      events/
      projection/
      ordering/
      links/
      conflicts/
      rounds/
      undo/
      validation/
      fixtures/

    jam-table/
      components/
      cards/
      modes/
      drawer-call/
      drawer-participant/
      hooks/

    sync/
      localDb.js
      outbox.js
      syncQueue.js
      syncStatus.js
      clientSession.js
```

---

## Structure backend recommandée

```text
backend/
  config/
    settings.py
    urls.py

  jams/
    models.py
    serializers.py
    views.py
    urls.py
    services/
      transaction_service.py
      sequence_service.py
      snapshot_service.py
      session_service.py
      validation_service.py
    tests/
```

Le backend ne doit pas contenir toute la logique de projection V0.

Il doit surtout :

- valider les séquences ;
- valider les schémas ;
- stocker les transactions/events ;
- stocker les snapshots ;
- gérer la session active.

---

## Tests frontend prioritaires

Le moteur de projection doit être testé avant les composants visuels.

Tests prioritaires :

```text
jam_created / jam_updated
instrument_added / instrument_updated / instrument_visibility_changed
participant_created / participant_updated / participant_removed / participant_presence_changed
participation_added / participation_removed
appearance_materialized / appearance_removed / appearance_moved_between
appearance_locked / appearance_unlocked / appearance_skipped
hole_added / hole_removed / hole_moved_between / hole_locked
link_created / link_removed avec stratégies move_to_first, move_to_last, average_position
conflict_created / conflict_removed scopes participation et appearance
instrument_round_visibility_changed
plateau_played / plateau_unplayed
transaction_reverted undo linéaire
projection depuis snapshot + events
warnings de projection
```

Tests UI prioritaires :

```text
mode link
mode conflict
drawer participant
drawer appel avec remplaçants
ajout entre cards
suppression appearance/hole avec confirmation
sync indicator
animations de déplacement non cassantes
```

---

## Tests backend prioritaires

```text
création jam
liste jams
delete jam avec confirmation côté front
acquire session
heartbeat session
expiration session
take-over session
push transaction valide
push transaction duplicée idempotente
push avec sequence mismatch refusé
push depuis client inactif refusé
snapshot upload
full-state download
validation payload minimale
admin lisible
```

---

## Déploiement

Cible simple :

```text
Ubuntu VPS
Nginx
Gunicorn
Django/DRF
PostgreSQL
React build statique
```

Nginx :

- sert le build React ;
- proxy `/api/` vers Gunicorn ;
- gère HTTPS ;
- redirections domaine si nécessaire.

---

## Librairies à installer

### Backend

```bash
pip install django djangorestframework django-cors-headers psycopg[binary] gunicorn pytest pytest-django
```

### Frontend

```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install react-router-dom @tanstack/react-query zustand dexie @dnd-kit/core @dnd-kit/sortable
npm install react-hook-form zod @hookform/resolvers date-fns
npm install -D vite vitest @testing-library/react @testing-library/jest-dom
```

---

## Règles non négociables pour Codex

- JavaScript uniquement côté frontend.
- Utiliser MUI autant que possible.
- Ne pas recréer l’ancien modèle `ParticipantEntry/LinkGroup/PlayedPassage` comme source de vérité.
- Ne pas stocker la projection comme vérité principale.
- Ne pas implémenter de notes.
- Ne pas implémenter drawer link ou drawer conflict.
- Ne pas implémenter QR code participant en V0.
- Ne pas introduire de multi-client temps réel.
- Toute action organisateur doit produire une transaction/event.
- Toute logique d’ordre doit passer par le moteur de projection.
- Toute logique critique doit avoir des tests unitaires.
