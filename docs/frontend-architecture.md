# Frontend Architecture — V0 sans client sessions

## 1. Objectif

Le frontend Confiture.live V0 est local-first/offline.

Il applique immédiatement les transactions localement, puis les synchronise vers le backend.

La V0 ne contient pas de client sessions, pas de lease, pas de heartbeat et pas de takeover.

---

## 2. Flux page jam

Au chargement d'une page jam :

1. récupérer la jam depuis le backend ;
2. récupérer snapshot éventuel + transactions/events ;
3. reconstruire la projection ;
4. hydrater le store local ;
5. afficher la jam en mode éditable.

Il ne faut plus appeler :

```txt
acquireClientSession
heartbeatClientSession
releaseClientSession
takeoverClientSession
```

---

## 3. Flux action organisateur

Pour chaque action :

1. construire une transaction avec `clientId` ;
2. réserver/incrémenter `clientSequenceNumber` localement ;
3. appliquer la transaction dans la projection locale ;
4. sauvegarder la transaction dans IndexedDB ;
5. la marquer pending ;
6. planifier la sync.

Aucun `leaseToken` n'est demandé ou envoyé.

---

## 4. Sync queue

La queue pousse :

```js
pushTransaction(jamId, {
  clientId: transaction.clientId,
  baseServerSequenceNumber,
  transaction,
})
```

La queue ne doit plus :

- lire une client session locale ;
- reacquire une session ;
- tester une expiration de lease ;
- bloquer sur `transaction.clientId !== session.clientId` ;
- produire `lease_lost` ou `session_required`.

---

## 5. IndexedDB

Tables V0 :

```txt
localJams
localTransactions
pendingTransactions
snapshots
syncState
```

Table supprimée :

```txt
clientSessions
```

---

## 6. UI supprimée

Supprimer :

- alerte de session active ailleurs ;
- bouton `Reprendre le contrôle` ;
- état read-only dû à un autre device ;
- message `Session d'édition perdue` ;
- désactivation des actions faute de lease.

---

## 7. Statuts sync V0

```txt
local_only
pending
syncing
synced
offline
retrying
error
```

---

## 8. V1

Les client sessions sont repoussées en V1.
