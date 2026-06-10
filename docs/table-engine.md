# Moteur de tableau

Le moteur de tableau frontend est un module JavaScript pur situé dans `frontend/src/features/jamTable/engine/`.
Il transforme un état minimal de jam et une liste d'actions métier en projection exploitable par l'UI, sans importer React, MUI, Zustand, Dexie, le DOM ou l'API backend.

## État minimal

Le moteur manipule les collections suivantes :

- `jam` : métadonnées de la jam (`id`, `name`, `indicativeDate`) ;
- `instruments` : colonnes du tableau triées par `order` ;
- `participants` : musiciens avec un `status` `active` ou `left` ;
- `entries` : participations instrumentales ordonnées par `baseOrder` dans leur colonne ;
- `holes` : trous volontaires avec une `position` dans une colonne ;
- `linkGroups` : groupes alignant des entries et/ou trous sur une même ligne ;
- `playedPassages` : historique figé des passages joués, entry ou trou, avec `lineIndex`.

## Projection

`projectJamTable(jamState)` retourne :

- `columns` : instruments triés ;
- `rows` : lignes de plateau avec une cellule par instrument ;
- `stats` : statistiques principales de la jam.

Chaque cellule est de type `entry`, `hole` ou `empty`. Les cellules `entry` exposent le participant, l'instrument, l'état joué, le prochain musicien jouable, les infos de boucle et le groupe de link. Les cellules `hole` exposent le trou volontaire, son état joué et son groupe de link.

## Règles V0 implémentées

- Les passages joués sont placés en premier à leur `lineIndex` et restent figés comme historique.
- Les participants `left` disparaissent des futurs passages, mais leurs passages joués restent visibles.
- Les entries actives non jouées et les trous non joués sont projetés dans l'ordre de leur colonne.
- Les links alignent les éléments concernés sur la même ligne en remontant les plus en retard vers l'élément le plus avancé, puis en poussant les cartes en conflit.
- Les trous volontaires ne bouclent jamais.
- Les entries actives bouclent après la première rotation ; le premier retour a `loopNumber = 2`, puis `3`, etc.
- La projection ajoute trois lignes de prévisualisation de boucle par colonne active pour garder le tableau exploitable.
- `unplayedActiveEntriesCount` compte les participations instrumentales actives qui n'ont jamais été jouées, indépendamment des boucles futures.

## Actions métier

`applyJamAction(jamState, action)` applique immuablement les actions V0 suivantes :

- `ADD_PARTICIPANT` ;
- `UPDATE_PARTICIPANT` ;
- `MARK_PARTICIPANT_LEFT` ;
- `ADD_PARTICIPANT_ENTRY` ;
- `MOVE_ENTRY_VERTICAL` ;
- `LINK_ITEMS` ;
- `UNLINK_ITEMS` ;
- `ADD_HOLE` ;
- `REMOVE_HOLE` ;
- `WANTS_TO_PLAY_WITHOUT` ;
- `MARK_ENTRY_PLAYED` ;
- `MARK_PLATEAU_PLAYED` ;
- `UNDO_ENTRY_PLAYED` ;
- `REPLACE_UNAVAILABLE`.

`REPLACE_UNAVAILABLE` ne crée pas de statut durable d'indisponibilité : le remplaçant prend la place, le musicien absent est repoussé à la ligne disponible suivante, et les links concernés sont supprimés en supposant que les confirmations UI ont déjà eu lieu.
