# Prompt Codex — supprimer les client sessions en V0

Tu travailles sur le repo Confiture.live.

Objectif : supprimer totalement les client sessions de la V0, tout en conservant la sync locale/offline.

Base-toi sur les docs mises à jour :

- `docs/v0-sync-no-client-sessions.md`
- `docs/sync_strategy.md`
- `docs/backend-api-contract.md`
- `docs/data_model.md`
- `docs/frontend-architecture.md`
- `docs/technical-stack.md`
- `docs/testing-strategy.md`

Important : le projet n'est pas en production. La base de données V0 peut être considérée vide. Il n'est pas nécessaire de garder du code legacy pour supporter les anciennes client sessions ou anciens payloads avec `leaseToken`.

---

## 1. Comportement cible

En V0 :

- plus de `leaseToken` ;
- plus de client session ;
- plus de heartbeat ;
- plus de takeover ;
- plus de mode lecture seule parce qu'un autre device édite ;
- plus de table/modèle `JamClientSession` ;
- plus d'endpoints `/client-session/*` ;
- le backend accepte toutes les transactions structurellement valides ;
- plusieurs `clientId` peuvent pousser des transactions sur la même jam ;
- l'ordre final est l'ordre d'acceptation serveur via `serverSequenceNumber` ;
- `clientId` reste stocké comme métadonnée d'audit ;
- `clientSequenceNumber` reste stocké comme métadonnée, mais ne bloque pas ;
- `baseServerSequenceNumber` peut rester dans le payload, mais ne bloque pas ;
- la sync locale/offline reste active.

---

## 2. Backend — modèles et migrations

Fichiers concernés :

- `backend/jams/models.py`
- `backend/jams/admin.py`
- `backend/jams/serializers.py`
- `backend/jams/services/sessions.py`
- `backend/jams/services/transactions.py`
- `backend/jams/views.py`
- `backend/jams/tests/test_event_store_api.py`
- migrations `backend/jams/migrations/*`

À faire :

1. Supprimer le modèle `JamClientSession` de `models.py`.
2. Supprimer `generate_session_id` si plus utilisé.
3. Supprimer le service `backend/jams/services/sessions.py` ou le laisser totalement inutilisé uniquement si suppression physique compliquée. Préférence : supprimer le fichier.
4. Supprimer les imports liés aux sessions dans `views.py`.
5. Supprimer `JamClientSessionSerializer` de `serializers.py` s'il existe.
6. Supprimer l'enregistrement admin de `JamClientSession` dans `admin.py`.
7. Ajouter une migration de suppression du modèle/table `JamClientSession`.
8. Supprimer la contrainte unique `(jam, client_id, client_sequence_number)` sur `JamTransaction`.
   - `clientSequenceNumber` devient metadata only.
   - Garder `transaction_id` unique.
9. Ajouter une migration qui retire cette contrainte.

Comme la base est considérée vide/non-prod, ne pas écrire de migration de conservation ou conversion de données legacy.

---

## 3. Backend — transactions

Fichier principal :

- `backend/jams/services/transactions.py`

À faire :

1. Supprimer l'import :

```py
from .sessions import assert_active_lease
```

2. Simplifier la signature :

```py
def accept_transaction(jam, client_id, transaction_payload):
```

3. Supprimer les paramètres `lease_token` et `require_lease`.
4. Supprimer l'appel :

```py
assert_active_lease(jam, client_id, lease_token)
```

5. Supprimer la validation stricte de `expected_client_sequence`.
6. Supprimer ou ne plus utiliser `expected_client_sequence` et `ClientSequenceConflict` si plus nécessaires.
7. Garder la validation structurelle :
   - transactionId ;
   - jamId ;
   - clientId ;
   - schemaVersion ;
   - events ;
   - eventId unique ;
   - type d'event autorisé.
8. Garder l'idempotence : si une transaction avec le même `transactionId` existe déjà pour la même jam, répondre `already_accepted`.
9. Garder le refus si le même `transactionId` existe déjà pour une autre jam.
10. Garder l'assignation de `serverSequenceNumber` sous transaction SQL atomique.

Le backend ne doit plus jamais produire :

```txt
No active client session for this jam
Invalid lease token
Lease token is required
client_sequence_conflict
```

---

## 4. Backend — views/endpoints

Fichier :

- `backend/jams/views.py`

À faire :

1. Supprimer `_lease_token`.
2. Supprimer `_session_response`.
3. Supprimer les imports :

```py
HEARTBEAT_INTERVAL_SECONDS
assert_active_lease
create_or_renew_session
release_session
renew_session
```

4. Dans `create()`, remplacer :

```py
accept_transaction(jam, client_id, transaction_payload, require_lease=False)
```

par :

```py
accept_transaction(jam, client_id, transaction_payload)
```

5. Dans `transactions()` POST :
   - ne plus lire `_lease_token(request)` ;
   - ne plus refuser si `baseServerSequenceNumber != jam.latest_server_sequence_number` ;
   - conserver `baseServerSequenceNumber` uniquement comme debug si besoin, mais ne pas bloquer ;
   - appeler `accept_transaction(jam, _client_id(request), transaction_payload)`.

6. Dans `snapshots()` :
   - supprimer `assert_active_lease` ;
   - accepter le snapshot avec `clientId` uniquement.

7. Supprimer complètement ces actions DRF :

```py
acquire_client_session
heartbeat_client_session
release_client_session
takeover_client_session
```

8. Vérifier que les routes suivantes n'existent plus :

```txt
POST /api/jams/:jamId/client-session/acquire/
POST /api/jams/:jamId/client-session/heartbeat/
POST /api/jams/:jamId/client-session/release/
POST /api/jams/:jamId/client-session/takeover/
```

---

## 5. Frontend — API client

Fichier :

- `frontend/src/shared/api/jamsApi.js`

À faire :

1. Modifier `pushTransaction`.

Avant :

```js
export const pushTransaction = (jamId, { clientId, leaseToken, baseServerSequenceNumber, transaction }) =>
  post(`/jams/${jamId}/transactions/`, { clientId, leaseToken, baseServerSequenceNumber, transaction });
```

Après :

```js
export const pushTransaction = (jamId, { clientId, baseServerSequenceNumber, transaction }) =>
  post(`/jams/${jamId}/transactions/`, { clientId, baseServerSequenceNumber, transaction });
```

2. Modifier `postSnapshot` pour supprimer `leaseToken`.
3. Supprimer les exports :

```js
acquireClientSession
heartbeatClientSession
releaseClientSession
takeoverClientSession
```

---

## 6. Frontend — IndexedDB/localDb

Fichier :

- `frontend/src/features/sync/localDb.js`

À faire :

1. Supprimer la table Dexie `clientSessions`.
2. Supprimer `clientSessions` de l'objet mémoire.
3. Supprimer les fonctions :

```js
saveClientSession
getClientSession
clearClientSession
```

4. Bumper la version Dexie si nécessaire.

Comme le projet n'est pas en prod, il n'y a pas besoin de migration complexe de données locales. Si Dexie demande une suppression explicite de table, utiliser une version suivante avec `clientSessions: null`.

---

## 7. Frontend — supprimer clientSession.js

Fichier :

- `frontend/src/features/sync/clientSession.js`
- `frontend/src/features/sync/clientSession.test.js`

À faire :

1. Supprimer le fichier `clientSession.js`.
2. Supprimer le test associé.
3. Supprimer tous les imports vers ce fichier.

---

## 8. Frontend — jamStore

Fichier :

- `frontend/src/features/jam/jamStore.js`

À faire :

1. Supprimer l'import :

```js
import { acquireLease, heartbeatLease, releaseLease, takeoverLease } from '../sync/clientSession';
```

2. Supprimer les actions store :

```js
acquireSession
heartbeatSession
releaseSession
takeoverSession
```

3. Garder le reste du store : hydratation, projection, transactions locales.

---

## 9. Frontend — syncQueue

Fichier :

- `frontend/src/features/sync/syncQueue.js`

À faire :

1. Supprimer les imports :

```js
getClientSession
saveClientSession
```

2. Supprimer :

```js
isLeaseError
isSessionExpired
getPushableSession
```

3. Dans `pushPendingTransactions`, ne plus acquérir de session.
4. Envoyer directement :

```js
const ack = await api.pushTransaction(jamId, {
  clientId: transaction.clientId,
  baseServerSequenceNumber: syncState.lastServerSequenceNumber ?? 0,
  transaction,
});
```

5. Supprimer le cas d'erreur `LEASE_LOST`.
6. Supprimer le cas `SESSION_REQUIRED`.
7. Garder :
   - offline ;
   - pending ;
   - retry réseau ;
   - synced ;
   - erreurs structurelles.

Important : comme le backend n'utilise plus `baseServerSequenceNumber` pour bloquer, l'ancien cas `sequence_conflict` ne devrait plus arriver pour ce motif. Tu peux garder un fallback 409 générique si un autre endpoint le renvoie, mais ne construis plus la logique autour de ça.

---

## 10. Frontend — syncStatus

Fichier :

- `frontend/src/features/sync/syncStatus.js`
- `frontend/src/shared/components/SyncStatusIndicator.jsx`

À faire :

1. Supprimer les statuts :

```js
SESSION_REQUIRED
LEASE_LOST
```

2. Supprimer les libellés UI liés :

```txt
Session d'édition requise
Session d'édition perdue
Reprendre le contrôle
```

3. Garder :

```txt
LOCAL_ONLY
PENDING
SYNCING
SYNCED
OFFLINE
RETRYING
ERROR
```

---

## 11. Frontend — JamDetailPage

Fichier :

- `frontend/src/features/jams/pages/JamDetailPage.jsx`

À faire :

1. Supprimer le state :

```js
sessionState
setSessionState
```

2. Supprimer l'effet qui fait `acquireSession` au chargement.
3. Supprimer `startHeartbeat` / `stopHeartbeat` / `releaseSession`.
4. Supprimer `takeoverEditingSession`.
5. Supprimer l'alerte UI qui affiche un message de session ou le bouton `Reprendre le contrôle`.
6. Remplacer :

```js
const canEdit = sessionState.status === 'active';
```

par une logique simple :

```js
const canEdit = Boolean(projection) && !loading && !loadError;
```

ou équivalent selon les noms réels.

7. Garder les blocages métier existants : card jouée, lock, conflit, etc.
8. Le bouton flottant `Ajouter un musicien` doit être actif dès que la jam est chargée correctement.

---

## 12. Frontend — NewJamPage

Fichier :

- `frontend/src/features/jams/pages/NewJamPage.jsx`

À faire :

1. Après `createJamApi`, ne plus appeler `jamStore.getState().acquireSession`.
2. Supprimer tout message du type “Jam créée mais session d'édition non acquise”.
3. Après succès de création, naviguer directement vers `/jams/:jamId`.

---

## 13. Tests backend

Fichier principal :

- `backend/jams/tests/test_event_store_api.py`

À faire :

1. Supprimer les helpers `acquire()` s'ils ne servent plus.
2. Supprimer les tests :
   - acquire session ;
   - heartbeat ;
   - release ;
   - takeover ;
   - jam locked by another client ;
   - CSRF spécifique client-session.
3. Ajouter un test : transaction valide sans lease acceptée.
4. Ajouter un test : deux clients différents peuvent pousser des transactions sur la même jam.
5. Ajouter un test : `baseServerSequenceNumber` obsolète ne bloque pas.
6. Ajouter un test : `clientSequenceNumber` dupliqué pour le même client ne bloque pas.
7. Ajouter un test : endpoints `/client-session/*` retournent 404.
8. Adapter les fixtures qui ajoutaient `leaseToken` aux payloads transaction.

---

## 14. Tests frontend

Fichiers concernés :

- `frontend/src/features/sync/syncQueue.test.js`
- `frontend/src/features/sync/clientSession.test.js`
- `frontend/src/features/jams/pages/JamPages.test.jsx`
- `frontend/src/shared/api/httpClient.test.js` si concerné
- `frontend/src/shared/api/jamsApi.js` tests s'ils existent

À faire :

1. Supprimer `clientSession.test.js`.
2. Supprimer les mocks :

```js
acquireClientSession
heartbeatClientSession
releaseClientSession
takeoverClientSession
```

3. Dans les tests de page jam, vérifier que le chargement n'appelle pas d'API session.
4. Dans les tests sync queue, vérifier que `pushTransaction` est appelé sans `leaseToken`.
5. Supprimer les tests `lease lost`, `session required`, `takeover`.
6. Ajouter tests offline/retry/synced sans session.

---

## 15. Critères d'acceptation

Après correction :

1. Aucun fichier runtime n'importe `clientSession.js`.
2. Aucun payload front n'envoie `leaseToken`.
3. Aucun endpoint `/client-session/*` n'existe.
4. `JamClientSession` n'existe plus dans `models.py`.
5. La table `jams_jamclientsession` est supprimée par migration.
6. `JamTransaction` n'a plus de contrainte unique `(jam, client_id, client_sequence_number)`.
7. Le backend accepte une transaction sans session active.
8. Le backend accepte des transactions de plusieurs `clientId`.
9. Le backend accepte `clientSequenceNumber` comme metadata only.
10. Le backend ne bloque pas sur `baseServerSequenceNumber` obsolète.
11. La page jam est éditable dès chargement réussi.
12. Plus aucun message UI `Reprendre le contrôle`.
13. Plus aucune erreur `No active client session for this jam` dans le flow transaction.
14. La sync locale/offline fonctionne toujours.
15. Tests backend et frontend passent :

```bash
cd backend
pytest

cd ../frontend
npm test -- --run
```

Ne réintroduis pas de logique V1 dans ce correctif. La V1 client sessions sera spécifiée plus tard si nécessaire.
