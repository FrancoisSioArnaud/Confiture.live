# Remaining Work — V0

## Priorité immédiate

| Priorité | Tâche | Zone | Critère d'acceptation |
|---|---|---|---|
| P0 | Supprimer les client sessions V0 | backend + frontend + docs | Plus aucun lease/heartbeat/takeover requis pour pousser une transaction |
| P0 | Accepter toutes les transactions valides | backend transaction API | Transactions multi-device acceptées et ordonnées par `serverSequenceNumber` |
| P0 | Garder la sync locale/offline | frontend sync | Pending/retry/offline fonctionnent sans session |
| P0 | Supprimer `JamClientSession` | backend models/migrations/admin/tests | Modèle/table/endpoints supprimés |
| P1 | Aligner tests V0 | frontend + backend | Tests supprimant les attentes lease et ajoutant les scénarios no-session |

Les tests lease/session/takeover sont déplacés en V1 et ne bloquent pas la V0.
