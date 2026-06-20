# Projection Engine Spec — Confiture.live

## 1. Objectif

Le moteur de projection est le cœur de Confiture.live.

Il doit reconstruire de manière déterministe l’état complet d’une jam à partir de :

1. un `eventLog` ordonné ;
2. éventuellement un `snapshot` valide ;
3. les transactions non annulées ;
4. la configuration courante de la jam.

Principe non négociable :

```txt
snapshot + events actifs → projection déterministe → tableau affiché
```

La projection est une donnée calculée. Elle ne doit jamais devenir la source de vérité principale. La source de vérité reste l’historique des transactions et des events.

---

## 2. Fichiers de référence

Ce fichier doit être lu avec :

- `product-spec.updated.md` ;
- `technical-stack.updated.md` ;
- `confiture_event_actions_spec.md` ;
- `sync_strategy.md` ;
- `data_model.md` ;
- `visual_spec_table.md` ;
- `visual_spec_table_cards.md` ;
- `event-payloads-reference.md` ;
- `order-resolution-hierarchy-spec.md`.

En cas de conflit, l’ordre de priorité est :

1. `event-payloads-reference.md` pour les payloads ;
2. `order-resolution-hierarchy-spec.md` pour la hiérarchie d’ordre et la résolution des contraintes ;
3. ce fichier pour les règles générales de projection ;
4. `confiture_event_actions_spec.md` pour les règles produit d’action ;
5. les fichiers visuels pour le rendu UI.

---

## 3. Règles générales

### 3.1 Le moteur doit être pur

Le moteur ne doit pas dépendre de React, Zustand, Dexie, MUI, du backend ou du DOM.

Il doit être implémenté comme un module pur :

```js
projectJamState({ snapshot, transactions, events }) => projection
```

Entrée identique = sortie identique.

Aucun `Date.now()`, `Math.random()`, appel réseau ou lecture de stockage local ne doit exister dans le moteur.

---

### 3.2 Les events sont appliqués dans l’ordre strict

Ordre d’application :

```txt
serverSequenceNumber croissant si disponible
sinon clientSequenceNumber croissant
sinon createdAt + eventId uniquement pour fallback debug, jamais pour la logique normale
```

En usage normal, chaque event doit avoir :

```txt
transactionId
clientSequenceNumber
serverSequenceNumber après sync
```

---

### 3.3 Undo linéaire uniquement

L’undo est représenté par un event `transaction_reverted`.

Règle V0 : undo linéaire strict.

Pour annuler la transaction 4, les transactions 5, 6 et 7 doivent déjà avoir été annulées.

La projection ignore les events des transactions annulées.

Il ne doit pas y avoir d’undo arbitraire d’une transaction ancienne si des transactions ultérieures sont encore actives.

---

### 3.4 La projection peut produire des warnings internes

Le moteur doit retourner une liste `projectionWarnings` pour les cas incohérents mais non bloquants.

Exemples :

- event ciblant une entity inexistante ;
- link avec target manquante ;
- conflict devenu inutile après suppression ;
- appearance supprimée puis déplacée par un event ultérieur ignoré ;
- resolver incapable de satisfaire une intention à cause d’un `played` ou `locked`.

Ces warnings sont destinés au debug/admin, pas à l’UI organisateur sauf cas explicitement prévu.

---

### 3.5 Résolution d’ordre après chaque transaction

La projection doit appliquer les transactions dans l’ordre, puis relancer le moteur de résolution d’ordre après chaque transaction active.

Flux obligatoire :

```txt
state initial
→ appliquer events transaction 1
→ resolveOrderAfterTransaction(state, context transaction 1)
→ appliquer events transaction 2
→ resolveOrderAfterTransaction(state, context transaction 2)
→ état final
```

Le resolver doit être déterministe, pur et rejouable depuis zéro. Il ne doit pas dépendre de l’ordre DOM, de React, de Zustand, de Dexie ou d’un cache UI.

Le resolver officiel est spécifié dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

---

### 3.6 Les déplacements induits sont des résultats de projection

Une action peut induire des déplacements en cascade.

Exemple :

```txt
A est déplacé.
A est linké à C.
A conflict avec B.
```

La transaction peut seulement exprimer l’intention principale (`A` déplacé). Le resolver produit ensuite de manière déterministe :

```txt
A reste anchor.
C suit A.
B est repoussé si possible.
```

Ces déplacements induits sont des champs calculés de projection. Ils peuvent être stockés dans un snapshot, mais ne sont pas la source de vérité principale.

---

### 3.7 Champs dérivés d’ordre

La projection peut calculer et conserver des champs comme :

```js
{
  resolvedOrderKey: "...",
  resolvedPlateauIndex: 4,
  playedAtPlateauIndex: 3,
  frozenOrderKey: "...",
  lastManualOrderKey: "..."
}
```

Ces champs doivent être recalculables depuis l’event log. Ils servent à stabiliser l’ordre pendant le replay, notamment pour empêcher une card `played` ou `locked` de bouger lorsqu’une nouvelle card est ajoutée.

---

## 4. Entités projetées

### 4.1 `Participant`

Personne réelle.

```js
{
  participantId: "participant_...",
  name: "Nicolas",
  status: "active" | "left" | "removed",
  createdAtEventId,
  removedAtEventId: null
}
```

Règles :

- `active` par défaut ;
- `left` retire les appearances futures mais garde l’historique joué ;
- `removed` n’est autorisé que si le participant n’a jamais joué.

---

### 4.2 `Participation`

Inscription d’un participant à un instrument.

```js
{
  participationId: "participation_...",
  participantId: "participant_...",
  instrumentId: "instrument_...",
  customInstrumentLabel: null,
  baseOrderKey: "...",
  status: "active" | "removed",
  startAppearanceIndex: 1
}
```

Règles :

- une participation ne représente pas un passage ;
- une participation peut générer plusieurs appearances ;
- le changement d’instrument direct est interdit ;
- changer d’instrument = `participation_removed` + `participation_added`.

---

### 4.3 `Appearance`

Occurrence concrète d’une participation dans un round.

```js
{
  appearanceId: "appearance_...",
  participationId: "participation_...",
  participantId: "participant_...",
  instrumentId: "instrument_...",
  appearanceIndex: 1,
  status: "active" | "removed",
  played: false,
  locked: false,
  materialized: true | false,
  positionKey: "..."
}
```

Règles :

- `appearanceIndex` commence à 1 ;
- round front = appearanceIndex ;
- les appearances sont calculées par défaut ;
- elles sont matérialisées dès qu’une action les cible ;
- ne jamais renuméroter les `appearanceIndex` matérialisés ;
- une appearance supprimée crée un trou logique dans la séquence, mais ne renumérote rien.

---

### 4.4 `Hole`

Occurrence de tableau sans musicien.

```js
{
  holeId: "hole_...",
  instrumentId: "instrument_...",
  appearanceIndex: 1,
  played: false,
  locked: false,
  status: "active" | "removed",
  positionKey: "...",
  reason: "manual" | "play_without" | "call_drawer_without_musician"
}
```

Règles :

- un hole est équivalent à une appearance sans musicien ;
- un hole peut être locké ;
- un hole joué ne peut plus bouger ;
- un hole ne génère jamais de loop future ;
- un hole peut être linké ;
- supprimer un hole ne supprime jamais l’appearance musicien linkée ;
- supprimer un hole supprime ou rend inactifs les links qui ciblent ce hole.

---

### 4.5 `Link`

Contrainte d’alignement entre targets.

```js
{
  linkId: "link_...",
  targets: [
    { type: "appearance", id: "appearance_..." },
    { type: "hole", id: "hole_..." }
  ],
  // pas d’anchor : le link est un groupe non orienté
}
```

Règles :

- un link force les targets à être sur le même plateau ;
- une target maximum par instrument ;
- les links peuvent cibler une appearance ou un hole ;
- aucun drawer de link en V0 ;
- le link est créé/modifié via le mode link du tableau ;
- si un link contredit un conflict, le conflict gagne et le link est refusé.

---

### 4.6 `Conflict`

Contrainte d’incompatibilité.

```js
{
  conflictId: "conflict_...",
  scope: "participation" | "appearance",
  targetIds: ["participation_...", "participation_..."],
  reason: "instrument_constraint" | "manual"
}
```

Règles :

- `scope: participation` = contrainte générale ;
- `scope: appearance` = contrainte ponctuelle ;
- les conflicts V0 ne ciblent pas les holes ;
- `instrument_constraint` est généré automatiquement ;
- `manual` vient du mode conflict du tableau ;
- pas de `conflict_updated` en V0 : retirer puis recréer.

---

### 4.7 `Plateau`

Un plateau est une ligne déduite du tableau.

```js
{
  plateauIndex: 0,
  cells: [
    { instrumentId, targetType: "appearance", targetId: "appearance_..." },
    { instrumentId, targetType: "hole", targetId: "hole_..." }
  ],
  played: false
}
```

Le plateau n’est pas la source de vérité. Il est déduit de l’alignement des colonnes.

---

## 5. Structure de projection attendue

```js
{
  jam: {
    jamId,
    name,
    indicativeDate,
    linkReorderStrategy,
    latestAppliedSequenceNumber
  },
  instruments: {
    byId: {},
    orderedIds: []
  },
  participants: {
    byId: {},
    orderedIds: []
  },
  participations: {
    byId: {},
    byInstrumentId: {}
  },
  appearances: {
    byId: {},
    byParticipationId: {}
  },
  holes: {
    byId: {},
    byInstrumentId: {}
  },
  links: {
    byId: {},
    byTargetKey: {}
  },
  conflicts: {
    byId: {}
  },
  table: {
    columns: [
      {
        instrumentId,
        visibleRoundCount,
        targets: [
          { type: "appearance", id: "appearance_..." },
          { type: "hole", id: "hole_..." }
        ]
      }
    ],
    plateaus: []
  },
  syncMeta: {},
  projectionWarnings: []
}
```

---

## 6. Génération des rounds et appearances

### 6.1 Rounds visibles

Chaque instrument possède un `visibleRoundCount`.

Par défaut :

```txt
visibleRoundCount = 1
```

Quand l’organisateur clique sur “Afficher le round suivant” dans une colonne :

```txt
visibleRoundCount += 1
```

Masquer un round n’est pas prévu en V0.

---

### 6.2 Appearance calculée par défaut

Pour chaque participation active d’un instrument visible, la projection peut générer une appearance calculée pour chaque round visible.

Exemple :

```txt
Participation Nicolas / Guitare
visibleRoundCount guitare = 2
→ appearance Nicolas guitare round 1
→ appearance Nicolas guitare round 2
```

Ces appearances peuvent être virtuelles tant qu’aucune action ne les cible.

---

### 6.3 Appearance matérialisée

Une appearance devient matérialisée si elle est ciblée par :

- `appearance_materialized` ;
- `appearance_moved_between` ;
- `appearance_locked` ;
- `appearance_unlocked` ;
- `appearance_skipped` ;
- `appearance_removed` ;
- `link_created` ;
- `conflict_created` scope appearance ;
- `plateau_played` ;
- `plateau_unplayed`.

Une appearance matérialisée doit conserver son `appearanceId` et son `appearanceIndex`.

---

### 6.4 Ajout standard d’une participation après reveal de plusieurs rounds

En V0, l’ajout d’une participation est toujours standard : pas d’ajout entre deux cards.

```txt
La participation démarre au round 1.
Pour chaque round déjà visible de l’instrument, créer/positionner une appearance à la fin de ce round.
Les rounds non visibles restent calculés plus tard.
```

Exemple :

```txt
Round 1 et round 2 sont visibles en guitare.
Julie est ajoutée à la guitare.
→ Julie guitare round 1 est ajoutée en fin de round 1.
→ Julie guitare round 2 est ajoutée en fin de round 2.
→ Julie guitare round 3 sera générée plus tard si round 3 est affiché.
```

Exemple d’ordre attendu :

```txt
Avant : Noé, Iris, Tom, Noé', Iris', Tom'
Ajout de Julie
Après : Noé, Iris, Tom, Julie, Noé', Iris', Tom', Julie'
```

---

### 6.5 Ajout entre deux cards

Hors V0.

Décision : l’ajout entre deux cards est déplacé en V1. La V0 ne doit pas avoir :

- de zone d’insertion entre cards ;
- d’action UI “Ajouter un participant ici” ;
- d’action UI “Ajouter un trou ici” ;
- de création de participation avec `insertionMode = between_targets` ;
- de participation démarrant au round 2+ via gap.

La base de données de V0 n’est pas en production : il n’y a pas besoin de conserver de code legacy pour relire d’anciens events `between_targets`.

---

### 6.6 Tri round-first par instrument

La projection doit trier les cards d’une colonne selon une logique `round-first` :

```txt
appearanceIndex ASC
puis positionInRound ASC
puis id ASC en fallback stable
```

La colonne est indépendante des autres colonnes.

Exemple :

```txt
Chant : Anna, Léo, Maya, Zoé, Anna', Léo', Maya', Zoé'
Guitare : Noé, Iris, Tom, Noé', Iris', Tom'
Batterie : Sam, Nina, Eli, Lou, Max, Sam', Nina', Eli', Lou', Max'
```

`Noé'` vient immédiatement après `Tom`. Il ne doit pas y avoir de lignes vides dans la colonne Guitare pour attendre `Zoé` ou `Max` dans d’autres colonnes.

Règle technique recommandée :

```txt
roundOrderKey = participation.roundOrderKey ou participation.baseOrderKey
appearance.roundOrder = stableOrderValue(roundOrderKey)
appearance.sortRound = appearance.appearanceIndex
```

Tri :

```js
cards.sort((a, b) =>
  (a.appearanceIndex ?? 1) - (b.appearanceIndex ?? 1)
  || (a.roundOrder ?? 0) - (b.roundOrder ?? 0)
  || String(a.id).localeCompare(String(b.id))
)
```

À ne pas faire :

```txt
stableOrderValue(baseOrderKey) * 1000 + appearanceIndex
```

Cette formule groupe chaque participant avec ses passages successifs (`Noé`, `Noé'`, `Iris`, `Iris'`) et viole la spec.

---

## 7. Construction des colonnes

Pour chaque instrument visible :

1. récupérer les participations actives ;
2. exclure les participants `left` pour les futures appearances non jouées ;
3. générer les appearances visibles nécessaires ;
4. appliquer les suppressions d’appearances ;
5. insérer les holes actifs ;
6. appliquer les mouvements manuels ;
7. appliquer les links ;
8. appliquer les conflicts ;
9. respecter les locks et played ;
10. produire la liste finale de targets de la colonne.

---

## 8. Ordre et positionnement

### 8.1 Pas d’index comme vérité durable

Ne jamais utiliser un index brut comme vérité principale pour les déplacements.

Préférer :

```js
previousTarget
nextTarget
positionKey
```

L’index est un résultat de projection, pas une donnée durable fiable.

---

### 8.2 Hiérarchie d’ordre officielle

La hiérarchie d’ordre complète est définie dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

Résumé du plus prioritaire au moins prioritaire :

```txt
0. removed / left / hidden
1. played
2. locked
3. anchor de la dernière action utilisateur
4. décisions d’appel : appearance_skipped / remplacement / faire sans musicien
5. conflict
6. link
7. manual order existant
8. round / appearanceIndex
9. base order
10. fallback stable par id
```

Règles clés :

- `played` est toujours figé et conserve sa position historique ;
- `locked` est figé tant qu’il n’est pas unlock ;
- l’anchor de la dernière action est conservée autant que possible ;
- un conflict gagne contre un link ;
- un link peut déplacer un groupe mobile, mais jamais du played/locked ;
- un manual reorder existant prime sur l’ordre automatique, mais pas sur les contraintes fortes ;
- une action de drag ne doit pas être refusée uniquement parce que la zone contient un link ou un conflict ; elle est acceptée si la card déplacée n’est ni played ni locked, puis le resolver réconcilie le tableau ;
- si une action demande un déplacement réellement impossible à cause de played/locked, elle doit être refusée avant création de l’event, ou ignorée/clampée par projection avec warning si l’event existe déjà.

### 8.3 Recalcul global après modification d’ordre

Toute transaction pouvant modifier l’ordre ou les contraintes doit appeler le resolver après application de ses events.

À minima :

- ajout/retrait participation ;
- drag appearance/hole ;
- création/suppression link ;
- création/suppression conflict ;
- lock/unlock ;
- skip/remplacement depuis drawer d’appel ;
- hole ajouté/supprimé ;
- plateau played/unplayed ;
- round revealed ;
- participant left ;
- instrument hidden/shown.

La suppression d’un link ou d’un conflict ne doit pas provoquer un retour magique à un ancien ordre. Le resolver part de l’ordre résolu courant et ne bouge que ce qui est nécessaire.

---

### 8.3 Effet de `left`

Quand un participant devient `left` :

- ses appearances déjà played restent visibles ;
- ses appearances futures sont retirées de la projection active ;
- aucune nouvelle appearance future n’est générée pour ses participations ;
- si des appearances futures étaient lockées, l’UI doit demander confirmation avant l’action ;
- une fois confirmé, `left` gagne sur le lock pour les futures appearances non jouées.

---

## 9. Links

Un link est un groupe non orienté de targets. Il n’a pas d’anchor et doit contenir au moins deux targets actives. Créer un link avec une target déjà linkée fusionne les groupes concernés ; retirer une target conserve le groupe restant si au moins deux targets restent, sinon le link est supprimé.


### 9.1 Création

Un link est créé via mode link du tableau.

Input logique :

```js
link_created {
  linkId,
  targets,
  reorderStrategy
}
```

La stratégie `reorderStrategy` est copiée depuis la config de jam au moment de l’action.

---

### 9.2 Stratégies de réorganisation

La jam possède une setting :

```txt
linkReorderStrategy:
- move_to_first
- move_to_last
- average_position
```

Défaut :

```txt
move_to_first
```

#### `move_to_first`

Toutes les targets non figées sont alignées sur la ligne la plus haute des targets du link.

#### `move_to_last`

Toutes les targets non figées sont alignées sur la ligne la plus basse des targets du link.

#### `average_position`

Calcul :

```txt
position cible = moyenne des positions actuelles des targets, arrondie vers la position la plus haute en cas d’égalité
```

Exemple :

```txt
positions 2 et 5 → moyenne 3.5 → cible 3
positions 2, 5, 6 → moyenne 4.33 → cible 4
```

Raison : privilégier légèrement la stabilité vers le haut et éviter de trop retarder les musiciens.

---

### 9.3 Contraintes de link

Un link est refusé si :

- deux targets sont dans le même instrument ;
- une target est played et devrait bouger ;
- une target est locked et devrait bouger ;
- un conflict existe directement entre deux targets du link ;
- l’alignement créerait un conflict impossible à résoudre ;
- l’alignement nécessiterait de déplacer une autre card played/locked ;
- une target n’existe plus.

Un drag manuel dans une zone contenant un link n’est pas refusé pour cette seule raison. Si le drag déplace une autre card devant une target linkée, cette target linkée peut changer de plateau et les autres targets du link doivent suivre.

En cas de refus par conflict, l’UI doit afficher une snackbar explicative.

---

### 9.4 Déplacement manuel d’une target linkée

Si une card linkée est déplacée manuellement :

- l’action est autorisée si la card n’est ni `played` ni `locked` ;
- le groupe linké doit se déplacer ensemble dans l’ordre résolu final ;
- si le déplacement du groupe est impossible à cause d’une card `played` ou `locked`, le resolver garde les pins et produit un warning déterministe ;
- aucun déplacement partiel durable du groupe linké n’est autorisé dans la projection finale.

Si une card non-linkée est déplacée avant/après une target linkée :

- l’action est autorisée si la card déplacée n’est ni `played` ni `locked` ;
- le resolver garde le déplacement manuel demandé ;
- la target linkée décalée devient la référence de son groupe pour cette transaction ;
- les autres targets du link suivent cette target décalée.

Exception : `appearance_skipped` depuis le drawer d’appel délinke puis déplace seulement l’appearance indisponible.

---

### 9.5 Suppression de link

`link_removed` relance le resolver, mais ne doit pas provoquer un retour magique à un ancien ordre.

Les cards restent là où elles sont si aucune contrainte active ne les oblige à bouger.

Une future action pourra les réorganiser.

---

## 10. Conflicts

Les conflicts sont non orientés. Le sens de création ne doit pas influencer la résolution du tableau ; seule la dernière action utilisateur, notamment un drag manuel, peut devenir l’intention prioritaire. `anchorTargetId` peut rester présent dans certains payloads legacy ou de trace, mais le resolver ne doit pas s’en servir pour orienter le conflit.


### 10.1 Scope participation

Un conflict scope `participation` signifie que les appearances issues de deux participations ne doivent pas se retrouver sur le même plateau, pour toute la soirée.

Le resolver doit étendre ce conflict à toutes les appearances actives des participations ciblées : appearances déjà visibles, appearances matérialisées plus tard par `round_revealed`, et appearances ajoutées par une nouvelle participation si elle est déjà concernée par un conflict de participation.

Conséquence : si `A` et `C` ont un conflict `scope: participation`, alors `A'` et `C'` doivent être séparés dès que le round suivant est révélé. Cette propagation est une conséquence de projection déterministe ; elle ne nécessite pas un nouvel event `conflict_created` pour chaque round.

Usage typique :

```txt
Nicolas guitare / Nicolas basse
```

Raison :

```txt
instrument_constraint
```

---

### 10.2 Scope appearance

Un conflict scope `appearance` concerne uniquement des passages précis.

Usage :

```txt
Nicolas guitare round 2 ne doit pas jouer avec Sarah chant round 1.
```

Raison :

```txt
manual
```

---

### 10.3 Création de conflict depuis le mode conflict

À la validation, l’UI demande :

```txt
Ce conflit concerne :
- seulement ce passage
- toute la soirée
```

Projection :

- seulement ce passage → `scope: appearance` ;
- toute la soirée → `scope: participation`.

---

### 10.4 Résolution d’un conflict nouvellement créé

Si les targets en conflict sont déjà sur le même plateau :

1. ne jamais bouger `played` ;
2. ne jamais bouger `locked` ;
3. garder l’anchor si possible ;
4. déplacer l’autre target vers le slot valide le plus proche dans sa colonne, en essayant d’abord les slots suivants puis les slots précédents si nécessaire ;
5. si impossible, refuser l’action.

---

### 10.5 Suppression de conflict

`conflict_removed` relance le resolver, mais ne doit pas provoquer un retour magique à un ancien ordre.

Les cards restent là où elles sont si aucune contrainte active ne les oblige à bouger.

Aucun `conflict_updated` en V0.

Modifier un conflict = supprimer puis recréer.

---

## 11. Appearance skipped

`appearance_skipped` remplace la logique “temporarily away”.

Ce n’est pas un état durable.

Déclencheur unique : drawer d’appel, quand le musicien appelé est introuvable.

Effet :

1. si l’appearance est linkée, supprimer/désactiver le link concerné ;
2. repousser uniquement l’appearance skippée au prochain slot valide de sa colonne ;
3. ne pas modifier le participant durablement ;
4. ne pas marquer le participant comme `left` ;
5. ne pas créer d’état `temporarily_away` persistant.

Si un remplaçant est choisi :

- le remplaçant prend le slot de l’appearance skippée ;
- l’appearance skippée est repoussée ;
- si le remplaçant était linké, l’UI doit confirmer le délink avant validation.

Si “Plateau sans [instrument manquant]” est choisi :

- un hole est créé à la place ;
- l’appearance skippée est repoussée ;
- le hole peut être played avec le plateau.

---

## 12. Suppressions

### 12.1 `participant_removed`

Autorisé uniquement si le participant n’a jamais joué.

Si le participant a déjà joué, l’UI doit refuser et suggérer :

```txt
Marquer comme parti
```

Effet autorisé :

- retire le participant de la projection active ;
- retire ses participations non jouées ;
- retire ses appearances futures ;
- les links/conflicts associés sont ignorés ou retirés de la projection.

---

### 12.2 `appearance_removed`

Toujours demander confirmation avant suppression.

Si l’appearance a un link, le dialog doit le préciser.

Effet :

- supprime uniquement cette occurrence ;
- ne supprime pas la participation ;
- ne supprime pas le participant ;
- ne renumérote jamais les appearances matérialisées suivantes ;
- supprime/ignore les links qui ciblaient cette appearance.

---

### 12.3 `hole_removed`

Toujours demander confirmation.

Si le hole a un link, le dialog doit le préciser.

Effet :

- supprime uniquement le hole ;
- ne supprime aucune appearance musicien ;
- supprime/ignore les links qui ciblaient ce hole.

---

### 12.4 `instrument_visibility_changed`

Masquer un instrument ne supprime pas les events historiques.

Effet :

- la colonne n’est plus affichée dans le tableau ;
- l’instrument n’apparaît plus dans le drawer d’appel ;
- l’instrument reste dans l’historique ;
- ses participations/appearances ne sont pas physiquement supprimées ;
- les events restent rejouables ;
- l’UI doit afficher un warning si l’instrument a des links actifs, mais l’action reste autorisée après confirmation.

---

## 13. Holes et jouer sans

### 13.1 Hole manuel

En V0, un hole manuel n’est pas ajouté entre deux cards. Les holes sont créés par les flux `jouer sans` ou drawer d’appel.

Il occupe une position réelle.

Il ne se répète pas dans les rounds futurs.

---

### 13.2 Jouer sans

Il n’y a pas d’event `play_without_created` ni `play_without_removed` en V0.

Jouer sans = transaction composée de :

```txt
hole_added
link_created
```

Exemple :

```txt
Nicolas guitare veut jouer sans batterie
→ hole ajouté dans batterie
→ link entre Nicolas guitare et le hole batterie
```

---

## 14. Plateau played / unplayed

### 14.1 `plateau_played`

Effet :

- toutes les targets du plateau deviennent played ;
- appearances et holes joués deviennent figés ;
- aucune target jouée ne peut être déplacée ;
- les cards restent visibles et grisées ;
- la liste ne remonte pas automatiquement.

`played` vaut lock fonctionnel.

---

### 14.2 `plateau_unplayed`

Reco V0 : autorisé seulement sur le dernier plateau joué.

Effet :

- retire `played` des targets du plateau ;
- ne change pas leur position ;
- les cards redeviennent déplaçables si non lockées.

---

## 15. Validation de projection minimale

Le moteur doit pouvoir exposer des helpers purs :

```js
canCreateLink(projection, targets)
canCreateConflict(projection, targets, scope)
canMoveTarget(projection, target, destination)
canRemoveAppearance(projection, appearanceId)
canMarkParticipantLeft(projection, participantId)
canHideInstrument(projection, instrumentId)
```

Ces helpers doivent être utilisés par l’UI avant de créer les events.

---

## 16. Sortie UI attendue

La projection finale doit permettre au front d’afficher directement :

- les colonnes par instrument ;
- les cards visibles ;
- les rounds visibles ;
- les plateaux déduits ;
- les targets played ;
- les targets locked ;
- les states linkés ;
- les conflicts visibles en mode conflict ;
- les actions autorisées/interdites par card ;
- les remplaçants proposés dans le drawer d’appel.

---

## 17. Non objectifs V0

Ne pas implémenter dans le moteur V0 :

- multi-client merge ;
- temps réel collaboratif ;
- notes ;
- drawer de link ;
- drawer de conflict ;
- `plateau_composition_forced` ;
- suppression physique d’historique ;
- renumérotation des appearances ;
- édition arbitraire d’un event ancien.


## Addendum V0 — contraintes inter-colonnes et résolution post-action

Cette section renforce la règle de résolution d’ordre définie dans `order-resolution-hierarchy-spec.md`.

- Les `links` et les `conflicts` sont uniquement **inter-colonnes** en V0. Ils ne peuvent pas être créés entre deux cards du même instrument.
- Un `conflict` est une contrainte **bidirectionnelle** : le sens `A → C` ou `C → A` ne change pas l’interdiction de cohabitation. Le sens sert seulement à définir l’anchor préférée de la transaction.
- À chaque transaction, le resolver doit vérifier les conflicts actifs dans les deux sens, quelle que soit la colonne touchée par l’action.
- Une card ayant un link ou un conflict reste draggable tant qu’elle n’est ni `played` ni `locked`.
- Un drag qui déplace une card non-linkée dans une zone contenant une target linkée est autorisé : le manual reorder est conservé, puis le groupe linké suit la target linkée décalée.
- Après un drag, le resolver applique les conséquences : les cards linkées suivent la card déplacée ou la target linkée décalée si possible ; les conflicts qui deviennent actifs sur la nouvelle ligne déplacent la card non-anchor vers le slot valide le plus proche.
- Si la card non-anchor conflictuelle ne peut pas descendre, le resolver peut chercher un slot valide au-dessus afin de résoudre immédiatement le conflict sans attendre l’ajout d’une autre participation.
- Aucune résolution induite ne peut déplacer une card `played` ou `locked`.


### Redo linéaire

La projection doit interpréter `transaction_redone` comme une réactivation linéaire d’une transaction undo.

Pipeline :

1. `transaction_reverted` retire uniquement la dernière transaction active ciblée ;
2. cette transaction devient redoable ;
3. `transaction_redone` réactive uniquement la dernière transaction redoable ciblée ;
4. toute nouvelle action métier après un undo invalide la pile redo ;
5. les events undo/redo restent dans l’historique mais ne sont pas appliqués comme events métier.

Le replay de l’event log reste déterministe : l’état final dépend uniquement des transactions actives après résolution undo/redo linéaire.
