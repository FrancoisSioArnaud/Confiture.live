# Backend API Contract — Confiture.live V0

## 1. Objectif

Ce fichier définit le contrat API V0 entre frontend et backend.

La V0 est local-first/offline et sans client sessions.

Voir aussi : [`v0-sync-no-client-sessions.md`](./v0-sync-no-client-sessions.md).

---

## 2. Principes

Le backend doit :

- stocker les jams ;
- stocker les transactions ;
- stocker les events ;
- stocker les snapshots éventuels ;
- accepter les transactions structurellement valides ;
- attribuer les `serverSequenceNumber` ;
- garantir l'idempotence par `transactionId`.

Le backend V0 ne doit pas :

- gérer de client session ;
- demander de `leaseToken` ;
- vérifier un heartbeat ;
- bloquer une transaction parce qu'un autre device a édité avant ;
- refuser une transaction à cause de `baseServerSequenceNumber` obsolète ;
- refuser une transaction à cause de `clientSequenceNumber` inattendu.

---

## 3. Endpoints jams

### `GET /api/jams/`

Liste les jams.

### `POST /api/jams/`

Crée une jam à partir d'une transaction initiale contenant un event `jam_created`.

Body :

```json
{
  "clientId": "client_abc",
  "transaction": {
    "transactionId": "transaction_abc",
    "jamId": "jam_abc",
    "clientId": "client_abc",
    "clientSequenceNumber": 1,
    "schemaVersion": 1,
    "events": [
      {
        "eventId": "event_abc",
        "type": "jam_created",
        "payload": {
          "jamId": "jam_abc",
          "name": "Jam du mercredi"
        }
      }
    ]
  }
}
```

Réponse :

```json
{
  "jamId": "jam_abc",
  "latestServerSequenceNumber": 1,
  "transactionAck": {
    "transactionId": "transaction_abc",
    "serverSequenceNumberStart": 1,
    "serverSequenceNumberEnd": 1
  }
}
```

### `GET /api/jams/:jamId/`

Récupère la jam, snapshot éventuel, transactions et events.

Réponse :

```json
{
  "jam": {},
  "snapshot": null,
  "transactions": [],
  "events": []
}
```

Aucun objet `session` ou `clientSession` ne doit être renvoyé en V0.

### `DELETE /api/jams/:jamId/`

Archive la jam.

---

## 4. Endpoints transactions

### `POST /api/jams/:jamId/transactions/`

Push une transaction locale.

Body V0 :

```json
{
  "clientId": "client_abc",
  "baseServerSequenceNumber": 42,
  "transaction": {
    "transactionId": "transaction_abc",
    "jamId": "jam_abc",
    "clientId": "client_abc",
    "clientSequenceNumber": 12,
    "createdAt": "2026-06-16T18:00:00.000Z",
    "schemaVersion": 1,
    "source": "organizer_ui",
    "label": "Créer participant",
    "events": []
  }
}
```

Le champ `baseServerSequenceNumber` est accepté mais ne bloque pas l'écriture.

Interdit en V0 :

```json
{
  "leaseToken": "lease_abc"
}
```

Réponse succès :

```json
{
  "status": "accepted",
  "transactionId": "transaction_abc",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 45,
  "latestServerSequenceNumber": 45
}
```

Réponse idempotente :

```json
{
  "status": "already_accepted",
  "transactionId": "transaction_abc",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 45,
  "latestServerSequenceNumber": 45
}
```

Erreurs supprimées de la V0 :

- `No active client session for this jam` ;
- `jam_locked_by_other_client` ;
- `inactive_client_session` ;
- `expired_client_session` ;
- `Invalid lease token` ;
- `Lease token is required` ;
- `client_sequence_conflict` ;
- `sequence_conflict` basé sur `baseServerSequenceNumber`.

### `GET /api/jams/:jamId/transactions/?fromServerSequenceNumber=42`

Récupère les transactions acceptées après une séquence serveur.

---

## 5. Endpoints snapshots

### `POST /api/jams/:jamId/snapshots/`

Stocke un snapshot optionnel.

Body V0 :

```json
{
  "clientId": "client_abc",
  "snapshot": {
    "snapshotId": "snapshot_abc",
    "lastServerSequenceNumber": 120,
    "schemaVersion": 1,
    "projectionVersion": 1,
    "payload": {}
  }
}
```

Aucun `leaseToken`.

### `GET /api/jams/:jamId/snapshot/latest/`

Renvoie le dernier snapshot.

---

## 6. Endpoints supprimés de la V0

Ces endpoints ne doivent plus exister en V0 :

```txt
POST /api/jams/:jamId/client-session/acquire/
POST /api/jams/:jamId/client-session/heartbeat/
POST /api/jams/:jamId/client-session/release/
POST /api/jams/:jamId/client-session/takeover/
```

Ils sont déplacés en V1.

---

## 7. Modèles backend V0

```txt
Jam
JamTransaction
JamEvent
JamSnapshot
```

Modèle supprimé de la V0 :

```txt
JamClientSession
```

---

## 8. Sécurité V0

V0 sans auth.

Le backend reste une API JSON simple, same-origin de préférence.

L'authentification, les permissions fines et les client sessions sont repoussées en V1.
