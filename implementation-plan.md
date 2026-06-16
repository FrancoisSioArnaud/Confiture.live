# Implementation Plan — V0 no client sessions

## Objectif

Simplifier la V0 en supprimant totalement les client sessions tout en conservant la sync locale/offline.

## Étapes

1. Backend : supprimer `JamClientSession`, service sessions, serializers/admin/tests/endpoints associés.
2. Backend : modifier `accept_transaction` pour ne plus exiger de lease et ne plus valider strictement `clientSequenceNumber`.
3. Backend : ne plus refuser une transaction à cause de `baseServerSequenceNumber` obsolète.
4. Backend : supprimer les endpoints `/client-session/*`.
5. Frontend : supprimer `clientSession.js`, la table IndexedDB `clientSessions`, les APIs sessions.
6. Frontend : simplifier `syncQueue.js` pour pousser directement `{ clientId, baseServerSequenceNumber, transaction }`.
7. Frontend : simplifier `JamDetailPage.jsx` pour être éditable dès chargement, sans acquire/heartbeat/release/takeover.
8. Frontend : supprimer les statuts `session_required` et `lease_lost`.
9. Tests : remplacer les tests lease/session par tests no-session/multi-device/offline.
10. Docs : référence centrale `docs/v0-sync-no-client-sessions.md`.

## Critère final

Aucune transaction V0 ne doit échouer avec :

```txt
No active client session for this jam
```
