# Implementation Audit — V0 no client sessions

Ce document remplace les anciennes notes d'audit sur le lease V0.

Décision actuelle : les client sessions ne font plus partie de la V0.

## À considérer obsolète

- backend imposant une session active ;
- endpoints acquire/heartbeat/release/takeover ;
- UI takeover ;
- tests lease ;
- erreurs `No active client session for this jam`.

## Cible V0

- transactions acceptées sans lease ;
- multi-device accepté ;
- ordre final par `serverSequenceNumber` ;
- sync locale/offline conservée ;
- client sessions déplacées en V1.
