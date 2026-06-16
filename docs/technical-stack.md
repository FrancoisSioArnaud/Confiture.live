# Technical Stack — Confiture.live V0

## 1. Stack

- Backend : Django + Django REST Framework.
- Frontend : React + MUI + JavaScript.
- Base V0 : SQLite.
- Sync : local-first/offline avec event log.

---

## 2. Backend V0

Modèles :

```txt
Jam
JamTransaction
JamEvent
JamSnapshot
```

Modèle supprimé :

```txt
JamClientSession
```

Services attendus :

```txt
transactions.py
snapshots.py
events.py
validation.py
```

Service supprimé :

```txt
sessions.py
```

---

## 3. Endpoints V0

```txt
GET    /api/health/
GET    /api/jams/
POST   /api/jams/
GET    /api/jams/:jamId/
PATCH  /api/jams/:jamId/
DELETE /api/jams/:jamId/
GET    /api/jams/:jamId/transactions/
POST   /api/jams/:jamId/transactions/
GET    /api/jams/:jamId/snapshot/latest/
POST   /api/jams/:jamId/snapshots/
```

Endpoints supprimés de la V0 :

```txt
POST /api/jams/:jamId/client-session/acquire/
POST /api/jams/:jamId/client-session/heartbeat/
POST /api/jams/:jamId/client-session/release/
POST /api/jams/:jamId/client-session/takeover/
```

---

## 4. Frontend V0

Garder :

- `clientIdentity.js` pour conserver `clientId` comme métadonnée ;
- `syncQueue.js` pour pending/retry/offline ;
- `localDb.js` pour IndexedDB ;
- projection locale depuis events.

Supprimer :

- `clientSession.js` ;
- appels acquire/heartbeat/release/takeover ;
- table IndexedDB `clientSessions` ;
- statuts `session_required` et `lease_lost` ;
- UI de reprise de contrôle.

---

## 5. V1

Les client sessions et le verrouillage multi-device seront redéfinis en V1 si nécessaire.
