# Stratégie de synchronisation locale — V0

## Objectif

Pendant une jam, l'organisateur doit pouvoir continuer à travailler même si le backend est lent ou indisponible. L'état local reste donc la source de vérité immédiate et la synchronisation backend devient asynchrone.

## Stockage local Dexie

Le frontend utilise Dexie / IndexedDB avec les tables suivantes :

- `jams` : résumé local des jams consultées ;
- `jamStates` : état complet projetable de la jam courante ;
- `pendingActions` : actions métier en attente de confirmation backend ;
- `syncState` : statut de synchronisation affiché par l'UI.

## Flux d'une action utilisateur

1. L'action est appliquée immédiatement dans le store Zustand via le moteur pur.
2. Le nouvel état de jam est persisté dans `jamStates`.
3. L'action est enregistrée dans `pendingActions` avec son `client_action_id`.
4. Le frontend tente un `POST /api/jams/:id/actions/`.
5. Si le backend confirme, la réponse contient aussi la jam fraîche sérialisée par l'API. Le frontend convertit cette jam en `jamState`, la persiste dans `jamStates` et recharge le store Zustand pour remplacer rapidement les IDs temporaires locaux par les IDs backend réels.
6. L'action confirmée est marquée `synced`.
7. Si le backend échoue, l'action reste en attente et sera retentée régulièrement sans masquer l'erreur backend.

## Chargement d'une jam

Au chargement, le frontend tente d'abord de récupérer la jam depuis l'API. Les actions locales non synchronisées sont rejouées par-dessus la réponse backend pour conserver l'optimisme local.

Si le backend est indisponible, l'app restaure le dernier `jamState` Dexie et affiche un statut de synchronisation dégradé.

## Statuts affichés

- `Synchronisé` ;
- `Synchronisation en attente` ;
- `Hors ligne — sauvegarde locale` ;
- `Erreur de synchronisation`.

## Limites V0

- Pas de résolution avancée de conflit multi-appareil.
- Pas de temps réel.
- Pas d'authentification.
- Le backend reste idempotent via `client_action_id`, ce qui rend les retries sûrs.

## Verrou d'édition V0

À l'ouverture de `/jams/:jamId`, le frontend demande un lock d'édition au backend avec un `client_id` local et un `editing_lock_token` propre à la session. Si une autre session possède déjà un lock actif, l'écran du tableau devient bloquant et affiche :

```text
Cette jam est déjà ouverte en édition sur un autre appareil.
Réessaie plus tard.
```

Le lock est libéré à la fermeture/navigation quand le frontend peut appeler `POST /api/jams/:id/unlock-editing/`. Pour éviter un blocage permanent après crash ou fermeture brutale, le backend autorise la reprise d'un lock expiré après une durée V0 raisonnable.

## Actions sync round-based

Les nouvelles actions local-first synchronisées matérialisent les rounds côté backend :

- `ENSURE_ROUND_SLOTS` crée les `RoundSlot` manquants d'un instrument pour un `roundNumber` donné.
- `MOVE_ROUND_SLOT_VERTICAL` réordonne `display_order` dans une seule colonne et ne modifie pas `round_number`.
- `LINK_ROUND_SLOTS` / `UNLINK_ROUND_SLOTS` manipulent des liens ponctuels entre slots.
- `ADD_ROUND_HOLE` / `REMOVE_ROUND_HOLE` manipulent des trous de round.
- `WANTS_TO_PLAY_WITHOUT_ROUND` crée des trous liés uniquement au round source.
- `MARK_ROUND_SLOT_PLAYED` et `UNDO_ROUND_SLOT_PLAYED` changent le statut d'un slot précis.
- `MARK_PLATEAU_PLAYED` envoie désormais `slotIds`; le backend crée un `Plateau` et marque les slots joués.

Après une synchronisation réussie, le front continue à réconcilier l'état local avec la jam authoritative renvoyée par le backend. La visibilité UI des rounds par colonne est stockée en `localStorage` avec la clé `confiture.visibleRoundDepthByInstrument.${jamId}` et n'est pas persistée en base.
