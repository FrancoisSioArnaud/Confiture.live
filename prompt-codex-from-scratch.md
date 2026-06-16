# Prompt Codex from scratch — Confiture.live V0

Construis/maintiens Confiture.live V0 comme une app local-first/offline sans client sessions.

Ne pas implémenter en V0 :

- `JamClientSession` ;
- lease ;
- heartbeat ;
- takeover ;
- endpoints `/client-session/*` ;
- UI “Reprendre le contrôle” ;
- lecture seule parce qu'un autre device édite.

À implémenter en V0 :

- `Jam`, `JamTransaction`, `JamEvent`, `JamSnapshot` ;
- sync locale/offline ;
- `clientId` gardé comme métadonnée ;
- `clientSequenceNumber` gardé comme métadonnée ;
- `baseServerSequenceNumber` gardé comme debug non bloquant ;
- backend acceptant toutes les transactions valides et les ordonnant par `serverSequenceNumber`.

Lis `docs/v0-sync-no-client-sessions.md` avant toute modification de sync.
