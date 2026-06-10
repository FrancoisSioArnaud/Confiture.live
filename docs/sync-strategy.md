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
5. Si le backend confirme, l'action est marquée `synced`.
6. Si le backend échoue, l'action reste en attente et sera retentée régulièrement.

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
