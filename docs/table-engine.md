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
- `rows` : lignes de plateau avec une cellule par instrument ; cette projection reste row-first et doit être rendue comme une grille plateau/instrument, pas comme des listes indépendantes par colonne ;
- `stats` : statistiques principales de la jam.

Chaque cellule est de type `entry`, `hole` ou `empty`. Les cellules `empty` sont conservées dans la projection pour préserver l'alignement des plateaux et permettre une insertion à une position donnée. Les cellules `entry` exposent le participant, l'instrument, l'état joué, le prochain musicien jouable, les infos de boucle et le groupe de link. Les cellules `hole` exposent le trou volontaire, son état joué et son groupe de link.

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

`MOVE_ENTRY_VERTICAL` reste une action verticale dans une seule colonne instrument. Le payload existant (`entryId`, `toIndex`) est conservé ; l'UI grille ne change donc pas le contrat métier/backend. Pour les groupes liés, le moteur recalcule ensuite une projection row-first qui maintient les éléments liés sur le même plateau quand ils sont projetables ensemble. La V0 ne définit pas encore une action distincte de déplacement groupé explicite.

## Projection depuis les RoundSlot

Le moteur cible projette la table depuis `roundSlots`, `slotLinkGroups` et `plateaux`.

- Les colonnes prennent leurs `RoundSlot` visibles par instrument.
- Par défaut, chaque colonne affiche `roundNumber <= 1`.
- Un état local `visibleRoundDepthByInstrument` permet d'afficher le round suivant pour une seule colonne, sans impacter les autres instruments.
- Les slots `cancelled` sont exclus ; les slots `played` restent visibles comme historique grisé.
- Le tri principal est `displayOrder`, puis `id`, et non `roundNumber`, afin de permettre un drag d'un round 2 avant un round 1 sans changer la signification métier du round.
- Les `SlotLinkGroup` alignent seulement les slots explicitement liés. Les liens et trous ne sont pas copiés automatiquement aux rounds suivants.
- Le prochain jouable d'une colonne est le premier slot visible `planned` dans l'ordre affiché.

L'ancien preview de boucle reste uniquement comme compatibilité de tests et d'état legacy quand aucun `roundSlots` authoritative n'est présent. Le wording cible de l'UI est `Round 2`, `Round 3`, etc.
