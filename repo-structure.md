# Repo Structure — V0 no client sessions

## Backend

```txt
backend/jams/models.py              # Jam, JamTransaction, JamEvent, JamSnapshot
backend/jams/views.py               # endpoints jams/transactions/snapshots
backend/jams/services/transactions.py
backend/jams/services/snapshots.py
backend/jams/services/events.py
backend/jams/services/validation.py
```

Supprimé de la V0 :

```txt
backend/jams/services/sessions.py
JamClientSession
endpoints client-session
```

## Frontend

```txt
frontend/src/features/sync/clientIdentity.js
frontend/src/features/sync/localDb.js
frontend/src/features/sync/syncQueue.js
frontend/src/features/sync/syncStatus.js
frontend/src/shared/api/jamsApi.js
```

Supprimé de la V0 :

```txt
frontend/src/features/sync/clientSession.js
clientSessions IndexedDB
acquire/heartbeat/release/takeover APIs
```

## Docs

Référence centrale :

```txt
docs/v0-sync-no-client-sessions.md
```
