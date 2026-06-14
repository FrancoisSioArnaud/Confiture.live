# repo-structure.md — Arborescence cible du repo

## 1. Objectif

Ce fichier définit l'organisation attendue du repo Confiture.live développé from scratch.

Codex doit respecter cette structure sauf raison technique forte. Le but est d'éviter la dispersion des fichiers, de garder le moteur métier testable, et de séparer clairement backend, frontend et docs.

---

## 2. Structure racine

```text
.
├── AGENTS.md
├── README.md
├── implementation-plan.md
├── repo-structure.md
├── .gitignore
├── docs/
├── backend/
└── frontend/
```

### Racine

- `AGENTS.md` : instructions globales Codex.
- `implementation-plan.md` : ordre de développement.
- `repo-structure.md` : ce fichier.
- `README.md` : démarrage rapide humain.
- `docs/` : specs produit/techniques.
- `backend/` : Django/DRF.
- `frontend/` : React/Vite.

---

## 3. Dossier `docs/`

```text
docs/
├── product-spec.md
├── technical-stack.md
├── confiture_event_actions_spec.md
├── data_model.md
├── event-payloads-reference.md
├── projection-engine-spec.md
├── sync_strategy.md
├── backend-api-contract.md
├── frontend-architecture.md
├── visual_spec_table.md
├── visual_spec_table_cards.md
├── drawer-participant-spec.md
├── drawer-call-spec.md
├── ux-feedback-spec.md
├── testing-strategy.md
└── seed-demo-data.md
```

Les docs sont la référence fonctionnelle et technique.
Ne pas déplacer ces fichiers sans mettre à jour `AGENTS.md`.

---

## 4. Backend cible

```text
backend/
├── manage.py
├── pyproject.toml ou requirements.txt
├── .env.example
├── config/
│   ├── __init__.py
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── jams/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   ├── views.py
│   ├── migrations/
│   │   └── __init__.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── transactions.py
│   │   ├── events.py
│   │   ├── snapshots.py
│   │   ├── sessions.py
│   │   └── validation.py
│   ├── management/
│   │   ├── __init__.py
│   │   └── commands/
│   │       ├── __init__.py
│   │       └── seed_demo_jams.py
│   └── tests/
│       ├── __init__.py
│       ├── test_models.py
│       ├── test_transactions_api.py
│       ├── test_sessions_api.py
│       └── test_snapshots_api.py
└── pytest.ini
```

---

## 5. Backend — responsabilités des fichiers

### `jams/models.py`

Contient uniquement les modèles persistés :

- `Jam`
- `JamTransaction`
- `JamEvent`
- `JamSnapshot`
- `JamClientSession`

Ne pas créer en V0 de tables métier projetées comme source de vérité :

- pas de `Participant` SQL source de vérité ;
- pas de `Participation` SQL source de vérité ;
- pas de `Appearance` SQL source de vérité ;
- pas de `LinkGroup` legacy ;
- pas de `PlayedPassage` legacy.

Ces éléments vivent dans les events et la projection.

### `jams/services/transactions.py`

Responsable de :

- recevoir une transaction ;
- vérifier idempotence ;
- vérifier séquence ;
- vérifier lease active ;
- créer `JamTransaction` ;
- créer `JamEvent` associés.

### `jams/services/events.py`

Responsable de :

- constantes de types d'events ;
- validation légère de payload ;
- helpers de normalisation.

### `jams/services/snapshots.py`

Responsable de :

- enregistrer snapshot client ;
- récupérer dernier snapshot ;
- vérifier `lastServerSequenceNumber`.

### `jams/services/sessions.py`

Responsable de :

- lease client actif ;
- heartbeat ;
- expiration ;
- reprise de contrôle.

### `jams/services/validation.py`

Responsable de la validation légère backend :

- type autorisé ;
- payload objet ;
- schemaVersion ;
- transactionId ;
- séquence.

Le backend V0 ne recalcule pas toute la projection métier.

---

## 6. Frontend cible

```text
frontend/
├── package.json
├── vite.config.js
├── index.html
├── .env.example
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── app/
│   │   ├── router.jsx
│   │   ├── queryClient.js
│   │   └── theme.js
│   ├── shared/
│   │   ├── api/
│   │   │   ├── httpClient.js
│   │   │   └── jamsApi.js
│   │   ├── components/
│   │   │   ├── AppShell.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── FeedbackSnackbar.jsx
│   │   │   └── SyncStatusIndicator.jsx
│   │   ├── constants/
│   │   │   ├── eventTypes.js
│   │   │   └── ids.js
│   │   └── utils/
│   │       ├── createId.js
│   │       └── dateFormat.js
│   ├── features/
│   │   ├── projection/
│   │   ├── sync/
│   │   ├── jams/
│   │   ├── table/
│   │   ├── cards/
│   │   ├── participantDrawer/
│   │   ├── callDrawer/
│   │   └── jamConfig/
│   └── tests/
│       ├── setupTests.js
│       └── fixtures/
└── vitest.config.js
```

---

## 7. Frontend — `features/projection/`

```text
frontend/src/features/projection/
├── index.js
├── projectJamState.js
├── applyTransaction.js
├── applyEvent.js
├── initialState.js
├── selectors.js
├── rounds.js
├── ordering.js
├── links.js
├── conflicts.js
├── locks.js
├── holes.js
├── played.js
├── undo.js
├── warnings.js
└── __tests__/
    ├── projectJamState.test.js
    ├── rounds.test.js
    ├── links.test.js
    ├── conflicts.test.js
    ├── holes.test.js
    ├── skipped.test.js
    └── undo.test.js
```

### Règles

- Ce dossier ne dépend pas de React.
- Ce dossier ne dépend pas de MUI.
- Ce dossier ne dépend pas de Dexie.
- Ce dossier ne fait aucun fetch.
- Les tests moteur sont prioritaires.

---

## 8. Frontend — `features/sync/`

```text
frontend/src/features/sync/
├── localDb.js
├── syncQueue.js
├── syncStateStore.js
├── useJamSync.js
├── useClientSession.js
├── snapshotLocal.js
└── __tests__/
    ├── syncQueue.test.js
    └── localDb.test.js
```

### Responsabilités

- IndexedDB/Dexie.
- Transactions pending.
- Retry.
- Snapshot local.
- Sync status.
- Lease client actif.

---

## 9. Frontend — `features/jams/`

```text
frontend/src/features/jams/
├── JamListPage.jsx
├── JamListCard.jsx
├── CreateJamPage.jsx
├── JamPage.jsx
├── useJams.js
└── useJamLoader.js
```

Responsable des pages de haut niveau.

---

## 10. Frontend — `features/table/`

```text
frontend/src/features/table/
├── JamTable.jsx
├── InstrumentColumn.jsx
├── PlateauActionsColumn.jsx
├── RoundRevealButton.jsx
├── InsertBetweenCardsZone.jsx
├── LinkModeOverlay.jsx
├── ConflictModeOverlay.jsx
├── tableStore.js
├── useTableActions.js
└── animations.js
```

Responsable du rendu du tableau et des modes tableau.

Ne pas mettre les règles métier dans ces composants. Ils dispatchent des actions UI qui créent des transactions/events.

---

## 11. Frontend — `features/cards/`

```text
frontend/src/features/cards/
├── AppearanceCard.jsx
├── HoleCard.jsx
├── CardActionsMenu.jsx
├── LinkIconButton.jsx
├── LockIconButton.jsx
├── DragHandle.jsx
└── cardStyles.js
```

Responsable des cards appearance/hole.

Le menu ne doit pas contenir d'action link.
Le link passe par `LinkIconButton`.

---

## 12. Frontend — `features/participantDrawer/`

```text
frontend/src/features/participantDrawer/
├── ParticipantDrawer.jsx
├── ParticipantForm.jsx
├── InstrumentSelector.jsx
├── OtherInstrumentField.jsx
├── participantFormSchema.js
└── useParticipantSubmit.js
```

Responsable de :

- créer participant ;
- éditer nom ;
- ajouter/retirer instruments ;
- créer participations et conflicts automatiques.

---

## 13. Frontend — `features/callDrawer/`

```text
frontend/src/features/callDrawer/
├── CallDrawer.jsx
├── CallDrawerInstrumentRow.jsx
├── ReplacementChoices.jsx
├── useReplacementSuggestions.js
└── useCallDrawerActions.js
```

Responsable de :

- afficher plateau appelé ;
- marquer plateau joué ;
- musicien introuvable ;
- proposer 3 remplaçants ;
- faire sans musicien ;
- appearance_skipped.

---

## 14. Frontend — `features/jamConfig/`

```text
frontend/src/features/jamConfig/
├── JamConfigDialog.jsx
├── InstrumentConfigList.jsx
├── LinkReorderStrategyField.jsx
├── InstrumentVisibilityDialog.jsx
└── jamConfigSchema.js
```

Responsable de la configuration jam :

- nom ;
- date ;
- instruments ;
- ordre instruments ;
- visibilité ;
- stratégie de réorganisation des links.

---

## 15. Conventions de nommage

### IDs métier

Utiliser des IDs préfixés :

```text
jam_...
transaction_...
event_...
instrument_...
participant_...
participation_...
appearance_...
hole_...
link_...
conflict_...
snapshot_...
client_...
```

### Events

Utiliser les noms exacts définis dans `docs/event-payloads-reference.md`.

Ne pas inventer de synonymes.

### Fichiers React

- Components en `PascalCase.jsx`.
- Hooks en `useSomething.js`.
- Stores en `somethingStore.js`.
- Helpers purs en `camelCase.js`.

---

## 16. Tests

### Frontend

Les tests du moteur restent près du moteur :

```text
frontend/src/features/projection/__tests__/
```

Les tests UI restent près des features :

```text
frontend/src/features/table/__tests__/
frontend/src/features/participantDrawer/__tests__/
frontend/src/features/callDrawer/__tests__/
```

### Backend

Les tests backend restent dans :

```text
backend/jams/tests/
```

---

## 17. Fichiers à éviter

Éviter :

- gros `utils.js` global ;
- gros composant `JamPage.jsx` contenant toute la logique ;
- logique projection dans Zustand ;
- logique métier dans les composants MUI ;
- duplication des types d'events dans plusieurs fichiers non synchronisés ;
- anciens modèles legacy en base.

---

## 18. Documentation générée par le code

Si une décision technique est prise pendant le développement et n'est pas dans les specs, l'ajouter dans un fichier court :

```text
docs/implementation-notes.md
```

Ne pas modifier les specs métier pour justifier une implémentation contraire.

---

## 19. Build attendu à terme

Commandes finales attendues :

```bash
cd backend
pytest
python manage.py migrate
python manage.py seed_demo_jams --reset
python manage.py runserver

cd frontend
npm install
npm run test
npm run build
npm run dev
```

Ces commandes seront détaillées plus tard dans un éventuel `commands-and-env.md`.
