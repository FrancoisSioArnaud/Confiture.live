# Confiture.live — Sync Strategy V0

## 1. Objectif

Confiture.live doit fonctionner comme un service **mobile-first** et **local-first** pour l’organisateur de jam.

La source de vérité métier est une suite ordonnée d’actions/events :

```txt
eventLog = liste ordonnée de JamEvent
```

Le tableau affiché n’est jamais la source de vérité. Il est une **projection déterministe** reconstruite à partir de :

```txt
eventLog + snapshot éventuel = projection courante
```

Objectifs de la stratégie de synchronisation :

- permettre à l’organisateur de continuer à utiliser l’outil même avec une connexion instable ;
- sauvegarder les actions au serveur régulièrement, idéalement après chaque action UI ;
- permettre au front de récupérer la jam plus tard et de reconstruire exactement le même état ;
- garder un historique complet et auditable ;
- éviter les conflits de merge en V0 grâce à une règle simple : **un seul client actif par jam en temps réel**.

---

## 2. Principe général

Chaque action UI validée produit une **transaction**.

Une transaction peut contenir un ou plusieurs events.

Exemples :

```txt
Créer un participant avec chant + guitare
→ transaction_1
  - participant_created
  - participation_added chant
  - participation_added guitare
  - conflict_created si nécessaire
```

```txt
Créer un “jouer sans batterie”
→ transaction_2
  - hole_added dans la colonne batterie
  - link_created entre l’appearance du musicien et le hole
```

```txt
Undo de la dernière action active
→ transaction_3
  - transaction_reverted targetTransactionId=transaction_2
```

Le client applique immédiatement la transaction localement, met à jour la projection, puis tente de pousser la transaction au serveur.

---

## 3. Source de vérité

### 3.1 Source de vérité principale

La vérité principale est :

```txt
JamEvent ordonnés par sequenceNumber
```

Le serveur ne doit pas considérer la projection envoyée par le client comme vérité principale.

### 3.2 Snapshot

Le snapshot est une optimisation.

Il sert à accélérer le reload et à éviter de rejouer toute la jam depuis le début.

Il ne remplace jamais l’eventLog.

Recommandation V0 :

```txt
Backend = eventLog + dernier snapshot client validé
Frontend = eventLog local + snapshot local + projection en mémoire
```

---

## 4. Granularité de synchronisation

La synchronisation se fait par **transaction**, pas par event individuel.

Pourquoi :

- une action UI peut produire plusieurs events ;
- l’undo cible une transaction complète ;
- le serveur doit accepter ou refuser l’action complète, pas un morceau ;
- cela évite des états intermédiaires incomplets.

Règle :

```txt
Après chaque transaction UI, le client tente de pousser les nouvelles transactions au serveur.
```

Implémentation recommandée :

```txt
Push immédiat après chaque transaction, avec debounce court 300–500 ms.
```

Le debounce évite une rafale de requêtes si plusieurs actions sont faites rapidement, sans rendre la sauvegarde perceptiblement lente.

---

## 5. Données envoyées au serveur

Le client ne doit pas envoyer tout l’eventLog complet à chaque action.

Il envoie uniquement les nouvelles transactions depuis le dernier `serverSequenceNumber` confirmé.

### 5.1 Payload recommandé

En V0, le push serveur est **unitaire par transaction**. La queue locale peut contenir plusieurs transactions pending, mais le client les envoie une par une, dans l’ordre, vers `POST /api/jams/:jamId/transactions/`.

Le debounce court reste autorisé côté client pour éviter une rafale de tentatives, mais il ne transforme pas le contrat API en batch.

```js
{
  "clientId": "client_abc",
  "leaseToken": "lease_abc",
  "baseServerSequenceNumber": 42,
  "transaction": {
    "transactionId": "transaction_100",
    "clientTransactionSequenceNumber": 18,
    "createdAt": "2026-06-14T18:00:00.000Z",
    "schemaVersion": 1,
    "events": [
      {
        "eventId": "event_100_1",
        "type": "participation_added",
        "payload": {},
        "clientSequenceNumber": 143,
        "schemaVersion": 1
      }
    ]
  }
}
```

Règle d’identité session :

```txt
clientSessionId = identifiant stable de session, stocké pour audit dans JamTransaction/JamEvent.
leaseToken = jeton de lease présenté aux endpoints d’écriture et validé par le backend.
```

Le client ne choisit pas le `clientSessionId` durable à partir du `leaseToken`. Le serveur valide le `leaseToken`, retrouve la session active, puis persiste le `clientSessionId` associé dans les transactions/events acceptés.

### 5.2 `baseServerSequenceNumber`

Le client indique le dernier event serveur connu.

Le serveur accepte uniquement si :

```txt
baseServerSequenceNumber == latestServerSequenceNumber de la jam côté serveur
```

Si ce n’est pas vrai, le serveur refuse et demande un reload/resync.

---

## 6. Ordre et séquence

Le déterminisme dépend de l’ordre strict.

### 6.1 Côté client

Le client génère :

```txt
clientSequenceNumber
clientTransactionSequenceNumber
```

Ces numéros servent à ordonner les événements en local avant confirmation serveur.

### 6.2 Côté serveur

Le serveur assigne :

```txt
serverSequenceNumber
serverTransactionSequenceNumber
```

Règle :

```txt
Le serveur assigne les sequenceNumbers dans l’ordre exact de réception validée.
```

### 6.3 Trou de séquence

Si le serveur reçoit une transaction qui ne suit pas la dernière séquence connue, il refuse.

Exemple :

```txt
Serveur attend la suite après 42.
Client envoie baseServerSequenceNumber=40.
→ refus, resync obligatoire.
```

Réponse recommandée :

```js
{
  status: "rejected",
  reason: "sequence_conflict",
  latestServerSequenceNumber: 42
}
```

---

## 7. Client actif unique par jam

En V0, il peut y avoir **un seul client actif en temps réel** pour une jam.

Cela évite :

- merge concurrent ;
- branches d’eventLog ;
- conflits offline complexes ;
- résolutions métier imprévisibles en pleine jam.

---

## 8. Client session / lease serveur

Le serveur maintient une session active par jam.

Nom recommandé :

```txt
JamClientSession
```

Champs principaux :

```txt
jamId
activeClientId
clientSessionId
leaseExpiresAt
lastHeartbeatAt
status
```

### 8.1 Acquisition du contrôle

Quand un organisateur ouvre une jam en mode édition :

```txt
POST /api/jams/:jamId/client-session/acquire/
```

Le serveur répond :

- `acquired` si aucun client actif ;
- `acquired` si le lease précédent est expiré ;
- `jam_locked_by_other_client` si un autre client est actif ;
- `jam_locked_by_other_client` avec `canForceTakeover: true` si l’UI peut proposer “Reprendre le contrôle”.

Endpoints associés :

```txt
POST /api/jams/:jamId/client-session/heartbeat/
POST /api/jams/:jamId/client-session/release/
POST /api/jams/:jamId/client-session/takeover/
```

### 8.2 Heartbeat

Le client actif renouvelle son lease régulièrement.

Recommandation :

```txt
heartbeat toutes les 10 secondes
lease expiration après 30 secondes sans heartbeat
```

Ces valeurs peuvent être ajustées, mais elles donnent un bon compromis mobile : assez rapide pour récupérer la main, assez tolérant pour une connexion instable.

### 8.3 Deuxième client

Si un deuxième client ouvre la même jam :

```txt
Mode lecture seule par défaut.
Bouton “Reprendre le contrôle”.
```

Si l’ancien client est toujours actif, l’UI doit demander confirmation.

### 8.4 Retour d’un ancien client après expiration

Si un ancien client revient après avoir perdu son lease et qu’un autre client a pris la main :

```txt
L’ancien client passe en lecture seule.
Il ne pousse pas ses transactions locales.
Il doit recharger depuis le serveur.
```

Pas de merge automatique en V0.

---

## 9. Fonctionnement offline / réseau instable

Si le réseau tombe, l’organisateur doit pouvoir continuer à utiliser la jam.

Règle :

```txt
Une action UI validée est appliquée immédiatement en local.
Si la sync échoue, la transaction reste dans la queue locale pending.
```

Le client doit maintenir :

```txt
pendingTransactions
lastSuccessfulSyncAt
lastKnownServerSequenceNumber
syncStatus
```

### 9.1 États de sync UI

L’UI doit rester rassurante, même en cas de désynchronisation.

Statuts recommandés :

```txt
synced
syncing
pending
offline_pending
sync_warning
readonly
blocked_by_other_client
```

Libellés recommandés :

```txt
synced → “Sauvegardé”
syncing → “Sauvegarde…”
pending → “Sauvegarde en attente”
offline_pending → “Hors ligne — vos actions sont gardées sur cet appareil”
sync_warning → “Sauvegarde en attente — vos actions sont gardées sur cet appareil”
readonly → “Lecture seule”
blocked_by_other_client → “Lecture seule — jam active sur un autre appareil”
```

Important : le message offline/pending doit être **positif**.

À éviter :

```txt
Erreur critique
Données perdues
Synchronisation impossible
```

À préférer :

```txt
Vos actions sont gardées sur cet appareil et seront sauvegardées dès que possible.
```

### 9.2 Après plusieurs échecs de sync

Ne pas créer un nouvel état plus alarmant après plusieurs tentatives échouées.

Règle :

```txt
Un échec ou plusieurs échecs de sync gardent le même état “warning sympathique”.
```

L’UI ne bloque pas l’organisateur.

Le système continue à réessayer automatiquement.

---

## 10. Retry strategy

Le client doit réessayer de synchroniser les transactions pending.

Recommandation :

```txt
1ère tentative : immédiate
Puis retry avec backoff léger : 1s, 2s, 5s, 10s, puis toutes les 10s
```

Ne pas afficher une snackbar à chaque échec.

Un indicateur discret dans le header suffit.

---

## 11. Succès de sync

Quand une sync réussit :

- le serveur retourne les `serverSequenceNumber` assignés ;
- le client marque les transactions comme `synced` ;
- le client met à jour `lastKnownServerSequenceNumber` ;
- le client peut générer ou mettre à jour un snapshot local.

Réponse recommandée :

```js
{
  status: "accepted",
  latestServerSequenceNumber: 48,
  acceptedTransactions: [
    {
      transactionId: "transaction_100",
      serverTransactionSequenceNumber: 44,
      events: [
        {
          eventId: "event_100_1",
          serverSequenceNumber: 48
        }
      ]
    }
  ]
}
```

Pas de snackbar systématique pour chaque sync réussie.

---

## 12. Sync refusée

Le serveur refuse une sync dans les cas suivants :

```txt
sequence_conflict
inactive_client_session
expired_client_session
jam_locked_by_other_client
unknown_jam
schema_version_unsupported
invalid_event_type
invalid_payload_shape
```

### 12.1 `sequence_conflict`

Le client doit :

```txt
1. arrêter de pousser ses pending transactions ;
2. passer en lecture seule ou état resync nécessaire ;
3. recharger l’eventLog serveur ;
4. reconstruire la projection.
```

Pas de merge automatique en V0.

### 12.2 `inactive_client_session` / `expired_client_session` / `jam_locked_by_other_client`

Le client n’est plus le client actif, son lease a expiré, ou la jam est verrouillée par un autre client.

Il doit :

```txt
1. passer en lecture seule ;
2. indiquer que la jam est active ailleurs ;
3. proposer “Reprendre le contrôle” si pertinent.
```

### 12.3 Payload invalide

Si un payload est invalide, c’est une erreur de code.

L’UI peut afficher :

```txt
Action non sauvegardée. Rechargez la jam si le problème persiste.
```

Le détail technique doit aller dans les logs, pas dans l’UI organisateur.

---

## 13. Pull / récupération depuis le serveur

Au chargement d’une jam, le client doit récupérer :

```txt
Jam metadata
JamClientSession status
Dernier snapshot serveur disponible
Events après le snapshot
latestServerSequenceNumber
```

Endpoint recommandé :

```txt
GET /api/jams/:jamId/full-state/
```

Réponse recommandée :

```js
{
  jam: {
    jamId: "jam_123",
    name: "Jam du jeudi",
    date: "2026-06-14",
    status: "active",
    latestServerSequenceNumber: 142
  },
  session: {
    mode: "editable",
    clientSessionId: "session_456",
    leaseExpiresAt: "2026-06-14T18:05:00.000Z"
  },
  snapshot: {
    snapshotId: "snapshot_9",
    lastServerSequenceNumber: 120,
    state: {}
  },
  events: [
    {
      eventId: "event_121",
      serverSequenceNumber: 121,
      type: "appearance_locked",
      payload: {}
    }
  ]
}
```

Si aucun snapshot n’existe, le serveur renvoie tout l’eventLog.

---

## 14. Snapshot strategy

### 14.1 Client snapshot local

Le client doit conserver un snapshot local persistant.

Utilité :

- reload rapide ;
- usage offline ;
- reprise après fermeture du navigateur ;
- réduction du temps de projection.

Stockage recommandé : IndexedDB.

### 14.2 Snapshot serveur

En V0, le serveur peut stocker un snapshot envoyé par le client.

Le snapshot serveur est :

```txt
cache optimisé
pas source de vérité
lié à lastServerSequenceNumber
```

### 14.3 Quand envoyer un snapshot serveur

Pas besoin d’envoyer un snapshot à chaque action.

Recommandation :

```txt
Envoyer un snapshot toutes les 20 transactions syncées
ou lors de la fermeture/reload si possible
ou quand l’eventLog dépasse un seuil raisonnable.
```

Le serveur doit refuser un snapshot si :

```txt
snapshot.lastServerSequenceNumber > latestServerSequenceNumber accepté pour cette jam
```

En V0, le backend peut ne conserver que le snapshot valide le plus récent par jam. Un snapshot plus ancien reste conceptuellement valide, mais il peut être ignoré ou remplacé par une stratégie de cache simple.

---

## 15. Undo et sync

L’undo est une transaction normale contenant un event `transaction_reverted`.

Règle validée : undo linéaire.

```txt
Pour undo une transaction 4, les transactions 5, 6, 7 actives doivent avoir été undo avant.
```

Donc il n’y a pas de transaction ultérieure active dépendant d’une transaction plus ancienne undo.

### 15.1 Undo d’une transaction déjà syncée

Autorisé.

Le client ajoute :

```txt
transaction_reverted
```

Le serveur ne supprime jamais les events de la transaction originale.

La projection ignore la transaction revertée.

### 15.2 Suppression physique interdite

Ne jamais supprimer l’historique pour faire un undo.

---

## 16. Estimation du volume de données

Pour une jam d’environ **150 actions UI** :

- si on parle de 150 transactions simples, cela représente souvent environ **150 à 250 events** ;
- si plusieurs actions contiennent plusieurs events, cela peut monter vers **250 à 400 events**.

Taille moyenne estimée d’un event JSON avec metadata + payload :

```txt
0,7 KB à 2 KB non compressé
```

Donc ordre de grandeur :

```txt
150 events → environ 100 à 300 KB non compressés
250 events → environ 175 à 500 KB non compressés
400 events → environ 280 à 800 KB non compressés
```

Avec compression HTTP gzip/br :

```txt
souvent 4x à 8x plus petit
```

Estimation réaliste back → front pour une jam de 150 actions :

```txt
EventLog seul : 30 à 150 KB compressés
EventLog + snapshot : 60 à 250 KB compressés selon richesse de projection
```

Conclusion :

```txt
Le volume est très raisonnable pour mobile.
Même une jam assez longue devrait rester largement sous 1 MB compressé.
```

La priorité n’est donc pas la taille brute, mais :

- ordre déterministe ;
- reprise offline ;
- queue pending fiable ;
- validation de séquence ;
- snapshots pour accélérer le reload.

---

## 17. Endpoints recommandés V0

### 17.1 Charger une jam

```txt
GET /api/jams/:jamId/full-state/
```

Renvoie metadata, session, snapshot, events après snapshot.

### 17.2 Acquérir une session active

```txt
POST /api/jams/:jamId/client-session/acquire/
```

### 17.3 Heartbeat

```txt
POST /api/jams/:jamId/client-session/heartbeat/
```

### 17.4 Reprendre le contrôle

```txt
POST /api/jams/:jamId/client-session/takeover/
```

Avec confirmation UI si un autre client est actif.

### 17.5 Pousser des transactions

```txt
POST /api/jams/:jamId/transactions/
```

### 17.6 Envoyer un snapshot

```txt
POST /api/jams/:jamId/snapshots/
```

---

## 18. Validation serveur V0

Le serveur ne recalcule pas toute la projection métier en V0.

Il valide seulement :

```txt
jamId valide
leaseToken valide et session client active
baseServerSequenceNumber correct
transactionId unique
eventId unique
type autorisé
schemaVersion supportée
payload JSON valide structurellement
ordre client cohérent
```

Le serveur ne doit pas valider en V0 toutes les contraintes complexes :

- link possible ;
- conflict respecté ;
- déplacement valide ;
- locks ;
- played ;
- rounds.

Ces règles sont appliquées côté client par la projection et les reducers.

Raison :

```txt
Un seul client actif en V0 limite les risques.
La validation complète serveur peut venir plus tard.
```

---

## 19. État de sync dans l’UI

Emplacement recommandé : header de la page jam.

Format : discret, positif, non anxiogène.

États :

```txt
Sauvegardé
Sauvegarde…
Hors ligne — gardé sur cet appareil
Sauvegarde en attente — gardé sur cet appareil
Lecture seule
```

Règle :

```txt
Pas de snackbar pour chaque sync réussie.
Pas de blocage en cas d’échec réseau.
Pas d’état de panique après plusieurs échecs.
```

Si le client perd le contrôle de la session :

```txt
Afficher un état lecture seule clair.
Proposer Reprendre le contrôle.
```

---

## 20. Règles Codex importantes

Codex doit respecter ces règles :

```txt
1. Ne jamais modifier la projection comme source durable.
2. Toute action persistante doit produire une transaction.
3. Toute transaction doit produire au moins un JamEvent.
4. Le client applique localement avant la sync.
5. Le serveur stocke l’eventLog comme vérité principale.
6. Le snapshot est un cache, jamais la vérité.
7. La sync se fait par transactions depuis le dernier serverSequenceNumber connu.
8. Pas de merge multi-client en V0.
9. Un seul client actif par jam via lease serveur.
10. Undo = transaction_reverted, jamais suppression d’historique.
11. En offline, continuer localement et afficher un feedback positif.
12. En sequence conflict, refuser et demander resync.
```

---

## 21. Points ouverts mineurs

Ces points peuvent être fixés par défaut dans le code si non arbitrés plus tard :

```txt
Lease heartbeat : 10s recommandé.
Lease expiration : 30s recommandé.
Snapshot serveur : toutes les 20 transactions syncées recommandé.
Retry max interval : 10s recommandé.
```

Ces valeurs ne changent pas le modèle métier.
