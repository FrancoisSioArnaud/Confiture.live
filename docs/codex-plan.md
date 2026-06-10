# Plan Codex V0

## Décisions verrouillées

- Frontend React + JavaScript + MUI, sans TypeScript.
- Backend Django + DRF avec app principale `jams`.
- Moteur de tableau pur dans `frontend/src/features/jamTable/engine/`.
- Synchronisation local-first avec Dexie et actions idempotentes via `client_action_id`.
- Drag and drop vertical uniquement, déclenché par long press.
- V0 sans auth, toutes les jams visibles, édition simultanée bloquée par verrou.

## Ordre de correction maintenu

1. Sécuriser les actions backend et la queue sync pour ne jamais traiter une action refusée comme synchronisée.
2. Aligner les payloads frontend/API, notamment plateau joué et instruments de jam.
3. Compléter les parcours V0 les plus visibles : édition rapide participant, instruments custom, états de sync.
4. Nettoyer le code mort et maintenir les docs produit/techniques à jour.
5. Renforcer les tests moteur, API, sync et UI à chaque évolution métier.

## Points à arbitrer après V0

- Correspondance durable entre identifiants optimistes locaux et identifiants backend.
- Mode lecture seule multi-appareil.
- Résolution de conflits et/ou temps réel.
- Virtualisation si les tableaux deviennent très longs.
