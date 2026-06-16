# AGENTS.md — Confiture.live

Confiture.live est une application mobile/tablette pour organisateurs de jam sessions.

## Règle V0 importante

La V0 ne contient pas de client sessions.

À respecter dans tout développement V0 :

- ne pas ajouter de lease ;
- ne pas ajouter de heartbeat ;
- ne pas ajouter de takeover ;
- ne pas ajouter d'UI de lecture seule parce qu'un autre device édite ;
- ne pas réintroduire `JamClientSession` ;
- accepter les transactions valides quel que soit le device ;
- garder `clientId` uniquement comme métadonnée d'audit ;
- garder `clientSequenceNumber` uniquement comme métadonnée ;
- garder la sync locale/offline.

Doc source : `docs/v0-sync-no-client-sessions.md`.

## Stack

- Backend : Django + DRF.
- Frontend : React + MUI + JavaScript.
- Sync : event log local-first/offline.
- V0 : SQLite.

## Priorités produit V0

- Tableau de jam utilisable mobile/tablette.
- Participants, participations, appearances, rounds, links, conflicts, holes.
- Projection déterministe depuis les transactions/events.
- Pas de code legacy nécessaire pour client sessions : la base V0 est considérée vide.
