# Data Model — Confiture.live V0

## 1. Décision V0

La V0 utilise un event log append-only sans client sessions.

Voir : [`v0-sync-no-client-sessions.md`](./v0-sync-no-client-sessions.md).

---

## 2. Modèles backend V0

### `Jam`

```txt
jam_id string unique
name string
indicative_date date nullable
status active|archived
link_reorder_strategy move_to_first|move_to_last|average_position
latest_server_sequence_number integer
metadata json
created_at datetime
updated_at datetime
```

### `JamTransaction`

```txt
jam foreign key
transaction_id string unique
client_id string
client_sequence_number integer metadata only
server_sequence_number_start integer
server_sequence_number_end integer
schema_version integer
payload json
reverted boolean
created_at datetime
```

Règles V0 :

- `transaction_id` est l'idempotence forte ;
- `client_id` est conservé pour audit ;
- `client_sequence_number` est conservé comme métadonnée ;
- pas de contrainte unique `(jam, client_id, client_sequence_number)` ;
- pas de `client_session_id` ;
- pas de `lease_token`.

### `JamEvent`

```txt
jam foreign key
transaction foreign key
event_id string unique
type string
payload json
schema_version integer
client_id string
client_sequence_number integer metadata only
server_sequence_number integer
created_at datetime
```

Règles V0 :

- `server_sequence_number` est l'ordre global de vérité ;
- `client_id` et `client_sequence_number` sont des métadonnées ;
- pas de lien vers une session.

### `JamSnapshot`

```txt
snapshot_id string unique
jam foreign key
client_id string
last_server_sequence_number integer
payload json
schema_version integer
created_at datetime
```

Règles V0 :

- snapshot optionnel ;
- pas source de vérité ;
- aucun lease requis pour poster un snapshot ;
- peut être ignoré par le front si on veut rejouer tout l'event log.

---

## 3. Modèle supprimé de la V0

`JamClientSession` est supprimé de la V0.

La table correspondante doit disparaître des migrations/code V0.

Supprimer aussi :

- `session_id` ;
- `lease_token` ;
- `lease_expires_at` ;
- `last_heartbeat_at` ;
- `acquired_at` ;
- status de session ;
- relations `jam.client_sessions`.

---

## 4. Modèle local frontend V0

IndexedDB conserve :

```txt
localJams
localTransactions
pendingTransactions
snapshots
syncState
```

IndexedDB supprime :

```txt
clientSessions
```

---

## 5. Entités métier projetées côté front

Les entités métier restent issues des events :

```txt
Participant
Participation
Appearance
Instrument
Link
Conflict
Hole
Plateau
```

Elles ne sont pas stockées comme tables relationnelles backend V0.

---

## 6. V1 reportée

La V1 pourra réintroduire un modèle de client sessions :

```txt
JamClientSession
lease_token
heartbeat
takeover
lecture seule multi-device
```

Aucun de ces champs ne doit être requis dans la V0.
