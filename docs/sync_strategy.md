# Sync Strategy — V0 sans client sessions

## 1. Décision V0

La V0 garde une sync local-first/offline, mais supprime totalement les client sessions.

Voir aussi : [`v0-sync-no-client-sessions.md`](./v0-sync-no-client-sessions.md).

---

## 2. Source de vérité

La source de vérité est l'event log :

```txt
JamTransaction[] + JamEvent[]
```

Le snapshot est optionnel et ne remplace pas l'event log.

Le front doit pouvoir reconstruire l'état de la jam depuis les transactions/events renvoyés par le backend.

---

## 3. Flow front V0

Quand l'organisateur fait une action :

1. le front construit une transaction ;
2. il applique la transaction localement ;
3. il sauvegarde la transaction dans IndexedDB ;
4. il l'ajoute à `pendingTransactions` ;
5. il tente de la pousser vers le backend ;
6. si le push réussit, il marque la transaction `synced` et retire l'entrée `pendingTransactions` correspondante ;
7. il met à jour le store UI `syncStatus` pour que l'indicateur passe immédiatement à `synced` quand `pendingCount === 0` ;
8. si le réseau/backend échoue, il garde la transaction pending et réessaye.

Aucune étape ne demande un lease, un heartbeat ou une session active.

---

## 4. Flow backend V0

`POST /api/jams/:jamId/transactions/` accepte toute transaction structurellement valide.

Le backend :

- vérifie que la jam existe ;
- valide la structure de la transaction ;
- vérifie que le `transactionId` n'est pas déjà utilisé pour une autre jam ;
- si le même `transactionId` est renvoyé pour la même jam, répond `already_accepted` ;
- attribue les prochains `serverSequenceNumber` disponibles ;
- stocke `JamTransaction` et `JamEvent` ;
- met à jour `Jam.latestServerSequenceNumber`.

Le backend ne vérifie pas :

- lease ;
- session active ;
- device actif ;
- ownership du `clientId` ;
- séquence client stricte ;
- conflit de `baseServerSequenceNumber`.

---

## 5. Concurrence V0

Plusieurs clients peuvent pousser des transactions.

La règle est :

```txt
ordre final = ordre d'acceptation serveur
```

Le serveur sérialise les writes via transaction SQL et assigne les `serverSequenceNumber`.

---

## 6. Champs conservés comme métadonnées

### `clientId`

Conservé dans :

- requête transaction ;
- `JamTransaction.client_id` ;
- `JamEvent.client_id` ;
- payload local front.

Il ne bloque jamais l'écriture.

### `clientSequenceNumber`

Conservé comme métadonnée.

Il ne doit pas créer de conflit backend.

### `baseServerSequenceNumber`

Conservé dans le payload de push comme information de debug.

Il ne doit pas provoquer de `409 sequence_conflict`.

---

## 7. Offline/retry

Le comportement offline reste :

- si `navigator.onLine === false`, statut `offline` ;
- si le backend ne répond pas, statut `retrying` ;
- les transactions restent pending ;
- retry après délai ;
- aucune transaction locale n'est supprimée à cause d'une erreur réseau.

---

## 8. Statuts de sync front

Statuts V0 attendus :

```txt
local_only
pending
syncing
synced
offline
retrying
error
```

Statuts supprimés de la V0 :

```txt
session_required
lease_lost
read_only_due_to_session
```

---

## 9. Chargement d'une jam

Au chargement :

1. le front charge la jam depuis le backend ;
2. il récupère snapshot éventuel + transactions/events ;
3. il rejoue l'event log ;
4. il hydrate le store local ;
5. il affiche le tableau éditable.

Il ne fait pas :

- acquire session ;
- heartbeat ;
- takeover ;
- release.

---

## 10. V1 repoussée

Les client sessions sont une fonctionnalité V1 possible.

La V1 pourra réintroduire un document de sync dédié avec :

- `JamClientSession` ;
- lease ;
- heartbeat ;
- takeover ;
- lecture seule multi-device ;
- protection stricte des writes.

Aucune logique V1 ne doit être nécessaire pour livrer la V0.
