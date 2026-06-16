# V0 — Sync locale/offline sans client sessions

## Décision produit

Pour la V0, Confiture.live ne gère plus de client sessions.

Cela veut dire :

- pas de lease d'édition ;
- pas de `leaseToken` ;
- pas de heartbeat ;
- pas de reprise de contrôle / takeover ;
- pas de blocage multi-device ;
- pas de mode lecture seule parce qu'un autre navigateur aurait ouvert la jam ;
- pas de modèle backend `JamClientSession` ;
- pas de table backend `jams_jamclientsession` ;
- pas d'endpoints `/client-session/*` ;
- pas de stockage local de session dans IndexedDB.

Le backend V0 accepte toutes les transactions structurellement valides, quel que soit le device ou le navigateur qui les envoie.

La logique de client session est repoussée en V1.

---

## Ce qui reste en V0

La V0 garde une architecture local-first/offline.

Le front continue à :

1. construire une transaction locale ;
2. l'appliquer immédiatement dans la projection locale ;
3. la sauvegarder en IndexedDB ;
4. la marquer pending ;
5. tenter de la pousser vers le backend ;
6. la marquer synced quand le backend répond succès ;
7. réessayer plus tard si le réseau ou le backend est indisponible.

Le backend continue à :

1. stocker les jams ;
2. stocker `JamTransaction` ;
3. stocker `JamEvent` ;
4. stocker éventuellement `JamSnapshot` ;
5. assigner les `serverSequenceNumber` ;
6. garantir l'idempotence par `transactionId` ;
7. renvoyer l'event log pour reconstruire la projection.

---

## Règle de concurrence V0

En V0, plusieurs devices peuvent envoyer des transactions pour la même jam.

Le comportement accepté est simple :

```txt
Ordre final = ordre d'acceptation serveur = serverSequenceNumber ASC
```

Si deux devices ajoutent chacun un participant presque en même temps :

- les deux transactions sont acceptées ;
- le serveur leur attribue des numéros de séquence serveur ;
- la projection finale rejoue les transactions dans cet ordre serveur.

Il n'y a pas de merge intelligent V0, pas de verrouillage, pas de résolution interactive de conflits multi-device.

---

## `clientId` en V0

Le `clientId` est conservé.

Mais il n'a plus aucun pouvoir de verrouillage.

Il sert uniquement à :

- auditer quel navigateur/device a produit une transaction ;
- debugger la sync ;
- conserver une trace dans `JamTransaction` et `JamEvent` ;
- grouper visuellement les transactions par device si besoin plus tard.

Le backend ne doit pas refuser une transaction parce qu'un autre `clientId` a envoyé une transaction avant.

---

## `clientSequenceNumber` en V0

Le `clientSequenceNumber` est conservé comme métadonnée.

Il ne doit pas bloquer l'acceptation d'une transaction.

Conséquences :

- pas de validation stricte `expectedClientSequenceNumber` côté backend ;
- pas de `409 client_sequence_conflict` ;
- pas de contrainte unique `(jam, client_id, client_sequence_number)` ;
- deux transactions différentes peuvent avoir le même `clientSequenceNumber` si le client a été réinitialisé ou si un bug local survient.

La seule idempotence fiable en V0 est `transactionId`.

---

## `baseServerSequenceNumber` en V0

Le `baseServerSequenceNumber` peut rester dans le payload.

Il sert uniquement d'information de debug :

```json
{
  "baseServerSequenceNumber": 42
}
```

Le backend ne doit pas refuser une transaction parce que `baseServerSequenceNumber` est inférieur au dernier numéro serveur.

Donc on supprime la logique :

```txt
409 sequence_conflict parce que le serveur possède déjà des events inconnus du client
```

En V0, si le serveur a déjà avancé, il accepte quand même la transaction et lui attribue les prochains `serverSequenceNumber` disponibles.

---

## Payload transaction V0

### Requête

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

### Interdit en V0

```json
{
  "leaseToken": "lease_abc"
}
```

Le front ne doit plus envoyer `leaseToken`.
Le backend ne doit plus attendre `leaseToken`.

---

## Réponse transaction V0

```json
{
  "status": "accepted",
  "transactionId": "transaction_abc",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 44,
  "latestServerSequenceNumber": 44
}
```

Si la transaction existe déjà :

```json
{
  "status": "already_accepted",
  "transactionId": "transaction_abc",
  "serverSequenceNumberStart": 43,
  "serverSequenceNumberEnd": 44,
  "latestServerSequenceNumber": 44
}
```

---

## Erreurs supprimées en V0

Ces erreurs ne doivent plus être produites par le flow transaction V0 :

```txt
No active client session for this jam
inactive_client_session
expired_client_session
jam_locked_by_other_client
Invalid lease token
Lease token is required
client_sequence_conflict
sequence_conflict lié au baseServerSequenceNumber
```

Les erreurs restantes sont des erreurs structurelles :

- jam introuvable ;
- transaction mal formée ;
- event mal formé ;
- type d'event non autorisé ;
- payload JSON invalide ;
- transactionId déjà utilisé pour une autre jam.

---

## UI V0

Supprimer toute UI liée aux client sessions :

- alerte “jam ouverte ailleurs” ;
- bouton “Reprendre le contrôle” ;
- mode lecture seule à cause d'une session active ailleurs ;
- message “session d'édition perdue” ;
- blocage des actions parce qu'aucun lease n'est actif.

La page jam est éditable dès qu'elle est chargée correctement.

Les seuls blocages UI restants sont des blocages métier :

- jam introuvable ;
- chargement en cours ;
- action impossible sur card jouée/verrouillée selon les règles métier ;
- erreur réseau affichée par la sync locale/offline.

---

## IndexedDB V0

La sync locale/offline reste.

Tables attendues :

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

## V1 — client sessions repoussées

La V1 pourra réintroduire :

- `JamClientSession` ;
- lease actif ;
- heartbeat ;
- takeover ;
- lecture seule si une autre session édite ;
- protection stricte contre l'édition concurrente.

Mais rien de cela ne doit bloquer la V0.
