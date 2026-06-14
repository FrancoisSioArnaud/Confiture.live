# Backend API Contract — Confiture.live

## 1. Objectif

Ce fichier définit le contrat API backend/frontend pour Confiture.live V0.

Le backend doit :

- stocker les jams ;
- stocker les transactions et events ;
- stocker les snapshots ;
- gérer un seul client actif par jam ;
- permettre la récupération complète d’une jam ;
- permettre la sync incrémentale ;
- rester simple et fiable.

Le backend ne doit pas être la source immédiate de l’état UI pendant une jam. Le frontend applique les transactions localement, puis les synchronise.

---

## 2. Principes API

### 2.1 Format JSON

Toutes les requêtes et réponses sont JSON.

Headers :

```txt
Content-Type: application/json
Accept: application/json
```

---

### 2.2 Idempotence

Les endpoints de push de transactions doivent être idempotents.

Si le serveur reçoit deux fois la même `transactionId`, il doit répondre succès avec la transaction existante, sans créer de doublon.

---

### 2.3 Validation backend V0

Validation légère uniquement :

- jam existe ;
- lease actif détenu par le bon client ;
- transactionId unique ;
- séquence client attendue ;
- schemaVersion supportée ;
- type event autorisé ;
- JSON payload valide au niveau structure.

Le serveur V0 ne recalcule pas toute la projection métier à chaque push.

---

### 2.4 Statuts HTTP

```txt
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized futur V1
403 Forbidden
404 Not Found
409 Conflict de séquence/sync
423 Locked jam déjà contrôlée par un autre client
500 Server Error
```

---

## 3. Ressources principales

### 3.1 Jam summary

```js
{
  jamId: "jam_...",
  name: "Jam du mercredi",
  indicativeDate: "2026-06-17",
  status: "active",
  latestServerSequenceNumber: 123,
  latestSnapshotSequenceNumber: 120,
  updatedAt: "2026-06-14T19:00:00.000Z",
  summary: {
    uniqueParticipantsCount: 24,
    playedPlateausCount: 6,
    activeInstrumentsCount: 5,
    pendingLocalOnly: false
  }
}
```

---

### 3.2 Jam full payload

```js
{
  jam: {},
  latestSnapshot: {},
  transactions: [],
  events: [],
  clientSession: {}
}
```

Le client peut reconstruire la projection depuis ce payload.

---

## 4. Endpoints jams

### 4.1 `GET /api/jams/`

Liste les jams.

Réponse :

```js
{
  "results": [
    {
      "jamId": "jam_...",
      "name": "Jam du mercredi",
      "indicativeDate": "2026-06-17",
      "latestServerSequenceNumber": 42,
      "updatedAt": "2026-06-14T19:00:00.000Z",
      "summary": {
        "uniqueParticipantsCount": 12,
        "playedPlateausCount": 3
      }
    }
  ]
}
```

---

### 4.2 `POST /api/jams/`

Crée une jam.

Body :

```js
{
  "clientId": "client_...",
  "transaction": {
    "transactionId": "transaction_...",
    "clientSequenceNumber": 1,
    "schemaVersion": 1,
    "events": [
      {
        "eventId": "event_...",
        "type": "jam_created",
        "payload": {
          "jamId": "jam_...",
          "name": "Jam du mercredi",
          "indicativeDate": "2026-06-17",
          "linkReorderStrategy": "move_to_first"
        }
      },
      {
        "eventId": "event_...",
        "type": "instrument_added",
        "payload": {}
      }
    ]
  }
}
```

Réponse `201` :

```js
{
  "jamId": "jam_...",
  "latestServerSequenceNumber": 8,
  "transactionAck": {
    "transactionId": "transaction_...",
    "serverSequenceNumberStart": 1,
    "serverSequenceNumberEnd": 8
  }
}
```

---

### 4.3 `GET /api/jams/:jamId/`

Récupère une jam complète.

Query params optionnels :

```txt
includeSnapshot=true
fromSequence=123
```

Si `fromSequence` est fourni, le backend peut renvoyer seulement les transactions/events après cette séquence.

Réponse :

```js
{
  "jam": {
    "jamId": "jam_...",
    "name": "Jam du mercredi",
    "indicativeDate": "2026-06-17",
    "latestServerSequenceNumber": 123
  },
  "snapshot": {
    "snapshotId": "snapshot_...",
    "lastServerSequenceNumber": 120,
    "payload": {}
  },
  "transactions": [],
  "events": []
}
```

---

### 4.4 `DELETE /api/jams/:jamId/`

Supprime ou archive une jam depuis la liste des jams.

V0 : suppression logique recommandée.

Body optionnel :

```js
{
  "clientId": "client_..."
}
```

Réponse : `204 No Content`.

---

## 5. Endpoints sync

### 5.1 `POST /api/jams/:jamId/transactions/`

Push une transaction locale.

Body :

```js
{
  "clientId": "client_...",
  "leaseToken": "lease_...",
  "baseServerSequenceNumber": 42,
  "transaction": {
    "transactionId": "transaction_...",
    "clientSequenceNumber": 43,
    "createdAt": "2026-06-14T19:00:00.000Z",
    "schemaVersion": 1,
    "events": [
      {
        "eventId": "event_...",
        "type": "participant_created",
        "payload": {}
      }
    ]
  }
}
```

Réponse succès :

```js
{
  "status": "accepted",
  "transactionId": "transaction_...",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 45,
  "latestServerSequenceNumber": 45
}
```

Réponse transaction déjà reçue :

```js
{
  "status": "already_accepted",
  "transactionId": "transaction_...",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 45,
  "latestServerSequenceNumber": 45
}
```

Erreur séquence : `409 Conflict`

```js
{
  "error": "sequence_conflict",
  "message": "Le serveur possède déjà des events inconnus du client.",
  "latestServerSequenceNumber": 47,
  "clientBaseServerSequenceNumber": 42
}
```

Erreur lock : `423 Locked`

```js
{
  "error": "jam_locked_by_other_client",
  "message": "Cette jam est déjà ouverte sur un autre appareil.",
  "activeClientId": "client_other",
  "leaseExpiresAt": "2026-06-14T19:01:00.000Z"
}
```

---

### 5.2 `GET /api/jams/:jamId/transactions/`

Récupère les transactions/events depuis une séquence.

Query :

```txt
fromServerSequenceNumber=42
```

Réponse :

```js
{
  "latestServerSequenceNumber": 50,
  "transactions": [
    {
      "transactionId": "transaction_...",
      "clientId": "client_...",
      "clientSequenceNumber": 43,
      "serverSequenceNumberStart": 43,
      "serverSequenceNumberEnd": 45,
      "events": []
    }
  ]
}
```

---

## 6. Endpoints snapshots

### 6.1 `POST /api/jams/:jamId/snapshots/`

Le client envoie un snapshot de projection.

Body :

```js
{
  "clientId": "client_...",
  "leaseToken": "lease_...",
  "snapshot": {
    "snapshotId": "snapshot_...",
    "lastServerSequenceNumber": 120,
    "schemaVersion": 1,
    "projectionVersion": 1,
    "createdAt": "2026-06-14T19:00:00.000Z",
    "payload": {}
  }
}
```

Réponse :

```js
{
  "status": "accepted",
  "snapshotId": "snapshot_...",
  "lastServerSequenceNumber": 120
}
```

Règles :

- le snapshot n’est pas source de vérité ;
- le serveur le stocke pour accélérer la récupération ;
- le snapshot doit être lié à un `lastServerSequenceNumber` ;
- si ce sequence number est inconnu du serveur, refuser `400` ou `409`.

---

### 6.2 `GET /api/jams/:jamId/snapshot/latest/`

Réponse :

```js
{
  "snapshot": {
    "snapshotId": "snapshot_...",
    "lastServerSequenceNumber": 120,
    "payload": {}
  }
}
```

---

## 7. Endpoints client lease

### 7.1 `POST /api/jams/:jamId/client-session/acquire/`

Prend le contrôle d’édition d’une jam.

Body :

```js
{
  "clientId": "client_...",
  "deviceLabel": "iPhone de Sio",
  "force": false
}
```

Réponse succès :

```js
{
  "status": "acquired",
  "clientId": "client_...",
  "leaseToken": "lease_...",
  "leaseExpiresAt": "2026-06-14T19:01:00.000Z",
  "heartbeatIntervalSeconds": 10
}
```

Erreur `423 Locked` si autre client actif :

```js
{
  "error": "jam_locked_by_other_client",
  "activeClientId": "client_other",
  "leaseExpiresAt": "2026-06-14T19:01:00.000Z",
  "canForceTakeover": true
}
```

---

### 7.2 `POST /api/jams/:jamId/client-session/heartbeat/`

Renouvelle le lease.

Body :

```js
{
  "clientId": "client_...",
  "leaseToken": "lease_..."
}
```

Réponse :

```js
{
  "status": "renewed",
  "leaseExpiresAt": "2026-06-14T19:01:10.000Z"
}
```

---

### 7.3 `POST /api/jams/:jamId/client-session/release/`

Libère le lease.

Body :

```js
{
  "clientId": "client_...",
  "leaseToken": "lease_..."
}
```

Réponse :

```js
{
  "status": "released"
}
```

---

### 7.4 `POST /api/jams/:jamId/client-session/takeover/`

Reprise volontaire du contrôle.

Body :

```js
{
  "clientId": "client_...",
  "previousClientId": "client_other",
  "confirm": true
}
```

Réponse :

```js
{
  "status": "acquired",
  "clientId": "client_...",
  "leaseToken": "lease_...",
  "leaseExpiresAt": "2026-06-14T19:01:10.000Z"
}
```

---

## 8. Endpoint health

### `GET /api/health/`

Réponse :

```js
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 9. Modèles backend attendus

Voir `data_model.md` pour le détail.

Minimum API :

```txt
Jam
JamTransaction
JamEvent
JamSnapshot
JamClientSession
```

Ne pas recréer des tables source de vérité pour `Participant`, `Participation`, `Appearance`, `Link`, `Conflict`, `Hole` en V0. Ces données sont dans l’eventLog et le snapshot/projection.

---

## 10. Règles CORS/CSRF

V0 sans auth :

- autoriser le domaine frontend ;
- configurer CSRF si cookies/session ;
- privilégier API simple sans auth pour V0 locale/prod initiale ;
- préparer auth V1 sans bloquer V0.

---

## 11. Sécurité minimale

Même sans auth V0 :

- valider les payloads JSON ;
- limiter la taille des transactions ;
- limiter les types event autorisés ;
- refuser les schemaVersion inconnues ;
- ne jamais exécuter de contenu reçu ;
- logs backend lisibles mais sans fuite excessive de données.

---

## 12. Non objectifs API V0

Ne pas implémenter :

- WebSocket temps réel ;
- merge multi-client ;
- auth organisateur complète ;
- API REST CRUD pour chaque participant/appearance/link ;
- recalcul serveur complet de projection à chaque mutation ;
- suppression physique RGPD avancée.
