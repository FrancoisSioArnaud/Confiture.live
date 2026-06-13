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

## Rounds persistés

La refonte des rounds ajoute une couche persistée entre `ParticipantEntry` et les plateaux.

- `ParticipantEntry` reste l'inscription stable d'un participant à un instrument dans une jam. Elle porte l'ordre de base (`base_order`), mais ne porte plus la notion de lien, de round ou de joué.
- `RoundSlot` représente une occurrence jouable précise : une `ParticipantEntry` pour un `round_number`, ou un trou volontaire (`slot_type="hole"`). `round_number` est le n-ième round métier de cette participation ; `display_order` est l'ordre réel affiché dans la colonne et peut être déplacé indépendamment du round.
- `SlotLinkGroup` lie des `RoundSlot` précis. Le lien est donc ponctuel : lier Nicolas/Guitare/round 1 à Léa/Chant/round 1 ne lie pas automatiquement leurs rounds suivants.
- `Plateau` représente les `RoundSlot` réellement joués ensemble. L'historique ne dépend plus d'un `line_index` stocké.

`Hole`, `LinkGroup` et `PlayedPassage` sont désormais legacy après la migration de données. Ils restent dans le schéma pour compatibilité et migration, mais les nouvelles écritures métier doivent utiliser `RoundSlot`, `SlotLinkGroup` et `Plateau`. Une migration future pourra supprimer ces modèles legacy.

La migration crée un `RoundSlot` round 1 pour chaque ancienne `ParticipantEntry`, convertit les anciens `Hole` en slots de type `hole`, convertit les anciens `LinkGroup` en `SlotLinkGroup`, marque les slots joués à partir des anciens `PlayedPassage`, puis crée les `Plateau` par groupe legacy `jam + line_index`. Pour un plateau migré, `played_at` est l'horodatage le plus ancien du groupe legacy afin d'avoir une règle stable.
