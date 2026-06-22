# Frontend Architecture — V0 sans client sessions

## 1. Objectif

Le frontend Confiture.live V0 est local-first/offline.

Il applique immédiatement les transactions localement, puis les synchronise vers le backend.

La V0 ne contient pas de client sessions, pas de lease, pas de heartbeat et pas de takeover.

---

## 2. Flux page jam

Au chargement d'une page jam :

1. récupérer la jam depuis le backend ;
2. persister le snapshot éventuel + les transactions/events serveur en IndexedDB ;
3. marquer comme `synced` les transactions locales pending revenues du serveur avec le même `transactionId` ;
4. recharger les transactions depuis IndexedDB, en conservant les pending locales non ackées ;
5. reconstruire une projection unique depuis `transactions serveur connues + transactions locales pending` ;
6. hydrater Zustand avec cette projection ;
7. afficher la jam en mode éditable.

Important : `hydrateFromPayload()` ne doit pas projeter durablement `payload.transactions` seules. Après persistance du payload serveur, la projection affichée doit provenir de la base locale pour éviter de masquer une action pending après refresh.

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
3. sauvegarder la transaction dans IndexedDB ;
4. la marquer pending ;
5. relire IndexedDB et relancer le replay de projection, avec resolver d’ordre déterministe après chaque transaction ;
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

L'indicateur de synchronisation doit être abonné à `syncStatusStore`. Il ne doit pas lire le statut une seule fois avec `getSyncStatus()` dans le rendu React, sinon l'UI peut rester bloquée sur “Synchronisation en attente” après un push pourtant accepté par le backend.

La transition attendue après une action est :

```txt
action locale → pending
push en cours → syncing
réponse backend acceptée → markTransactionSynced()
pendingCount = 0 → synced
```

`hydrateFromPayload()` et `hydrateFromServer()` doivent aussi hydrater le statut UI depuis l'état local :

- s'il reste des pending locales non ackées, afficher `pending` ;
- sinon afficher `synced`.

---

## 8. V1

Les client sessions sont repoussées en V1.


---

## 9. Moteur d’ordre déterministe

Le frontend doit contenir un module pur dédié :

```txt
frontend/src/features/projection/orderResolution.js
```

Responsabilité : recalculer l’ordre du tableau après chaque transaction appliquée.

Signature indicative :

```js
resolveOrderAfterTransaction(state, context)
```

Règles :

- le module ne dépend pas de React, MUI, Zustand, Dexie, localStorage ou du DOM ;
- même state + même context = même projection ;
- il applique le solver de contraintes défini dans `docs/order-resolution-hierarchy-spec.md` ;
- il protège `played` et `locked` comme des cards fixes ;
- il conserve l’intention de la dernière action autant que possible ;
- il construit les groupes de links et les conflicts actifs ;
- il répare collisions, links désalignés et conflicts jusqu’à stabilité ou warning ;
- il propage la priorité quand une card poussée est elle-même linkée ;
- il minimise les déplacements et utilise base order / id stable seulement en fallback ;
- il ne doit jamais utiliser le round comme contrainte d’ordre.

Le store frontend ne doit pas coder une logique d’ordre concurrente dans les composants du tableau. Les composants UI doivent seulement construire des transactions et afficher la projection résolue.
