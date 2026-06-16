# Testing Strategy — V0 sans client sessions

## 1. Objectif

Les tests V0 doivent vérifier la sync local-first/offline sans client sessions.

---

## 2. Tests backend attendus

### Transactions acceptées sans lease

`POST /api/jams/:jamId/transactions/` doit accepter une transaction valide sans `leaseToken`.

### Transactions multi-device acceptées

Deux transactions issues de deux `clientId` différents doivent être acceptées dans l'ordre d'arrivée serveur.

### `clientSequenceNumber` metadata only

Deux transactions différentes avec le même `clientId` et le même `clientSequenceNumber` ne doivent pas être refusées pour cette raison.

### `baseServerSequenceNumber` debug only

Une transaction avec `baseServerSequenceNumber` inférieur au dernier numéro serveur doit être acceptée.

### Endpoints client-session supprimés

Les routes suivantes doivent retourner 404 ou ne pas être déclarées :

```txt
/api/jams/:jamId/client-session/acquire/
/api/jams/:jamId/client-session/heartbeat/
/api/jams/:jamId/client-session/release/
/api/jams/:jamId/client-session/takeover/
```

### Modèle supprimé

`JamClientSession` ne doit plus être importable depuis `jams.models`.

---

## 3. Tests frontend attendus

### Sync queue

- pousse une transaction sans session ;
- n'envoie pas `leaseToken` ;
- garde pending en offline ;
- retry en erreur réseau ;
- marque synced sur ack backend.

### Page jam

- ne tente pas `acquireClientSession` au chargement ;
- ne démarre pas de heartbeat ;
- ne libère pas de session au démontage ;
- n'affiche pas `Reprendre le contrôle` ;
- permet les actions dès que la jam est chargée.

### NewJamPage

- crée la jam ;
- ne tente pas d'acquérir une session après création ;
- navigue vers la page jam après succès.

### API client

- `pushTransaction` ne prend plus `leaseToken` ;
- `postSnapshot` ne prend plus `leaseToken` ;
- les fonctions `acquireClientSession`, `heartbeatClientSession`, `releaseClientSession`, `takeoverClientSession` sont supprimées.

---

## 4. Tests supprimés ou déplacés V1

Déplacer/supprimer les tests portant sur :

- lease actif ;
- heartbeat ;
- takeover ;
- expiration de session ;
- `jam_locked_by_other_client` ;
- `lease_lost` ;
- `session_required`.

Ces scénarios appartiennent à une future V1.


---

## 5. Tests moteur d’ordre déterministe

Ajouter des tests frontend purs pour :

```txt
frontend/src/features/projection/orderResolution.js
```

Cas minimaux :

1. même eventLog rejoué deux fois → même projection exacte ;
2. ajout D après `A, B, C, A'` joués → `A, B, C, A', D, B', C', D'` ;
3. drag A sur B avec conflict, B mobile → A reste anchor, B bouge ;
4. drag A sur B avec conflict, B played → action refusée ou warning déterministe ;
5. drag A sur B avec conflict, B locked → action refusée ou warning déterministe ;
6. drag A linké à C → C suit A ;
7. drag A linké à C avec conflict externe mobile → le conflict pousse la card externe ;
8. link direct refusé si conflict direct ;
9. lock empêchant un ajout ultérieur de passer devant ;
10. link_removed ne provoquant pas un retour magique à un ancien ordre ;
11. conflict_removed ne provoquant pas un retour magique à un ancien ordre ;
12. round_revealed respectant played/locked/manual/link/conflict ;
13. replay après undo linéaire produisant un état stable.

Ces tests doivent être indépendants de React et tester le moteur de projection comme une fonction pure.
