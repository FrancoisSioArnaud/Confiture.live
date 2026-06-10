# Modèle de données V0

Confiture V0 utilise Django comme source distante et un état local Dexie côté frontend pendant une jam. Les noms ci-dessous correspondent aux modèles backend et aux tables locales principales.

## Backend Django

- `Jam` : nom, date indicative optionnelle, timestamps et verrou d’édition V0 (`editing_locked_by`, `editing_locked_at`, `editing_lock_token`).
- `Instrument` : colonne de tableau appartenant à une jam, avec `name`, `order` et `is_default`.
- `Participant` : musicien unique dans une jam, avec statut `active` ou `left`; le couple `jam + name` est unique.
- `ParticipantEntry` : participation instrumentale d’un participant dans une colonne, avec `base_order` propre à cette colonne et label custom optionnel.
- `Hole` : trou volontaire dans une colonne, positionné par action métier et linkable.
- `LinkGroup` : groupe liant plusieurs participations et/ou trous qui doivent être alignés.
- `PlayedPassage` : historique figé d’une participation ou d’un trou joué sur une ligne.
- `ClientAction` : journal idempotent des actions frontend, indexé par `client_action_id`, avec statut `pending`, `synced` ou `failed`.

## État frontend projeté

Le frontend convertit le détail API en `jamState` JavaScript minimal, puis `projectJamTable(jamState)` produit les colonnes, lignes, cellules et stats consommées par l’UI. Les actions utilisateur passent par `applyJamAction()` localement, puis sont enregistrées dans la queue de synchronisation.

## Persistance locale

Dexie contient :

- `jams` : métadonnées de jams.
- `jamStates` : dernier état local complet d’une jam.
- `pendingActions` : actions non encore confirmées par le backend.
- `syncState` : statut affichable par l’UI (`synced`, `pending`, `offline`, `error`).

## Limite V0

Les identifiants créés localement avant confirmation backend restent optimistes. La V0 s’appuie sur l’idempotence backend et le verrou d’édition; la résolution de conflit multi-appareil et une vraie table de correspondance d’identifiants locaux/distants restent hors périmètre.
