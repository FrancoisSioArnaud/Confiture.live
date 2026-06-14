# Confiture.live — Data Model V0

## 1. Objectif

Ce document définit comment les données de Confiture.live doivent être représentées :

- côté client ;
- côté backend Django ;
- dans les events ;
- dans les snapshots ;
- dans la projection reconstruite.

Principe central :

```txt
La source de vérité est l’eventLog.
La projection est reconstruite de manière déterministe.
Le snapshot est un cache.
```

Le modèle doit permettre :

- fonctionnement mobile-first ;
- actions locales immédiates ;
- sync serveur après chaque action UI ;
- reprise après reload ;
- undo fiable ;
- historique complet ;
- un seul client actif par jam en V0.

---

## 2. Niveaux de données

Il y a trois niveaux à ne pas confondre.

### 2.1 EventLog

Liste ordonnée des events persistants.

C’est la vérité.

```txt
JamEvent[]
```

### 2.2 Snapshot

État calculé à un instant donné, lié à un sequenceNumber.

C’est un cache.

```txt
JamSnapshot
```

### 2.3 Projection

État courant utilisé par l’interface.

Elle est reconstruite en mémoire à partir de :

```txt
snapshot + events suivants
```

La projection ne doit pas être modifiée directement comme source durable.

---

## 3. Entités métier projetées

Ces entités existent dans la projection client.

Elles ne doivent pas forcément être stockées en tables SQL dédiées en V0.

---

## 4. `Jam`

Représente une jam.

### 4.1 Champs métier

```js
{
  jamId: "jam_123",
  name: "Jam du jeudi",
  date: "2026-06-14",
  status: "active",
  linkReorderStrategy: "move_to_first",
  createdAt: "2026-06-14T18:00:00.000Z",
  updatedAt: "2026-06-14T18:30:00.000Z"
}
```

### 4.2 `status`

Valeurs V0 recommandées :

```txt
active
archived
```

### 4.3 `linkReorderStrategy`

Valeurs V0 :

```txt
move_to_first
move_to_last
average_position
```

Valeur par défaut :

```txt
move_to_first
```

Cette valeur est définie par `jam_created`, puis modifiée par :

```txt
jam_link_reorder_strategy_changed
```

Important : un event `link_created` doit copier la stratégie courante dans son payload pour garantir le replay déterministe.

---

## 5. `Instrument`

Instrument/colonne de la jam.

```js
{
  instrumentId: "guitar",
  label: "Guitare",
  orderKey: "a0",
  visible: true,
  createdAt: "2026-06-14T18:00:00.000Z"
}
```

Règles :

- un instrument visible apparaît comme colonne ;
- un instrument invisible est masqué du tableau ;
- un instrument invisible est absent du drawer d’appel ;
- l’historique de ses events est conservé ;
- la suppression d’un instrument en V0 est une modification de visibilité, pas un hard-delete.

Event associé :

```txt
instrument_visibility_changed
```

---

## 6. `Participant`

Personne réelle inscrite à la jam.

```js
{
  participantId: "participant_nicolas",
  name: "Nicolas",
  presenceStatus: "available",
  removed: false,
  left: false,
  createdAt: "2026-06-14T18:05:00.000Z"
}
```

### 6.1 `presenceStatus`

Valeurs persistantes V0 :

```txt
available
left
```

Important : `temporarily_away` n’est pas un état durable.

Le cas “on ne trouve pas le musicien maintenant” est :

```txt
appearance_skipped
```

### 6.2 Suppression participant

`participant_removed` est autorisé seulement si le participant n’a jamais joué.

Si le participant a déjà joué :

```txt
Ne pas proposer Supprimer.
Proposer Marquer comme parti.
```

Pas besoin de suppression réelle RGPD en V0.

Le prénom peut rester dans l’eventLog.

---

## 7. `Participation`

Inscription d’un participant sur un instrument.

```js
{
  participationId: "participation_nicolas_guitar",
  participantId: "participant_nicolas",
  instrumentId: "guitar",
  startAppearanceIndex: 1,
  baseOrderKey: "m0",
  removed: false,
  createdAt: "2026-06-14T18:05:00.000Z"
}
```

### 7.1 Rôle

Une participation ne représente pas un passage précis.

Elle représente :

```txt
Nicolas est inscrit en guitare.
```

Les passages précis sont des appearances.

### 7.2 `startAppearanceIndex`

Permet de gérer l’ajout entre deux cards dans un round supérieur.

Exemples :

```txt
Ajout standard → startAppearanceIndex = 1
Ajout entre deux cards du Round 2 → startAppearanceIndex = 2
Ajout entre deux cards du Round 3 → startAppearanceIndex = 3
```

Règle :

```txt
La participation génère des appearances seulement à partir de startAppearanceIndex.
```

### 7.3 `baseOrderKey`

Clé d’ordre stable utilisée pour générer les appearances futures.

Elle doit éviter les dépendances à des index fragiles.

Recommandation :

```txt
Utiliser des order keys fractionnaires ou lexicographiques.
```

Exemples :

```txt
a0
m0
z0
```

Quand on insère entre deux cards, générer une clé entre les deux.

---

## 8. `Appearance`

Occurrence concrète d’une participation dans un round.

```js
{
  appearanceId: "appearance_nicolas_guitar_2",
  participationId: "participation_nicolas_guitar",
  participantId: "participant_nicolas",
  instrumentId: "guitar",
  appearanceIndex: 2,
  orderKey: "m0",
  materialized: true,
  played: false,
  locked: false,
  removed: false,
  skipped: false
}
```

### 8.1 Calculée ou matérialisée

Par défaut, une appearance future peut être calculée sans être stockée explicitement.

Elle devient matérialisée quand une action la cible :

```txt
link
conflict appearance-scope
lock
played
manual move
skip
remove
hole/link jouer sans
```

### 8.2 ID déterministe

Recommandation :

```txt
appearanceId = deterministic(participationId + appearanceIndex)
```

Exemple :

```txt
appearance_participation_nicolas_guitar_2
```

Cela permet de retrouver la même appearance au replay.

### 8.3 `appearanceIndex`

Correspond au round UI.

```txt
appearanceIndex 1 = Round 1
appearanceIndex 2 = Round 2
appearanceIndex 3 = Round 3
```

Règle forte :

```txt
Ne jamais renuméroter les appearanceIndex matérialisés.
```

Si l’appearance 2 est supprimée, l’appearance 3 reste l’appearance 3.

### 8.4 `played`

Une appearance jouée :

- reste visible ;
- est grisée ;
- ne bouge plus ;
- ne peut plus être supprimée comme future appearance ;
- reste dans l’historique.

### 8.5 `locked`

Une appearance lockée :

- ne bouge pas automatiquement ;
- ne bouge pas manuellement ;
- ne bouge pas par link/conflict ;
- doit être unlock avant déplacement.

### 8.6 `skipped`

`appearance_skipped` est une action ponctuelle.

Effet :

```txt
L’appearance est repoussée d’un plateau.
Ce n’est pas un état durable du participant.
```

Si elle était linkée :

```txt
Le link est supprimé/désactivé.
Seule l’appearance skippée est repoussée.
Le reste du groupe ne bouge pas automatiquement.
```

---

## 9. `Hole`

Appearance sans musicien.

```js
{
  holeId: "hole_bass_123",
  instrumentId: "bass",
  appearanceIndex: 1,
  orderKey: "p0",
  played: false,
  locked: false,
  removed: false,
  reason: "manual"
}
```

### 9.1 Règles

Un hole :

- occupe une vraie position dans une colonne ;
- peut être joué ;
- peut être locké ;
- peut être linké ;
- ne représente pas une participation ;
- ne se répète pas automatiquement dans les rounds suivants ;
- peut être supprimé avec confirmation s’il n’est pas joué.

### 9.2 Jouer sans

Il n’y a pas de modèle `PlayWithout` en V0.

“Jouer sans batterie” =

```txt
hole_added dans batterie
link_created entre appearance musicien et hole
```

Le hole reste un hole normal.

---

## 10. `Link`

Contrainte de même plateau.

```js
{
  linkId: "link_123",
  targets: [
    { "targetType": "appearance", "targetId": "appearance_nicolas_guitar_1" },
    { "targetType": "hole", "targetId": "hole_drums_123" }
  ],
  strategy: "move_to_first",
  originTarget: {
    "targetType": "appearance",
    "targetId": "appearance_nicolas_guitar_1"
  },
  removed: false,
  createdAt: "2026-06-14T18:10:00.000Z"
}
```

### 10.1 Targets autorisées

V0 :

```txt
appearance
hole
```

Un link ne peut pas avoir deux targets dans la même colonne.

### 10.2 Strategy copiée

Le champ `strategy` doit être copié dans le link au moment de sa création.

Pourquoi : si la config de jam change plus tard, le replay du link ancien doit rester identique.

---

## 11. `Conflict`

Contrainte d’incompatibilité.

```js
{
  conflictId: "conflict_123",
  scope: "participation",
  targetIds: [
    "participation_nicolas_guitar",
    "participation_nicolas_bass"
  ],
  reason: "instrument_constraint",
  removed: false
}
```

### 11.1 Scope

```txt
participation → contrainte générale
appearance → contrainte ponctuelle
```

### 11.2 Reasons V0

```txt
instrument_constraint
manual
```

### 11.3 Pas de conflict sur hole

Un conflict ne cible pas de hole en V0.

---

## 12. `Plateau`

Un plateau est une ligne horizontale déduite de la projection.

Il n’est pas nécessaire d’avoir une table SQL `Plateau` en V0.

Projection :

```js
{
  plateauId: "plateau_4",
  rowIndex: 4,
  targetsByInstrumentId: {
    vocals: { targetType: "appearance", targetId: "appearance_lea_vocals_1" },
    guitar: { targetType: "appearance", targetId: "appearance_nicolas_guitar_2" },
    bass: { targetType: "hole", targetId: "hole_bass_123" },
    drums: null
  },
  played: false
}
```

### 12.1 `plateauId`

Peut être déterministe à partir de la position projetée.

Mais pour `plateau_played`, le payload doit contenir les targets exactes jouées afin d’éviter les ambiguïtés si la projection change plus tard.

---

## 13. `JamEvent`

Event stocké dans l’eventLog.

```js
{
  eventId: "event_123",
  jamId: "jam_123",
  transactionId: "transaction_456",
  type: "participation_added",
  payload: {},
  clientSequenceNumber: 14,
  serverSequenceNumber: 102,
  createdAt: "2026-06-14T15:00:00.000Z",
  createdBy: "organizer",
  clientId: "client_abc",
  clientSessionId: "session_789",
  schemaVersion: 1
}
```

### 13.1 Champs obligatoires

```txt
eventId
jamId
transactionId
type
payload
clientSequenceNumber
createdAt
createdBy
clientId
schemaVersion
```

### 13.2 Champs ajoutés côté serveur

```txt
serverSequenceNumber
serverReceivedAt
```

### 13.3 `payload`

Le payload est JSON.

Le schéma dépend de `type`.

Le serveur valide la forme minimale en V0.

---

## 14. `JamTransaction`

Une transaction représente une action UI.

Elle peut être explicite côté client, et optionnellement stockée en backend comme metadata.

```js
{
  transactionId: "transaction_123",
  jamId: "jam_123",
  clientTransactionSequenceNumber: 12,
  serverTransactionSequenceNumber: 58,
  label: "Créer participant",
  createdAt: "2026-06-14T18:00:00.000Z",
  clientId: "client_abc",
  status: "synced",
  events: []
}
```

### 14.1 Status local

```txt
pending
syncing
synced
failed
reverted
```

### 14.2 Backend

En backend V0, il est possible de ne pas créer de table `JamTransaction` séparée si chaque `JamEvent` contient `transactionId`.

Cependant, une table `JamTransaction` peut faciliter :

- undo ;
- debug ;
- groupement de l’historique ;
- sync par transaction.

Recommandation :

```txt
Créer JamTransaction côté backend.
```

---

## 15. `JamSnapshot`

Cache de projection.

```js
{
  snapshotId: "snapshot_123",
  jamId: "jam_123",
  lastServerSequenceNumber: 120,
  snapshotVersion: 1,
  state: {},
  createdAt: "2026-06-14T18:30:00.000Z",
  createdByClientId: "client_abc"
}
```

### 15.1 Contenu du snapshot

Le snapshot doit contenir la projection complète :

```txt
jam config
instruments
participants
participations
materialized appearances
holes
links
conflicts
visibleRoundCount par instrument
played targets
locked targets
removed/hidden states
last active transaction info utile pour undo
```

### 15.2 Règle

Un snapshot est valide seulement si :

```txt
snapshot.lastServerSequenceNumber <= jam.latestServerSequenceNumber
```

Au chargement :

```txt
prendre le snapshot le plus récent
rejouer les events après lastServerSequenceNumber
```

---

## 16. `JamClientSession`

Session active d’un client sur une jam.

```js
{
  clientSessionId: "session_123",
  jamId: "jam_123",
  clientId: "client_abc",
  status: "active",
  acquiredAt: "2026-06-14T18:00:00.000Z",
  lastHeartbeatAt: "2026-06-14T18:00:20.000Z",
  leaseExpiresAt: "2026-06-14T18:00:50.000Z"
}
```

### 16.1 Status

```txt
active
expired
released
revoked
```

### 16.2 Règles

- une seule session active par jam ;
- un lease expiré peut être remplacé ;
- si un autre client est actif, le nouveau client est en lecture seule ;
- takeover explicite possible avec confirmation UI.

---

## 17. Modèle backend Django recommandé

### 17.1 Tables V0

```txt
Jam
JamTransaction
JamEvent
JamSnapshot
JamClientSession
```

Ne pas créer en V0 de tables sources de vérité pour :

```txt
Participant
Participation
Appearance
Hole
Link
Conflict
Plateau
```

Ces entités sont reconstruites depuis l’eventLog.

---

## 18. Django model — `Jam`

Champs recommandés :

```txt
id UUID/string primary key
name string
date date nullable
status string
latest_server_sequence_number integer default 0
latest_server_transaction_sequence_number integer default 0
created_at datetime
updated_at datetime
```

Champs cache utiles :

```txt
participant_count_cache integer optional
visible_instrument_count_cache integer optional
last_activity_at datetime optional
```

Ces caches ne sont pas source de vérité.

---

## 19. Django model — `JamTransaction`

Champs recommandés :

```txt
id string primary key
jam foreign key
client_id string
client_session_id string
client_transaction_sequence_number integer
server_transaction_sequence_number integer
created_at_client datetime
received_at_server datetime
status string
label string optional
```

Contrainte :

```txt
unique(jam, id)
unique(jam, server_transaction_sequence_number)
```

---

## 20. Django model — `JamEvent`

Champs recommandés :

```txt
id string primary key
jam foreign key
transaction foreign key nullable if not using table
transaction_id string indexed
type string indexed
payload JSONField
client_sequence_number integer
server_sequence_number integer
created_at_client datetime
received_at_server datetime
created_by string
client_id string
client_session_id string
schema_version integer
```

Contraintes :

```txt
unique(jam, id)
unique(jam, server_sequence_number)
index(jam, server_sequence_number)
index(jam, transaction_id)
index(jam, type)
```

---

## 21. Django model — `JamSnapshot`

Champs recommandés :

```txt
id string primary key
jam foreign key
last_server_sequence_number integer indexed
snapshot_version integer
state JSONField
created_at datetime
created_by_client_id string
```

Contraintes :

```txt
unique(jam, last_server_sequence_number)
index(jam, last_server_sequence_number)
```

Règle :

```txt
Le snapshot le plus récent par jam est utilisé au chargement.
```

---

## 22. Django model — `JamClientSession`

Champs recommandés :

```txt
id string primary key
jam foreign key
client_id string
status string
acquired_at datetime
last_heartbeat_at datetime
lease_expires_at datetime
released_at datetime nullable
revoked_at datetime nullable
```

Index :

```txt
index(jam, status)
index(jam, lease_expires_at)
```

Règle d’unicité logique :

```txt
Une seule session active non expirée par jam.
```

SQLite ne gère pas toujours parfaitement les contraintes partielles avancées selon le besoin. Cette règle peut être appliquée côté transaction Django.

---

## 23. Stockage client local

Stockage recommandé :

```txt
IndexedDB
```

Ne pas utiliser `localStorage` pour l’eventLog.

### 23.1 Object stores recommandés

```txt
jams
events
transactions
snapshots
syncState
clientSessions
```

---

## 24. IndexedDB — `events`

```js
{
  eventId: "event_123",
  jamId: "jam_123",
  transactionId: "transaction_456",
  type: "participation_added",
  payload: {},
  clientSequenceNumber: 14,
  serverSequenceNumber: null,
  createdAt: "2026-06-14T15:00:00.000Z",
  createdBy: "organizer",
  clientId: "client_abc",
  clientSessionId: "session_789",
  schemaVersion: 1,
  syncStatus: "pending"
}
```

Indexes :

```txt
jamId
transactionId
clientSequenceNumber
serverSequenceNumber
syncStatus
```

---

## 25. IndexedDB — `transactions`

```js
{
  transactionId: "transaction_123",
  jamId: "jam_123",
  clientTransactionSequenceNumber: 12,
  serverTransactionSequenceNumber: null,
  label: "Ajouter participant",
  createdAt: "2026-06-14T18:00:00.000Z",
  clientId: "client_abc",
  clientSessionId: "session_789",
  syncStatus: "pending",
  eventIds: ["event_1", "event_2"]
}
```

Indexes :

```txt
jamId
syncStatus
clientTransactionSequenceNumber
serverTransactionSequenceNumber
```

---

## 26. IndexedDB — `snapshots`

```js
{
  snapshotId: "snapshot_local_123",
  jamId: "jam_123",
  lastServerSequenceNumber: 120,
  lastClientSequenceNumber: 180,
  snapshotVersion: 1,
  state: {},
  createdAt: "2026-06-14T18:30:00.000Z"
}
```

---

## 27. IndexedDB — `syncState`

```js
{
  jamId: "jam_123",
  clientId: "client_abc",
  clientSessionId: "session_789",
  lastKnownServerSequenceNumber: 120,
  lastSuccessfulSyncAt: "2026-06-14T18:30:00.000Z",
  syncStatus: "synced",
  pendingTransactionCount: 0,
  lastSyncErrorCode: null
}
```

`syncStatus` :

```txt
synced
pending
offline_pending
sync_warning
readonly
```

---

## 28. Projection client recommandée

La projection est un objet en mémoire.

```js
{
  jam: {},
  instrumentsById: {},
  orderedVisibleInstrumentIds: [],
  participantsById: {},
  participationsById: {},
  appearancesById: {},
  holesById: {},
  linksById: {},
  conflictsById: {},
  visibleRoundCountByInstrumentId: {},
  playedTargetIds: {},
  lockedTargetIds: {},
  columns: {},
  plateaus: [],
  activeTransactions: [],
  revertedTransactionIds: {}
}
```

### 28.1 `columns`

```js
{
  guitar: [
    { targetType: "appearance", targetId: "appearance_nicolas_guitar_1" },
    { targetType: "hole", targetId: "hole_guitar_123" },
    { targetType: "appearance", targetId: "appearance_sarah_guitar_1" }
  ]
}
```

### 28.2 `plateaus`

Déduits des colonnes visibles.

```js
[
  {
    plateauId: "plateau_1",
    rowIndex: 0,
    targetsByInstrumentId: {
      vocals: { targetType: "appearance", targetId: "appearance_lea_vocals_1" },
      guitar: { targetType: "appearance", targetId: "appearance_nicolas_guitar_1" },
      bass: null,
      drums: { targetType: "hole", targetId: "hole_drums_1" }
    }
  }
]
```

---

## 29. Event types V0

Liste autorisée :

```txt
jam_created
jam_updated
jam_link_reorder_strategy_changed
instrument_added
instrument_updated
instrument_visibility_changed
instruments_reordered
participant_created
participant_updated
participant_removed
participant_marked_left
participation_added
participation_removed
appearance_materialized
appearance_moved_between
appearance_locked
appearance_unlocked
appearance_skipped
appearance_removed
link_created
link_removed
conflict_created
conflict_removed
hole_added
hole_removed
hole_moved_between
hole_locked
hole_unlocked
instrument_round_visibility_changed
plateau_played
plateau_unplayed
transaction_reverted
```

Interdits V0 :

```txt
link_updated
conflict_updated
participation_updated
participation_note_updated
appearance_note_updated
play_without_created
play_without_removed
event_reverted
plateau_composition_forced
```

---

## 30. ID strategy

Les IDs métier sont générés côté client.

Format recommandé :

```txt
prefix_uuid
```

Exemples :

```txt
jam_01J...
participant_01J...
participation_01J...
appearance_01J...
hole_01J...
link_01J...
conflict_01J...
event_01J...
transaction_01J...
snapshot_01J...
client_01J...
session_01J...
```

Utiliser des UUID/ULID.

Préférence : ULID ou UUID v7 pour tri/debug lisible.

Ne jamais utiliser le nom du participant dans un ID.

---

## 31. Données personnelles

En V0, les participants seront probablement identifiés par prénom.

Règles :

- stocker le nom uniquement dans `participant_created` ou `participant_updated` ;
- les autres events doivent référencer `participantId` ;
- pas besoin de suppression réelle RGPD en V0 ;
- pas de notes organisateur ;
- ne pas dupliquer le nom dans chaque payload.

---

## 32. Règles de replay

Pour reconstruire la projection :

```txt
1. Charger snapshot le plus récent si disponible.
2. Charger events après snapshot.lastServerSequenceNumber.
3. Trier par serverSequenceNumber pour les events syncés.
4. Ajouter les events pending locaux après les events syncés, triés par clientSequenceNumber.
5. Appliquer les events dans l’ordre.
6. Ignorer les transactions revertées.
7. Recalculer columns et plateaus.
```

En offline :

```txt
server events connus + pending local events = projection courante.
```

---

## 33. Règles de validation client

Le client doit valider avant de créer une transaction :

```txt
card played immobile
card locked immobile
conflict gagne contre link
pas de link entre deux targets même colonne
pas de conflict sur hole
pas de suppression appearance/hole joué
pas de drag horizontal
pas de déplacement si groupe linké impossible
undo uniquement dernière transaction active
```

Si action refusée : snackbar explicative.

---

## 34. Règles de validation backend V0

Le backend valide :

```txt
jam existe
client session active
baseServerSequenceNumber correct
type event autorisé
payload JSON object
schemaVersion supportée
eventId unique
transactionId unique ou cohérent
clientSequenceNumber cohérent
```

Le backend ne valide pas en V0 toute la projection métier.

---

## 35. Règles Codex importantes

Codex doit respecter :

```txt
1. Ne pas créer de tables SQL sources de vérité pour Participant/Appearance/Link/etc. en V0.
2. Les entités métier détaillées sont des projections.
3. La vérité backend est JamEvent.
4. Les snapshots sont des caches.
5. Les IDs métier sont générés client-side.
6. Le client peut agir offline.
7. Le serveur refuse les trous de séquence.
8. Undo est un event, pas une suppression.
9. Pas de hard-delete d’instrument.
10. Pas de notes.
11. Pas de PlayWithout dédié.
12. Un seul client actif par jam.
```

---

## 36. Points ouverts mineurs

Ces points peuvent être implémentés avec les valeurs recommandées si non rediscutés :

```txt
ULID vs UUID v7 pour les IDs : choisir ULID si librairie simple.
OrderKey fractionnaire : choisir une fonction utilitaire centralisée.
Snapshot toutes les 20 transactions syncées.
Lease heartbeat 10s, expiration 30s.
```
