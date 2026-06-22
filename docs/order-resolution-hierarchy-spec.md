# V0 — Solver de réorder par contraintes discrètes

Ce document remplace l’ancienne spec de réorder. Il est la référence canonique pour l’ordre des cards du tableau Confiture.live.

Anciennes règles supprimées :

- pas de hiérarchie `anchor > conflict > link > round order` appliquée comme un tri séquentiel ;
- pas de contrainte `round ASC / appearanceIndex ASC` dans l’ordre final ;
- pas de règle disant que le round 1 doit rester entièrement avant le round 2 ;
- pas de résolution limitée à l’anchor ou à ses links directs ;
- pas de retour magique à un ancien ordre quand un link ou conflict est supprimé.

Le round reste une information métier de l’appearance. Il sert à identifier `Nicolas guitare round 1`, `Nicolas guitare round 2`, etc. Il ne sert plus à bloquer ou prioriser l’ordre visuel. Si c’est nécessaire pour satisfaire les contraintes, le solver peut mélanger des appearances de rounds différents dans une même colonne.

---

## 1. Objectif

À partir d’un état projeté brut, le solver produit l’ordre final du tableau :

```txt
state brut + dernière transaction
→ resolveOrderAfterTransaction(state, context)
→ columns résolues + projectionWarnings
```

Le solver doit :

- préserver les cards jouées et verrouillées ;
- aligner les links quand c’est possible ;
- séparer les conflicts quand c’est possible ;
- appliquer l’intention de la dernière action utilisateur ;
- propager les conséquences d’un déplacement à travers les links et les cards poussées ;
- choisir la solution qui déplace le moins possible le tableau ;
- détecter explicitement les états impossibles ;
- rester pur, déterministe et borné.

Même event log + même snapshot + même configuration = même tableau final.

---

## 2. Source de vérité

La source de vérité n’est pas l’ordre React courant ni le DOM.

La source de vérité est :

```txt
eventLog ordonné + transactions actives + configuration de jam
```

La projection rejoue les transactions dans l’ordre :

```txt
état initial
→ appliquer transaction 1
→ résoudre l’ordre
→ appliquer transaction 2
→ résoudre l’ordre
→ appliquer transaction 3
→ résoudre l’ordre
→ état final
```

Les events expriment l’intention utilisateur. Ils ne listent pas forcément tous les déplacements induits par le solver.

Exemple :

```txt
Utilisateur déplace A.
A pousse B.
B est linkée à C.
```

La transaction peut contenir uniquement :

```txt
appearance_moved_between(A, afterTarget, beforeTarget)
```

Le solver doit ensuite dériver :

```txt
A garde au mieux sa position demandée.
B est poussée.
C gagne une priorité indirecte via le link de B.
Les colonnes impactées sont réparées jusqu’à stabilité.
```

---

## 3. Vocabulaire

### Card

Une card ordonnable du tableau :

- `appearance` ;
- `hole`.

Une card reste toujours dans sa colonne instrument. Il n’y a pas de déplacement horizontal manuel.

### Row résolue, visualIndex et plateau affiché

Le solver distingue obligatoirement trois notions.

```txt
resolvedRow = ligne logique entière utilisée par le solver pour links, conflicts, played, locked et collisions.
visualIndex = ligne d’affichage compacte dérivée de resolvedRow à l’échelle du tableau visible.
cardIndexInColumn = ordre local d’une card dans sa colonne, uniquement utile pour mapper/render une liste.
```

`resolvedRow` est la vérité de résolution. Deux cards alignées par link ont le même `resolvedRow`. Deux cards en conflict doivent avoir des `resolvedRows` différents.

`visualIndex` est calculé après résolution par compression globale des `resolvedRows` visibles, pas colonne par colonne. Toutes les cards qui ont le même `resolvedRow` doivent obtenir le même `visualIndex`, même si certaines colonnes n’ont aucune card sur cette ligne.

Donc l’UI ne doit pas définir un plateau comme “la n-ième card de chaque colonne”. Un plateau affiché correspond à un `visualIndex` global. Une cellule vide dans une colonne signifie seulement “aucune card sur ce plateau affiché”, ce n’est pas un hole métier.

Une normalisation visuelle ne doit jamais modifier un `resolvedRow` fixed.

### Fixed card

Une card fixe ne peut pas bouger :

- appearance jouée ;
- hole joué ;
- appearance locked ;
- hole locked.

`played` est historique et définitif. `locked` est une intention organisateur réversible via unlock, mais tant que le lock existe, la card est immobile.

### Link group

Les links sont transformés en groupes par union-find.

```txt
A link B
B link C
→ groupe { A, B, C }
```

Le solver résout le groupe entier, pas seulement des paires isolées.

### Conflict

Un conflict interdit deux targets d’être sur la même row :

```txt
row(A) != row(B)
```

Un conflict est bidirectionnel. Le sens de création ne doit pas orienter le solver.

### Anchor

L’anchor est la card qui porte l’intention principale de la dernière action utilisateur, quand il y en a une.

Exemples :

| Action | Anchor |
|---|---|
| `appearance_moved_between` | appearance déplacée |
| `hole_moved_between` | hole déplacé |
| `participation_added` | nouvelle appearance, ou groupe de nouvelles appearances visibles |
| `hole_added` | nouveau hole |
| `appearance_skipped` | appearance skipped ou replacement/hole créé |
| `plateau_played` | targets figées par le plateau joué |
| `appearance_locked` / `hole_locked` | card verrouillée |
| `link_created` | pas d’anchor directionnelle ; utiliser la stratégie de link |
| `conflict_created` | pas d’anchor directionnelle ; résoudre avec coût minimal |
| `link_removed` / `conflict_removed` | pas d’anchor ; préserver l’ordre courant sauf contrainte restante |
| `instrument_round_visibility_changed` | pas d’anchor forte ; ajouter les appearances puis résoudre |

L’anchor est importante, mais elle ne bat jamais `played` ou `locked`.

---

## 4. Arbitrages canoniques du resolver

Cette section verrouille les décisions d’arbitrage. Le code, les tests et les prompts Codex doivent appliquer ces règles sans réinterprétation.

### 4.1 Hiérarchie exacte des contraintes

Le resolver classe les règles en trois niveaux.

#### Contraintes dures absolues

Ces contraintes ne peuvent jamais être cassées par le solver. Si une action les viole directement, elle doit être refusée avant transaction quand c’est possible. Si un event invalide existe déjà dans l’historique, la projection doit préserver l’invariant et émettre un `projectionWarning`.

```txt
1. Une card reste dans sa colonne instrument.
2. Une colonne visible ne peut pas avoir deux cards sur le même resolvedRow final.
3. Une appearance played ne change jamais de resolvedRow.
4. Un hole played ne change jamais de resolvedRow.
5. Une appearance locked ne change jamais de resolvedRow.
6. Un hole locked ne change jamais de resolvedRow.
```

#### Contraintes dures conditionnelles

Ces contraintes doivent être satisfaites si une solution existe sans casser une contrainte dure absolue.

```txt
7. Les links actifs doivent être alignés sur le même resolvedRow.
8. Les conflicts actifs doivent être séparés sur des resolvedRows différents.
```

Si un link ou conflict ne peut pas être résolu à cause de cards fixed, le solver ne force pas le déplacement. Il garde les cards fixed à leur place et produit un warning déterministe.

#### Contraintes soft

Ces contraintes ne doivent jamais casser une contrainte dure. Elles servent uniquement à choisir la meilleure réparation parmi plusieurs solutions valides.

```txt
9. Respecter l’intention de la dernière action utilisateur.
10. Propager la priorité aux cards poussées et aux groupes linkés concernés.
11. Minimiser le nombre de cards déplacées.
12. Minimiser la distance totale de déplacement.
13. Préserver l’ordre relatif précédent autant que possible.
14. Utiliser un fallback stable par ordre précédent, ordre de création, puis id.
```

Le conflict passe avant l’intention utilisateur : si le dernier drag place deux cards en conflict sur la même row, le solver doit réparer le conflict même si cela éloigne l’anchor de son emplacement idéal.

Le round ne fait partie d’aucun niveau de priorité. Il reste une metadata.

### 4.2 Politique `refus avant transaction` vs `projectionWarning`

Le système doit refuser avant création de transaction les actions manifestement impossibles ou interdites.

Refus obligatoire avant transaction :

```txt
- drag manuel d’une card played ;
- drag manuel d’une card locked ;
- link entre deux cards de la même colonne visible ;
- link entre deux cards déjà en conflict direct ;
- conflict entre deux cards déjà linkées dans le même groupe ;
- suppression ou déplacement manuel d’un hole/card played ;
- move qui change la colonne instrument d’une card.
```

Pendant le replay, la projection doit rester défensive. Si un event invalide est déjà présent dans l’historique ou si une impossibilité n’apparaît qu’après plusieurs transactions, le resolver doit :

```txt
1. préserver toutes les contraintes dures absolues ;
2. appliquer ce qui est encore résoluble ;
3. produire un projectionWarning stable ;
4. continuer le replay sans crash.
```

Warnings de projection obligatoires :

```txt
- link impossible à aligner car plusieurs cards fixed du groupe sont sur des resolvedRows différents ;
- conflict impossible à résoudre car les deux côtés sont fixed sur le même resolvedRow ;
- target de link/conflict manquante pendant le replay ;
- groupe linké contenant deux cards d’une même colonne visible ;
- contradiction link + conflict découverte pendant le replay ;
- maximum de passes atteint ;
- cycle ou oscillation détectée.
```

Le solver ne doit pas accepter partiellement une action en silence. Toute contrainte non satisfaite doit être observable dans `projectionWarnings`.

### 4.3 Format standard des `projectionWarnings`

Tous les warnings retournés par le resolver doivent suivre ce format stable :

```js
{
  type: "link_unresolvable",
  severity: "warning",
  reason: "linked_cards_fixed_on_different_rows",
  transactionId: "transaction_xxx",
  eventId: "event_xxx",
  cardIds: ["appearance_a", "appearance_b"],
  linkIds: ["link_xxx"],
  conflictIds: [],
  columnIds: ["instrument_guitar"],
  message: "Impossible d’aligner ce link : plusieurs cards fixes sont sur des lignes différentes."
}
```

Champs obligatoires :

```txt
type
severity
reason
transactionId
cardIds
message
```

Champs optionnels mais stables si disponibles :

```txt
eventId
linkIds
conflictIds
columnIds
```

`severity` autorisées :

```txt
info      : incohérence mineure ou event ignoré sans impact visible
warning   : contrainte non satisfaite mais projection utilisable
error     : projection partielle, action à corriger côté données ou UI
```

Types canoniques :

```txt
link_unresolvable
conflict_unresolvable
column_collision_unresolvable
invalid_action_replayed
missing_target
resolver_max_passes_reached
resolver_cycle_detected
hidden_column_constraint_ignored
skip_unresolvable
```

Reasons canoniques minimales :

```txt
linked_cards_fixed_on_different_rows
linked_cards_same_column
linked_cards_in_direct_conflict
conflicted_cards_fixed_on_same_row
card_target_missing
link_target_missing
conflict_target_missing
fixed_card_move_refused
same_column_collision_with_fixed_cards
max_passes_reached
max_repairs_per_pass_reached
layout_cycle_detected
hidden_column_not_resolved
skip_target_blocked
skip_target_missing
move_target_missing
lock_target_missing_row
played_target_row_mismatch
played_empty_slot_missing_target_row
```

L’UI organisateur n’affiche pas forcément tous les warnings. En revanche, le moteur doit toujours les produire pour debug, tests et admin.

### 4.4 Définition exacte de `resolvedRow`, `visualIndex` et affichage

Le resolver doit distinguer trois notions et ne jamais les mélanger.

```txt
resolvedRow        = ligne logique entière utilisée par les contraintes.
visualIndex        = ligne d’affichage compacte dérivée globalement des resolvedRows visibles.
cardIndexInColumn  = position locale d’une card dans la liste de sa colonne.
```

Règles normatives :

```txt
- `resolvedRow` est la seule valeur utilisée pour déterminer same plateau, links, conflicts, played, locked et collisions.
- `resolvedRow` doit être un entier positif >= 1.
- `visualIndex` est calculé après résolution par compression globale des resolvedRows de tout le tableau visible.
- Deux cards avec le même `resolvedRow` doivent avoir le même `visualIndex`, même si elles sont dans des colonnes différentes.
- Une colonne peut avoir une cellule vide sur un `visualIndex` donné ; ce vide n’est pas un hole métier.
- `cardIndexInColumn` ne doit jamais servir à tester un link, un conflict ou un plateau joué.
- Une card played conserve son `resolvedRow` historique.
- Une card locked conserve son `resolvedRow` tant qu’elle reste locked.
- La normalisation visuelle ne doit jamais changer un `resolvedRow` fixed.
- Les tests de links/conflicts utilisent `resolvedRow`, jamais `visualIndex` ni `cardIndexInColumn`.
```

En cas d’ambiguïté, le mot `row` dans la spec resolver signifie `resolvedRow`.

Exemple autorisé :

```txt
resolvedRows visibles globales : 1, 3, 7
visualIndex global correspondant : 1, 2, 3

Chant row 1 → visualIndex 1
Guitare row 7 → visualIndex 3
Basse row 3 → visualIndex 2
```

Exemple interdit :

```txt
A played resolvedRow 4
normalisation finale → A resolvedRow 2
```

Exemple interdit côté UI :

```txt
Plateau 2 = deuxième card de chaque colonne
```

Cette règle casse l’alignement dès qu’une colonne a une row vide. Le plateau affiché doit être basé sur le `visualIndex` global, pas sur le rang local dans chaque colonne.

### 4.5 Stratégie exacte de réparation des collisions

Une collision existe quand deux cards visibles d’une même colonne veulent le même `resolvedRow`.

```txt
A.columnId = B.columnId
row(A) = row(B)
→ collision à réparer
```

Règle de décision :

```txt
1. Une card fixed garde toujours sa place.
2. Si une seule card est fixed, l’autre est poussée.
3. Si les deux cards sont fixed, la collision est impossible à réparer.
4. Sinon, la card avec la priorité de propagation la plus haute garde la place.
5. Sinon, l’anchor ou la card directement manipulée garde la place.
6. Sinon, la card la plus proche de son ancienne position garde la place.
7. Sinon, préserver l’ordre relatif précédent.
8. Sinon, départager par ordre de création puis id stable.
```

La card poussée doit aller vers le slot valide le plus proche dans la même colonne.

Recherche du slot :

```txt
1. tester row + 1 ;
2. tester row - 1 ;
3. tester row + 2 ;
4. tester row - 2 ;
5. continuer jusqu’au premier slot valide ;
6. en cas d’égalité stricte, préférer le bas.
```

Un slot est valide seulement si :

```txt
- il ne contient pas de card fixed incompatible ;
- il ne crée pas de collision finale ;
- il ne rend pas un link ou conflict irréparable si une alternative moins coûteuse existe.
```

Si la card poussée appartient à un groupe linké, ce déplacement devient un signal de propagation pour tout le groupe.

### 4.6 Scoring exact des réparations

Le resolver doit utiliser un scoring déterministe pour choisir entre plusieurs réparations possibles.

Constantes canoniques :

```js
const RESOLUTION_COST = {
  IMPOSSIBLE: Number.POSITIVE_INFINITY,

  MOVE_PLAYED: Number.POSITIVE_INFINITY,
  MOVE_LOCKED: Number.POSITIVE_INFINITY,
  CHANGE_COLUMN: Number.POSITIVE_INFINITY,
  FINAL_COLUMN_COLLISION: Number.POSITIVE_INFINITY,

  UNRESOLVED_LINK: 100000,
  UNRESOLVED_CONFLICT: 100000,
  USER_ANCHOR_NOT_PRESERVED: 10000,

  MOVE_LINK_GROUP: 1000,
  MOVE_SECONDARY_CARD: 100,
  RELATIVE_ORDER_INVERSION: 50,
  MOVED_CARD_COUNT: 25,
  ROW_DISTANCE: 10,
  VISUAL_CHURN: 5,

  STABLE_TIEBREAKER: 1
}
```

Règles :

```txt
- déplacer une card played ou locked est impossible ;
- changer la colonne d’une card est impossible ;
- laisser une collision finale dans une colonne visible est impossible ;
- laisser un link ou conflict non résolu est très coûteux et doit produire un warning si aucune réparation valide n’existe ;
- ne pas respecter l’anchor est permis seulement si une contrainte dure l’impose ;
- déplacer un groupe linké coûte plus cher que déplacer une card libre isolée ;
- le round n’ajoute aucun coût ;
- en cas de score égal, utiliser un tri stable par ancien ordre, ordre de création, puis id.
```

La distance de déplacement est calculée sur `resolvedRow` :

```txt
abs(nextResolvedRow - previousResolvedRow) * ROW_DISTANCE
```

Le coût `RELATIVE_ORDER_INVERSION` s’applique quand deux cards non directement concernées changent d’ordre relatif sans nécessité pour résoudre une contrainte dure.

### 4.7 Propagation de priorité chiffrée

Le resolver doit maintenir une priorité par card pendant une résolution. Si plusieurs chemins donnent une priorité à la même card, garder la priorité la plus haute.

Valeurs canoniques :

```js
const PROPAGATION_PRIORITY = {
  USER_MOVE: 1000,
  USER_CREATED_CARD: 950,
  USER_LOCKED_CARD: 900,
  USER_LINK_STRATEGY_TARGET: 850,
  PUSHED_BY_USER_MOVE: 800,
  LINKED_TO_PUSHED_CARD: 700,
  PUSHED_BY_LINKED_CARD: 600,
  LINKED_TO_INDIRECT_PUSH: 500,
  CONFLICT_REPAIR_TARGET: 400,
  STABILITY_DEFAULT: 100
}
```

Dégradation obligatoire :

```txt
- push direct : priorité source - 200 minimum ;
- link depuis une card poussée : priorité source - 100 minimum ;
- réparation de conflict : priorité maximale 400 sauf si l’anchor est impliquée ;
- priorité minimale utile : 100 ;
- sous 100, fallback stabilité.
```

Propagation :

```txt
1. Une action utilisateur donne une priorité initiale à son anchor ou à ses cards créées.
2. Une card qui garde une row après collision peut pousser une autre card.
3. La card poussée reçoit une priorité dérivée.
4. Si cette card appartient à un link group, les autres membres reçoivent une priorité dérivée.
5. Si le réalignement du groupe pousse d’autres cards, la propagation continue.
6. La propagation s’arrête quand aucun déplacement nouveau n’est produit, quand une impossibilité est détectée, ou quand les limites du resolver sont atteintes.
```

Exemple :

```txt
A user_move priority 1000
A pousse B → B priority 800
B link C → C priority 700
C pousse D → D priority 600
D link E → E priority 500
```

Les priorités ne sont pas des contraintes dures. Elles départagent les réparations possibles après respect des contraintes dures.


### 4.8 Choix exact de la `targetRow` pour les links

Le choix de `targetRow` d’un groupe linké est canonique. Il ne doit pas dépendre de l’ordre de parcours des colonnes.

Priorité de décision :

```txt
1. Si le groupe contient une ou plusieurs cards fixed sur le même resolvedRow : targetRow = ce resolvedRow.
2. Si le groupe contient plusieurs cards fixed sur des resolvedRows différents : warning `linked_cards_fixed_on_different_rows`, aucune fixed ne bouge.
3. Sinon, si une card du groupe a reçu une priorité de propagation supérieure ou égale à 500 : targetRow = resolvedRow de la card prioritaire.
4. Sinon, appliquer la stratégie enregistrée dans l’event `link_created`.
5. Si la targetRow choisie est impossible à cause d’une card fixed dans une colonne cible, tester les candidateRows alternatives par coût croissant.
6. Si aucune candidateRow ne permet d’aligner le groupe sans casser une contrainte dure absolue : warning `link_unresolvable`.
```

Stratégies de link :

```txt
move_to_first      : resolvedRow la plus haute parmi les targets du groupe.
move_to_last       : resolvedRow la plus basse parmi les targets du groupe.
average_position   : moyenne des resolvedRows des targets mobiles.
```

Arrondi de `average_position` :

```txt
1. calculer la moyenne des resolvedRows mobiles ;
2. si la moyenne tombe entre deux rows, choisir la row de la card ayant la priorité de propagation la plus haute ;
3. si aucune card n’a de priorité supérieure à `STABILITY_DEFAULT`, arrondir vers la row la plus haute ;
4. en égalité parfaite, départager par ordre précédent, ordre de création, puis id stable.
```

CandidateRows alternatives quand la `targetRow` initiale est bloquée :

```txt
1. targetRow ;
2. targetRow + 1 ;
3. targetRow - 1 ;
4. targetRow + 2 ;
5. targetRow - 2 ;
6. continuer jusqu’à trouver une row valide ;
7. ignorer toute row candidate < 1 ;
8. préférer le bas en cas de coût strictement égal.
```

La recherche s’arrête à `MAX_CANDIDATE_ROW_DISTANCE`. Elle doit être déterministe : à distance égale, tester toujours le bas avant le haut après le premier essai.

Une row candidate est valide uniquement si :

```txt
- elle ne demande pas de déplacer une card played ;
- elle ne demande pas de déplacer une card locked ;
- elle ne crée pas de collision finale insoluble ;
- elle ne crée pas un conflict insoluble ;
- elle ne met pas deux cards du même groupe linké dans la même colonne visible.
```

Si une candidateRow valide existe mais provoque des déplacements secondaires, ces déplacements sont scorés avec `RESOLUTION_COST` et propagent leurs priorités selon `PROPAGATION_PRIORITY`.

### 4.9 Ordre exact des passes du resolver

Le resolver doit suivre cet ordre canonique. Les helpers peuvent être organisés librement, mais le comportement observable doit rester celui-ci.

```txt
1. buildVisibleCards
2. buildLinkGroups
3. buildActiveConflicts
4. buildFixedMap
5. validateStructuralImpossibleCases
6. buildInitialLayoutFromPreviousProjection
7. applyTransactionIntent
8. seedPropagationPriority
9. resolveColumnCollisions
10. resolveLinkMisalignments
11. resolveColumnCollisions
12. resolveConflictViolations
13. resolveColumnCollisions
14. repeat steps 10 à 13 jusqu’à stabilité
15. normalizeVisualIndexes
16. emit projectionWarnings
```

Règles :

```txt
- Les collisions sont résolues avant et après les links/conflicts, parce que les links et conflicts peuvent créer de nouvelles collisions.
- Les structural impossibilities évidentes sont détectées avant les réparations itératives.
- Les impossibilités apparues pendant les réparations deviennent des `projectionWarnings`.
- Le resolver peut traiter tout le tableau visible, pas seulement les colonnes directement touchées.
- Le round n’apparaît dans aucune passe de priorité d’ordre.
```

Ordre de priorité des violations dans une passe :

```txt
1. collision dans une colonne visible ;
2. link désaligné ;
3. conflict actif sur le même resolvedRow ;
4. intention de transaction non respectée ;
5. churn visuel évitable.
```

L’intention utilisateur peut être dégradée si nécessaire pour résoudre un conflict, un link ou une collision dure. Elle ne peut jamais déplacer du `played` ou du `locked`.

### 4.10 Conditions d’arrêt et anti-oscillation

Le resolver doit être borné et détecter les cycles.

Constantes canoniques :

```js
const RESOLUTION_LIMITS = {
  MAX_PASSES: 50,
  MAX_REPAIRS_PER_PASS_MULTIPLIER: 4,
  MAX_CANDIDATE_ROW_DISTANCE: 200
}
```

Interprétation :

```txt
MAX_PASSES = nombre maximum de passes complètes links/conflicts/collisions.
MAX_REPAIRS_PER_PASS = cards visibles * MAX_REPAIRS_PER_PASS_MULTIPLIER.
MAX_CANDIDATE_ROW_DISTANCE = distance maximale explorée au-dessus/dessous d’une targetRow.
```

À chaque réparation, le resolver doit calculer un `layoutHash` stable basé sur :

```txt
cardId
columnId
resolvedRow
fixed status
linkGroupId actif
conflict ids actifs pertinents
```

Règles d’arrêt :

```txt
- si aucune violation n’est trouvée : succès ;
- si aucune réparation valide n’existe pour une violation locale de link/conflict : warning ciblé, marquer seulement cette contrainte comme `unresolvedIgnoredForThisRun`, puis continuer les autres réparations possibles ;
- si aucune réparation valide n’existe pour une collision finale de colonne visible : warning `column_collision_unresolvable` severity `error`, puis retourner le meilleur layout partiel déterministe ;
- si MAX_PASSES est atteint : warning `resolver_max_passes_reached` ;
- si MAX_REPAIRS_PER_PASS est atteint : warning `resolver_max_passes_reached` reason `max_repairs_per_pass_reached` ;
- si le même layoutHash revient deux fois dans la même résolution : warning `resolver_cycle_detected` ;
- si aucune candidateRow valide n’est trouvée dans MAX_CANDIDATE_ROW_DISTANCE : warning ciblé selon la violation en cours, puis continuer si la violation peut être isolée.
```

Une contrainte marquée `unresolvedIgnoredForThisRun` n’est pas supprimée de l’état projeté. Elle est seulement ignorée pour éviter une boucle pendant cette résolution. Au replay suivant ou après une action ultérieure, elle est réévaluée normalement.

Le resolver ne doit jamais boucler indéfiniment et ne doit jamais produire un ordre non déterministe pour “sortir” d’un cycle.

### 4.11 Règles pour colonnes hidden

En V0, une colonne hidden est absente du tableau visible et ne participe pas au resolver visible.

Règles canoniques :

```txt
- Les appearances/holes d’une colonne hidden ne sont pas supprimés de l’historique.
- Les cards hidden ne sont pas incluses dans `buildVisibleCards`.
- Les links impliquant au moins une card hidden sont ignorés pour l’alignement visible.
- Les conflicts impliquant au moins une card hidden sont ignorés pour la séparation visible.
- Ignorer une contrainte hidden ne doit jamais déplacer une card visible.
- Montrer à nouveau une colonne relance le resolver avec ses cards redevenues visibles.
```

Politique de warning :

```txt
- Projection organisateur normale : pas de warning obligatoire quand une contrainte est ignorée uniquement parce qu’une colonne est hidden.
- Mode debug/admin ou tests détaillés : produire `hidden_column_constraint_ignored` avec `severity: info`.
- Si une contrainte hidden référence une target réellement manquante ou supprimée, produire plutôt `missing_target`.
```

Un instrument hidden ne doit jamais forcer une card visible à bouger. L’historique reste rejouable, mais la projection visible ignore les contraintes qui traversent une colonne masquée.

### 4.12 Règles précises pour holes

Un hole est une card ordonnable normale pour le resolver.

Règles canoniques :

```txt
- Un hole occupe un vrai resolvedRow dans sa colonne.
- Un hole peut être pushed comme une appearance mobile.
- Un hole played est fixed.
- Un hole locked est fixed.
- Un hole peut être membre d’un link group seulement s’il a été créé par un flux explicite `jouer sans` ou drawer d’appel.
- Un hole ne participe jamais aux conflicts automatiques `instrument_constraint` liés au même participant.
- Un hole ne génère jamais d’appearance ou de hole futur.
- Un hole supprimé retire uniquement le hole de la projection active et désactive/ignore les links qui le ciblent.
```

Un hole peut être impliqué dans un conflict manuel seulement si un event historique le cible déjà. En V0, l’UI ne doit pas proposer de créer un nouveau conflict manuel avec un hole sauf décision produit ultérieure.

### 4.13 Règles précises pour `appearance_skipped`

`appearance_skipped` est ponctuel et ne crée aucun état durable de présence.

Règles canoniques :

```txt
1. Le skip cible une appearance précise.
2. Si l’appearance est linked, le link qui la contient est supprimé ou désactivé pour cette appearance avant le déplacement.
3. Le reste de l’ancien groupe linké reste actif et doit être réaligné sans l’appearance skippée si au moins deux targets restent.
4. L’appearance skippée est repoussée seule vers le prochain slot valide de sa colonne.
5. Le skip ne modifie pas les appearances futures de la participation.
6. Le skip ne marque pas le participant `left`.
7. Le skip ne peut jamais déplacer une card played ou locked.
8. Si aucun slot valide n’existe sans casser une contrainte dure, produire un warning `skip_unresolvable` ou `column_collision_unresolvable` selon le cas.
```

Si un remplaçant est choisi depuis le drawer d’appel :

```txt
- le remplaçant prend le resolvedRow de l’appearance skippée si possible ;
- l’appearance skippée est repoussée seule ;
- si le remplaçant est linked, l’UI doit confirmer le délink ou annuler l’action ;
- le resolver répare ensuite collisions, links restants et conflicts.
```

Si “faire sans musicien” est choisi :

```txt
- créer un hole à la place de l’appearance skippée ;
- repousser l’appearance skippée seule ;
- le hole peut être played/locked comme une card normale ;
- aucun event dédié `play_without_created` n’est nécessaire.
```

### 4.14 Validations UI pré-transaction

Le resolver reste défensif, mais l’UI doit empêcher les actions manifestement invalides avant de créer une transaction.

Refus UI obligatoires :

```txt
- drag d’une appearance played ;
- drag d’un hole played ;
- drag d’une appearance locked ;
- drag d’un hole locked ;
- suppression d’une appearance played ;
- suppression d’un hole played ;
- link entre deux targets dans la même colonne visible ;
- link entre deux targets déjà en conflict direct ;
- conflict entre deux targets déjà dans le même link group ;
- conflict entre deux cards fixed déjà sur le même resolvedRow ;
- move horizontal qui change l’instrument d’une card ;
- skip d’une appearance played ;
- skip d’une appearance locked.
```

Confirmations UI obligatoires :

```txt
- masquer une colonne qui a des links actifs ;
- supprimer une appearance future ;
- supprimer un hole ;
- supprimer une appearance ou un hole qui a un link actif ;
- marquer `left` un participant avec appearances futures locked ;
- choisir un remplaçant déjà linked dans le drawer d’appel.
```

Feedback minimal :

```txt
- refus immédiat : snackbar explicative ;
- action destructive : dialog de confirmation ;
- projectionWarning complexe : visible en debug/admin, pas forcément en UI organisateur.
```

### 4.15 Invariants de tests obligatoires

Tous les tests du resolver doivent vérifier les invariants suivants quand ils s’appliquent.

```txt
1. Même event log + même snapshot + même config = même projection exacte.
2. Aucune colonne visible ne contient deux cards sur le même resolvedRow final.
3. Aucune appearance played ne change de resolvedRow après une transaction ultérieure.
4. Aucun hole played ne change de resolvedRow après une transaction ultérieure.
5. Aucune appearance locked ne change de resolvedRow tant qu’elle reste locked.
6. Aucun hole locked ne change de resolvedRow tant qu’il reste locked.
7. Aucun link résoluble ne reste désaligné.
8. Aucun conflict résoluble ne reste sur le même resolvedRow.
9. Tout link impossible produit un projectionWarning canonique.
10. Tout conflict impossible produit un projectionWarning canonique.
11. Les rounds peuvent être mélangés ; aucun test ne doit attendre un tri round-first.
12. Une card pushed qui appartient à un link group propage sa priorité au groupe.
13. Une suppression de link ne restaure pas un ancien ordre magique.
14. Une suppression de conflict ne restaure pas un ancien ordre magique.
15. Les columns hidden ne déplacent pas les cards visibles.
16. Les holes sont traités comme des cards normales pour collisions, lock, played et links explicites.
17. `appearance_skipped` repousse uniquement l’appearance ciblée.
18. Le resolver retourne `resolver_cycle_detected` en cas d’oscillation détectée.
19. Le resolver retourne `resolver_max_passes_reached` quand les limites sont atteintes.
20. Aucun résultat ne dépend du DOM, de React, de Zustand, de Dexie, de `Date.now()` ou de `Math.random()`.
21. Les égalités de scoring sont départagées par ordre précédent, ordre de création, puis id stable.
22. `visualIndex` peut être compacté, mais les tests de contraintes utilisent toujours `resolvedRow`.
23. Deux cards ayant le même `resolvedRow` dans deux colonnes visibles obtiennent le même `visualIndex` global.
24. Le rang local d’une card dans sa colonne ne définit jamais un plateau logique.
```


### 4.16 Contrat d’entrée exact du resolver

Le resolver doit être une fonction pure avec un contrat d’entrée stable. Il ne doit pas lire directement les stores UI, le DOM, Dexie, Zustand ou React.

Signature canonique :

```js
resolveOrderAfterTransaction({
  cards,
  links,
  conflicts,
  hiddenColumnIds,
  previousLayout,
  transactionContext,
  config
})
```

#### `cards`

`cards` contient toutes les cards candidates connues par la projection avant filtrage visible. Le resolver filtre ensuite les colonnes hidden via `buildVisibleCards`.

Shape canonique d’une card :

```js
{
  cardId: "appearance_...",            // appearanceId ou holeId, stable
  type: "appearance" | "hole",
  columnId: "instrument_...",          // colonne instrument, immuable

  participantId: "participant_..." | null,
  participationId: "participation_..." | null,
  appearanceId: "appearance_..." | null,
  holeId: "hole_..." | null,
  appearanceIndex: 1 | null,            // round métier, metadata seulement

  createdAtOrder: 120,                  // ordre stable de création/replay
  baseOrder: 120,                       // fallback historique si previousLayout absent

  previousResolvedRow: 3 | null,         // layout précédent dans le replay
  resolvedRow: 3 | null,                 // peut être absent avant résolution
  visualIndex: 2 | null,                 // recalculé en sortie uniquement
  cardIndexInColumn: 1 | null,           // recalculé en sortie uniquement

  played: false,
  locked: false,
  deleted: false,
  hidden: false,

  sourceEventId: "event_..." | null,
  sourceTransactionId: "transaction_..." | null
}
```

Règles :

```txt
- `cardId` est l’identifiant unique utilisé par links/conflicts/layout.
- `columnId` ne peut jamais changer pendant une résolution.
- `appearanceIndex` ne sert jamais à prioriser l’ordre.
- `previousResolvedRow` est préféré à `baseOrder` pour la stabilité.
- `visualIndex` et `cardIndexInColumn` entrants sont ignorés pour les contraintes.
```

#### `links`

Shape canonique :

```js
{
  linkId: "link_...",
  targetCardIds: ["appearance_a", "hole_b"],
  active: true,
  reorderStrategy: "move_to_first" | "move_to_last" | "average_position",
  createdAtOrder: 130,
  transactionId: "transaction_...",
  eventId: "event_..."
}
```

`reorderStrategy` doit être copiée dans l’event `link_created`. Une modification ultérieure de la config de jam ne doit pas réinterpréter rétroactivement les anciens links.

#### `conflicts`

Shape canonique :

```js
{
  conflictId: "conflict_...",
  scope: "appearance" | "participation",
  targetCardIds: ["appearance_a", "appearance_b"],       // si scope appearance
  targetParticipationIds: ["participation_a", "participation_b"], // si scope participation
  reason: "instrument_constraint" | "manual",
  active: true,
  createdAtOrder: 140,
  transactionId: "transaction_...",
  eventId: "event_..."
}
```

Avant résolution, `buildActiveConflicts` doit étendre les conflicts `scope: participation` en paires concrètes de `cardIds` visibles selon les règles de la section 4.24.

#### `hiddenColumnIds`

Ensemble des colonnes masquées :

```js
new Set(["instrument_drums"])
```

Une colonne hidden est absente du resolver visible. Ses cards et ses contraintes n’influencent jamais les cards visibles.

#### `previousLayout`

Layout résolu à la fin de la transaction active précédente pendant le replay :

```js
{
  byCardId: {
    "appearance_a": {
      cardId: "appearance_a",
      columnId: "instrument_voice",
      resolvedRow: 2,
      visualIndex: 2,
      cardIndexInColumn: 1
    }
  }
}
```

Si absent, le resolver utilise `baseOrder`, puis `createdAtOrder`, puis `cardId`.

#### `transactionContext`

Le contexte représente l’intention de la transaction courante. Il est construit par la projection, pas par le composant React.

Shape générique :

```js
{
  transactionId: "transaction_...",
  eventIds: ["event_..."],
  intent: "move" | "card_created" | "link_created" | "conflict_created" | "skip" | "lock" | "unlock" | "play" | "unplay" | "visibility_changed" | "neutral",
  anchorCardId: "appearance_..." | null,
  affectedCardIds: ["appearance_..."],
  afterTargetCardId: "appearance_prev" | null,
  beforeTargetCardId: "appearance_next" | null,
  preferredResolvedRow: 3 | null,
  linkStrategy: "move_to_first" | "move_to_last" | "average_position" | null,
  metadata: {}
}
```

Le resolver ne doit pas inspecter directement le type brut des events pour deviner l’intention. La projection transforme les events en `transactionContext` selon la table canonique de la section 4.19.

#### `config`

```js
{
  defaultLinkReorderStrategy: "move_to_first",
  costs: RESOLUTION_COST,
  priorities: PROPAGATION_PRIORITY,
  limits: RESOLUTION_LIMITS
}
```

Les valeurs par défaut doivent être celles de cette spec.

### 4.17 Contrat de sortie exact du resolver

Le resolver ne doit pas retourner directement un arbre React ni une structure dépendante des composants. Il retourne un layout pur, consommable par `buildColumns`.

Shape canonique :

```js
{
  layoutByCardId: {
    "appearance_a": {
      cardId: "appearance_a",
      columnId: "instrument_voice",
      resolvedRow: 2,
      visualIndex: 2,
      cardIndexInColumn: 1
    }
  },
  orderedCardIdsByColumnId: {
    "instrument_voice": ["appearance_a", "appearance_b"],
    "instrument_guitar": ["appearance_c"]
  },
  visibleResolvedRows: [1, 2, 5],
  projectionWarnings: []
}
```

Règles :

```txt
- `layoutByCardId` est la sortie principale du resolver.
- `orderedCardIdsByColumnId` est dérivé de `layoutByCardId` par tri `resolvedRow`, puis fallback stable.
- `visibleResolvedRows` sert à afficher les lignes globales du tableau.
- `buildColumns()` construit ensuite les colonnes UI à partir des entities projetées + `layoutByCardId`.
- Aucun composant UI ne doit recalculer les `resolvedRow`.
```

Le resolver peut exposer des métadonnées de debug en environnement test/admin, mais elles ne doivent pas être nécessaires au rendu normal.

### 4.18 Où vit `resolvedRow`

`resolvedRow` est un résultat calculé de projection, pas une vérité métier durable.

Règles normatives :

```txt
- `resolvedRow` n’est jamais stocké dans un event comme vérité finale.
- Les events stockent des intentions : move between, link, conflict, lock, play, skip.
- Le snapshot peut stocker `resolvedRow` comme cache dérivable.
- Pendant un replay complet, le `previousLayout` d’une transaction est le layout produit par la transaction active précédente.
- Après la dernière transaction, la projection expose les `resolvedRow` calculés pour le tableau courant.
```

Flux canonique :

```txt
eventLog actif
→ projection brute des entities
→ transactionContext
→ resolver
→ layoutByCardId calculé
→ buildColumns / plateaux affichables
```

Interdit :

```txt
- utiliser un ancien `resolvedRow` stocké dans un event pour forcer l’ordre final ;
- considérer `positionInRound`, `order`, `index`, `manualOrderHint` ou `appearanceIndex` comme vérité finale ;
- reconstruire `resolvedRow` depuis le rang local dans chaque colonne.
```

### 4.19 Mapping canonique event → `transactionContext`

La projection doit transformer chaque transaction en un `transactionContext` stable avant d’appeler le resolver. Cette table est normative.

| Event principal | `intent` | `anchorCardId` | Champs contextuels | Règle |
|---|---:|---:|---|---|
| `appearance_moved_between` | `move` | appearance déplacée | `afterTargetCardId`, `beforeTargetCardId` | Seed priorité `USER_MOVE`. Le move est relatif, pas absolu. |
| `hole_moved_between` | `move` | hole déplacé | `afterTargetCardId`, `beforeTargetCardId` | Même logique qu’une appearance. |
| `participation_added` | `card_created` | nouvelle appearance principale | `affectedCardIds` des appearances visibles créées | Seed `USER_CREATED_CARD`. Position de départ en fin de liste logique, puis solver. |
| `hole_added` | `card_created` | nouveau hole | `preferredResolvedRow` si flux drawer/play_without | Seed `USER_CREATED_CARD`. |
| `link_created` | `link_created` | `null` | `affectedCardIds`, `linkStrategy` | Pas d’anchor directionnelle. TargetRow selon section 4.8. |
| `link_removed` | `neutral` | `null` | `affectedCardIds` | Préserver l’ordre courant, réparer seulement contraintes restantes. |
| `conflict_created` | `conflict_created` | `null` | `affectedCardIds` | Pas de “non-anchor” par défaut. Déplacer la card/groupe au coût minimal. |
| `conflict_removed` | `neutral` | `null` | `affectedCardIds` | Pas de retour magique à un ancien ordre. |
| `appearance_skipped` | `skip` | appearance skippée | `replacementCardId`, `createdHoleId`, `preferredResolvedRow` | Délink ponctuel puis push seule. |
| `appearance_locked` / `hole_locked` | `lock` | card verrouillée | `affectedCardIds` | La card devient fixed au resolvedRow courant. |
| `appearance_unlocked` / `hole_unlocked` | `unlock` | card déverrouillée | `affectedCardIds` | La card redevient mobile, ordre courant préservé sauf contrainte. |
| `plateau_played` | `play` | `null` | `affectedCardIds`, `playedResolvedRow` dérivé du layout courant | Les cards du plateau deviennent fixed à leur resolvedRow courant. Si l’UI a envoyé un `visualIndex`, la projection le convertit en `playedResolvedRow` via `visibleResolvedRows` avant d’appeler le resolver. |
| `plateau_unplayed` | `unplay` | `null` | `affectedCardIds` | Les cards redeviennent mobiles sauf lock. |
| `instrument_visibility_changed` | `visibility_changed` | `null` | `columnId`, `hidden` | Relancer resolver visible avec filtrage hidden. |
| `round_revealed` / `instrument_round_visibility_changed` | `card_created` | `null` | appearances visibles nouvellement calculées | Ajouter les cards, puis solver. Round sans priorité d’ordre. |
| `participant_left` | `visibility_changed` | `null` | appearances futures retirées | Retirer futures non jouées, garder played. |
| `appearance_removed` / `hole_removed` | `visibility_changed` | `null` | targets retirées | Retirer target active, désactiver/ignorer links ciblés. |
| `transaction_reverted` | `neutral` | `null` | transaction annulée | Replay sans les events annulés, puis resolver. |

Si une transaction contient plusieurs events, la projection choisit l’intention principale dans cet ordre :

```txt
move > skip > link_created > conflict_created > card_created > lock/unlock > play/unplay > visibility_changed > neutral
```

Les autres events alimentent `affectedCardIds` et `metadata`, mais ne changent pas l’anchor principale.

### 4.20 Règle exacte du `previousLayout`

Pendant le replay, le resolver reçoit toujours le layout produit par la transaction active précédente.

```txt
transaction 1 → resolver → layout 1
transaction 2 reçoit layout 1 → resolver → layout 2
transaction 3 reçoit layout 2 → resolver → layout 3
```

Règles :

```txt
- Le replay ne repart pas du `baseOrder` brut à chaque transaction.
- Une suppression de link/conflict part du layout courant et ne restaure pas un ancien ordre.
- Les déplacements induits par une transaction deviennent le `previousLayout` de la transaction suivante.
- Si une card disparaît, son entrée est retirée du layout courant.
- Si une card apparaît, elle reçoit un point de départ via `previousLayout` si disponible, sinon `baseOrder`/`createdAtOrder`/`cardId`.
```

Cette règle est obligatoire pour éviter les “retours magiques” et les projections différentes selon le chemin d’accès UI.

### 4.21 Impossibilité fatale vs warning non fatal

Le resolver ne doit pas s’arrêter entièrement dès qu’il détecte une contrainte impossible. Il doit collecter les warnings ciblés puis continuer à réparer le reste du tableau quand c’est possible.

Règles :

```txt
- Une impossibilité locale sur un link produit un warning `link_unresolvable`, puis les autres links/conflicts continuent d’être résolus.
- Une impossibilité locale sur un conflict produit un warning `conflict_unresolvable`, puis les autres contraintes continuent d’être résolues.
- Une target manquante produit `missing_target` et seule la contrainte qui la référence est ignorée.
- Un event illégal rejoué produit `invalid_action_replayed`, puis l’intention illégale est ignorée ou clampée.
- Une collision finale insoluble dans une colonne visible produit `column_collision_unresolvable` severity `error`, mais le resolver retourne quand même le meilleur layout partiel déterministe.
- `resolver_cycle_detected` ou `resolver_max_passes_reached` arrêtent la boucle itérative, mais pas la production du layout partiel.
```

Interdit :

```txt
if (structuralWarnings.length > 0) return immediately;
```

À faire :

```txt
warnings.push(...structuralWarnings)
marquer les contraintes impossibles comme ignored/unresolved
continuer les réparations possibles
retourner layout partiel + warnings
```

### 4.22 API pure de validation pré-transaction

Les validations ne doivent pas être dispersées dans les composants React. Elles doivent passer par une API pure partagée.

Signature canonique :

```js
validateTransactionBeforeApply(state, transaction)
```

Retour canonique :

```js
{
  ok: false,
  reason: "link_targets_same_column",
  severity: "error",
  message: "Impossible de lier deux cards de la même colonne.",
  transactionId: "transaction_...",
  eventIds: ["event_..."],
  cardIds: ["appearance_a", "appearance_b"],
  requiresConfirmation: false,
  confirmationType: null
}
```

Si une confirmation est nécessaire :

```js
{
  ok: false,
  reason: "delete_linked_target_requires_confirmation",
  severity: "warning",
  message: "Cette card a un link actif. Confirmer la suppression ?",
  requiresConfirmation: true,
  confirmationType: "delete_linked_target"
}
```

Règles :

```txt
- L’UI appelle cette fonction avant `applyLocalTransaction`.
- Les composants peuvent afficher snackbar/dialog selon le retour, mais ne réimplémentent pas les règles.
- La projection reste défensive même si la validation UI a été contournée.
- Les reasons de validation doivent être stables et testées.
```

Reasons minimales :

```txt
card_played_cannot_move
card_locked_cannot_move
played_card_cannot_be_deleted
link_targets_same_column
link_targets_direct_conflict
conflict_targets_same_link_group
fixed_conflict_already_unresolvable
move_changes_column
skip_target_played
skip_target_locked
missing_target
```

### 4.23 Convention stricte des IDs

Les IDs doivent être stables et dérivables pendant un replay.

Règles :

```txt
- Pour une appearance : `cardId = appearanceId`.
- Pour un hole : `cardId = holeId`.
- Un link cible des `cardId` concrets.
- Un conflict `scope: appearance` cible des `cardId` concrets.
- Un conflict `scope: participation` cible des `participationId`, puis est étendu en `cardId` visibles par la projection.
- `appearanceId` doit être stable pour une participation donnée et un `appearanceIndex` donné.
- Une appearance matérialisée ne doit jamais changer d’id, même si son ordre change.
- Une suppression ne réutilise jamais un ancien id.
```

Format recommandé :

```txt
participant_{uuid}
participation_{uuid}
appearance_{participationId}_{appearanceIndex} ou appearance_{uuid} stable créé à la matérialisation
hole_{uuid}
link_{uuid}
conflict_{uuid}
transaction_{uuid}
event_{uuid}
```

Si le code choisit des `appearance_{uuid}` à la matérialisation, il doit conserver un mapping stable :

```txt
(participationId, appearanceIndex) → appearanceId
```

Ce mapping doit être rejouable depuis l’event log/snapshot et ne peut pas dépendre d’un ordre React.

### 4.24 Expansion des conflicts `scope: participation`

Un conflict `scope: participation` est une contrainte générale entre deux participations. Le resolver ne l’utilise pas directement : il l’étend en conflicts concrets entre cards visibles.

Pour deux participations `P1` et `P2`, générer un conflict concret entre toutes les appearances visibles actives de `P1` et toutes les appearances visibles actives de `P2`.

Exemple :

```txt
P1 = Nicolas chant
P2 = Nicolas guitare
appearances visibles : P1 r1, P1 r2, P2 r1, P2 r2
→ conflicts concrets :
  P1 r1 != P2 r1
  P1 r1 != P2 r2
  P1 r2 != P2 r1
  P1 r2 != P2 r2
```

Justification : un même musicien ne peut pas jouer deux instruments sur le même plateau, quel que soit le round de chaque participation.

Règles :

```txt
- L’expansion ne crée pas de nouveaux events.
- L’expansion est recalculée à chaque projection selon les appearances visibles.
- Une appearance removed, hidden ou future non visible n’est pas incluse.
- Une card dans une colonne hidden n’est pas incluse dans le resolver visible.
- Les holes ne sont pas inclus dans les conflicts automatiques `instrument_constraint`.
- Un conflict manual `scope: participation` suit la même expansion que `instrument_constraint`.
```

### 4.25 Traitement des anciens champs d’ordre

Le code existant peut contenir des champs historiques ou intermédiaires :

```txt
order
position
positionInRound
appearanceIndex sort
manualOrderHint
orderScore
resolvedOrderKey
positionKey
```

Règles de migration :

```txt
- Ces champs peuvent servir de fallback d’entrée si aucun `previousLayout` n’existe.
- Ils ne doivent jamais être utilisés comme contrainte finale après le nouveau resolver.
- `appearanceIndex` ne doit jamais être utilisé comme tri prioritaire.
- `manualOrderHint` doit être converti en `transactionContext`, puis ne plus orienter directement le rendu.
- `positionKey` peut aider à produire `baseOrder`, mais ne bat jamais `previousResolvedRow`.
- Si un ancien champ contredit `played` ou `locked`, il est ignoré et warning `invalid_action_replayed` si nécessaire.
```

Objectif : supprimer progressivement la dépendance au vieux modèle sans casser le replay de données locales récentes.

### 4.26 Contrat UI d’alignement par `visualIndex`

L’UI doit afficher le tableau avec des lignes globales issues du resolver.

Contrat :

```txt
1. Le resolver retourne `visibleResolvedRows` et `visualIndex` global.
2. Le front construit une grille par `visualIndex` global.
3. Chaque colonne affiche la card dont le `resolvedRow` correspond à cette ligne globale, si elle existe.
4. Si aucune card de la colonne ne correspond, afficher une cellule vide visuelle.
5. Une cellule vide visuelle n’est jamais persistée comme hole.
6. Le rang local d’une card dans sa colonne ne doit jamais définir un plateau.
```

Exemple :

```txt
visibleResolvedRows = [1, 3, 7]
visualIndex map = { 1: 1, 3: 2, 7: 3 }

Chant    row 1 → visualIndex 1
Guitare  row 7 → visualIndex 3
Basse    row 3 → visualIndex 2
```

L’UI doit donc rendre trois lignes globales, avec des cellules vides là où une colonne n’a aucune card sur la row concernée.

Interdit :

```txt
columns[instrument].cards[index] = plateau[index]
```

Cette approche casse l’alignement dès que les colonnes ont des rows absentes ou des rounds mélangés.

### 4.27 Fixtures canoniques de tests

Avant ou pendant la réécriture du resolver, créer des fixtures courtes qui servent de vérité. Chaque fixture doit contenir :

```js
{
  name: "fixture_02_push_link_chain",
  input: {
    cards: [],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: {},
    transactionContext: {},
    config: {}
  },
  expected: {
    layoutByCardId: {},
    orderedCardIdsByColumnId: {},
    visibleResolvedRows: [],
    projectionWarnings: []
  }
}
```

Fixtures obligatoires minimales :

```txt
fixture_01_drag_simple_push
fixture_02_push_link_chain
fixture_03_indirect_priority_chain
fixture_04_link_fixed_target
fixture_05_link_fixed_impossible
fixture_06_conflict_mobile_repair
fixture_07_conflict_fixed_impossible
fixture_08_rounds_mixed_valid
fixture_09_hidden_column_ignored
fixture_10_skip_delinks_only_target
fixture_11_visual_index_global_not_local_rank
fixture_12_same_event_log_same_projection
fixture_13_link_removed_no_magic_restore
fixture_14_conflict_removed_no_magic_restore
fixture_15_participation_conflict_expansion
```

Chaque fixture doit vérifier explicitement :

```txt
- layoutByCardId attendu ;
- orderedCardIdsByColumnId attendu ;
- projectionWarnings attendus, y compris reasons ;
- aucun use de `appearanceIndex` comme ordre ;
- aucun alignement par rang local de colonne.
```

Les fixtures doivent être suffisamment petites pour être relues à la main. Une fixture illisible ne verrouille pas le comportement.

---

### 4.28 Derniers cas limites verrouillés avant réécriture

Cette section complète les sections 4.16 à 4.27. Elle vise à empêcher les interprétations divergentes pendant une réécriture complète du resolver.

#### 4.28.1 Ordre interne d’une transaction multi-events

Une transaction peut contenir plusieurs events. La projection doit toujours :

```txt
1. appliquer les events bruts dans `eventIndexInTransaction` croissant ;
2. construire ou mettre à jour les entities projetées ;
3. construire un seul `transactionContext` principal selon la priorité de section 4.19 ;
4. appeler le resolver une seule fois pour la transaction complète.
```

Le resolver ne doit pas être appelé entre deux events d’une même transaction, sauf migration technique explicitement documentée. Cela évite des états intermédiaires visibles et des projections différentes selon le découpage interne de l’action.

#### 4.28.2 `plateau_played`, `visualIndex` UI et `playedResolvedRow`

L’UI peut déclencher “plateau joué” depuis une ligne affichée, donc depuis un `visualIndex`. La projection doit convertir ce `visualIndex` en `playedResolvedRow` avant d’appliquer l’effet métier.

Règles :

```txt
- `plateau_played` cible toujours des `cardId` concrets dans `payload.targets`.
- Si le payload contient `plateauIndex` ou `visualIndex`, cette valeur est une intention UI, pas une vérité de résolution.
- La projection convertit `visualIndex` → `playedResolvedRow` avec `visibleResolvedRows` du layout courant.
- Les targets jouées sont figées à leur `resolvedRow` courant.
- Si une target n’est pas sur `playedResolvedRow`, produire `invalid_action_replayed` et figer la target à son `resolvedRow` courant plutôt que la déplacer.
- `playedResolvedRow` peut être stocké dans le `transactionContext` et dans un event de trace/audit, mais le resolver ne doit jamais l’utiliser pour déplacer une card déjà fixed.
```

Cette règle ne contredit pas “`resolvedRow` n’est pas une vérité finale stockée dans les events” : ici, `playedResolvedRow` est une intention/freeze historique liée à l’action `plateau_played`, pas une position générale à rejouer comme ordre libre.

#### 4.28.3 Holes `played_empty_slot`

Quand un plateau est joué et qu’une colonne visible n’a aucune card sur le `playedResolvedRow`, il faut créer un vrai hole métier pour figer cette absence.

Payload minimal attendu pour ce hole :

```js
{
  type: "hole_added",
  payload: {
    holeId: "hole_...",
    instrumentId: "instrument_...",
    reason: "played_empty_slot",
    targetResolvedRow: 4,
    sourcePlateauPlayedTransactionId: "transaction_..."
  }
}
```

Règles :

```txt
- `targetResolvedRow` est obligatoire pour `reason: played_empty_slot`.
- Le hole `played_empty_slot` est immédiatement inclus dans `plateau_played.targets`.
- Le hole devient `played` et donc fixed dès la même transaction.
- Ce hole empêche toute card ajoutée plus tard d’occuper rétroactivement le plateau joué dans cette colonne.
- Ce hole n’est pas un vide visuel : c’est une vraie card métier historique.
- Les cellules vides visuelles normales restent non persistées et ne deviennent jamais des holes.
```

#### 4.28.4 Lock et unlock

Un lock fixe la card à son `resolvedRow` courant.

Règles :

```txt
- L’UI ne peut lock qu’une card visible ayant un `resolvedRow` courant.
- La projection construit `transactionContext.preferredResolvedRow` depuis le `previousLayout` courant.
- Si un event de lock est rejoué sans resolvedRow courant disponible, produire `invalid_action_replayed` reason `lock_target_missing_row` et ne pas inventer une row.
- Unlock retire seulement la contrainte fixed `locked`; il ne restaure aucun ordre ancien.
```

#### 4.28.5 Move avec targets `before/after` manquantes

Un move relatif peut référencer des targets devenues hidden, supprimées ou absentes pendant le replay défensif.

Règles :

```txt
- Si `afterTargetCardId` existe et est visible dans la même colonne, l’utiliser.
- Si `beforeTargetCardId` existe et est visible dans la même colonne, l’utiliser.
- Si une seule borne est valide, placer l’anchor juste après/avant cette borne, puis réparer.
- Si les deux bornes sont invalides, conserver la position de `previousLayout` si possible, sinon utiliser `baseOrder`/`createdAtOrder`/`cardId`.
- Produire `missing_target` reason `move_target_missing` pour chaque borne invalide.
- Ne jamais changer la colonne de l’anchor pour satisfaire un move relatif.
```

#### 4.28.6 Ordre de parcours déterministe

Tous les tableaux d’entrée doivent être triés explicitement avant usage algorithmique.

Règles :

```txt
- cards : `previousResolvedRow`, puis `createdAtOrder`, puis `cardId`.
- links : `createdAtOrder`, puis `linkId`.
- conflicts : `createdAtOrder`, puis `conflictId`.
- targetCardIds dans un link/conflict : ordre par `createdAtOrder`, puis `cardId`.
- linkGroupId dérivé : plus petit `linkId` actif du groupe, sinon plus petit `cardId` du groupe.
- aucun résultat ne doit dépendre de l’ordre d’énumération brut des propriétés d’objet JavaScript.
```

#### 4.28.7 Cards restantes et layout partiel

Même en cas d’erreur, le resolver ne doit jamais faire disparaître silencieusement une card visible active.

Règles :

```txt
- Toute card visible active en entrée doit être présente dans `layoutByCardId` en sortie, sauf si un event de suppression/retrait actif l’a retirée avant `buildVisibleCards`.
- Si une card ne peut pas obtenir une row idéale, elle conserve sa row précédente ou reçoit le fallback stable disponible, avec warning.
- Une collision finale insoluble produit `column_collision_unresolvable` severity `error` mais la sortie reste complète et déterministe.
- Les warnings doivent permettre d’identifier les cards non résolues, pas seulement la transaction globale.
```

#### 4.28.8 Contrat final de réécriture

Pour réécrire le resolver de zéro, Codex doit considérer comme canonique uniquement :

```txt
- `docs/order-resolution-hierarchy-spec.md` pour le comportement de résolution ;
- `docs/projection-engine-spec.md` pour le branchement projection/replay ;
- `docs/event-payloads-reference.md` pour les payloads ;
- `docs/testing-strategy.md` pour les fixtures et invariants.
```

Toute ancienne mention de tri round-first, de conflict orienté par non-anchor, d’alignement par rang local de colonne, ou de retour magique après suppression d’un link/conflict doit être considérée comme obsolète si elle contredit cette spec.

---

## 5. Contraintes dures

Les contraintes dures doivent être satisfaites ou produire un warning/refus explicite.

### 5.1 Visibilité et appartenance

- Une card supprimée n’est pas affichée.
- Une participation supprimée ne génère plus d’appearances futures.
- Un participant `left` ne génère plus d’appearances futures non jouées.
- Un instrument hidden ne participe plus au tableau visible.
- Une card reste dans sa colonne instrument.

### 5.2 Unicité dans une colonne

Une colonne ne peut pas contenir deux cards sur la même row résolue :

```txt
A.columnId = B.columnId
→ row(A) != row(B)
```

### 5.3 Played

Une card jouée ne bouge jamais.

Règles :

- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un ajout ultérieur ne peut pas modifier sa position historique ;
- un hole joué suit la même règle.

### 5.4 Locked

Une card locked ne bouge jamais tant qu’elle n’est pas unlock.

Règles :

- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un ajout ultérieur ne doit pas la décaler ;
- un hole locked suit la même règle.

### 5.5 Links

Un link actif impose :

```txt
row(A) = row(B) = row(C)...
```

Règles :

- les links ciblent des appearances/holes concrets, pas seulement des participants ;
- les links sont non orientés ;
- créer un link avec une target déjà linkée fusionne les groupes ;
- un groupe linké ne peut pas contenir deux cards de la même colonne ;
- un link ne peut pas contredire un conflict direct ;
- un link ne peut pas déplacer du played ou du locked.

### 5.6 Conflicts

Un conflict actif impose :

```txt
row(A) != row(B)
```

Règles :

- les conflicts sont non orientés ;
- `scope: appearance` concerne seulement les appearances ciblées ;
- `scope: participation` s’applique à toutes les appearances actuelles et futures des participations ciblées ;
- les conflicts `instrument_constraint` et `manual` utilisent le même resolver ;
- un conflict ne peut pas déplacer du played ou du locked.

### 5.7 Holes

- Un hole occupe une vraie position dans une colonne.
- Un hole peut être linked, conflicted, locked ou played selon son état.
- Un hole joué ou locked est fixe.
- Un hole ne génère pas de hole automatique dans les rounds suivants.

### 5.8 Rounds

Les rounds ne sont pas une contrainte d’ordre.

Règles :

- le round identifie l’occurrence d’une participation ;
- une appearance de round 2 peut être placée avant une appearance de round 1 si le solver en a besoin ;
- le reveal d’un round ajoute des appearances visibles, puis le solver résout l’ordre ;
- l’ajout d’une participation après reveal continue de créer une appearance par round visible, mais leur position finale dépend du solver.

---

## 6. Contraintes soft

Les contraintes soft servent à départager plusieurs solutions valides.

Le scoring exact est celui de la section 4.6. Résumé :

```txt
impossible : déplacer played
impossible : déplacer locked
impossible : changer de colonne
impossible : laisser une collision finale dans une colonne visible
très cher : laisser un link désaligné
très cher : laisser un conflict non résolu
cher : ne pas respecter l’intention de la dernière action
moyen : bouger une card indirectement concernée
faible : déplacer une card libre de quelques rows
faible : changer l’ordre relatif de cards non concernées
fallback : ordre précédent / ordre de création / id stable
```

Le round ne doit pas apparaître dans le coût de résolution.

Le solver doit minimiser :

- le nombre de cards déplacées ;
- la distance totale de déplacement ;
- les inversions d’ordre relatif non nécessaires ;
- les oscillations entre deux états ;
- les mouvements visuels non explicables.

---

## 7. États impossibles

Certains états ne doivent pas être réparés en boucle. Ils doivent être refusés avant transaction quand c’est évident, ou produire un `projectionWarning` pendant le replay.

Exemples :

```txt
A link B
A conflict B
→ impossible
```

```txt
A link B
A.columnId = B.columnId
→ impossible
```

```txt
A locked row 1
B locked row 3
A link B
→ impossible
```

```txt
A played row 1
B played row 3
A link B
→ impossible
```

```txt
A locked row 2
B locked row 2
A conflict B
→ impossible
```

Les warnings doivent suivre le format standard défini en section 4.3.

---

## 8. Algorithme de résolution

### 8.1 Pipeline global

```txt
Pour chaque transaction active :
  1. appliquer les events bruts au state projeté ;
  2. construire le context de transaction ;
  3. appeler resolveOrderAfterTransaction(state, context) ;
  4. écrire l’ordre résolu dans la projection ;
  5. continuer avec la transaction suivante.
```

Le resolver peut réconcilier tout le tableau visible. Il n’est pas obligé de limiter la résolution à une zone locale.

### 8.2 Pseudo-code

```js
function resolveOrderAfterTransaction(input) {
  const warnings = []

  const cards = buildVisibleCards(input.cards, input.hiddenColumnIds)
  const fixed = collectFixedCards(cards)
  const linkGroups = buildLinkGroups(input.links, cards)
  const conflicts = buildActiveConflicts(input.conflicts, cards)
  const constraints = buildConstraints(cards, fixed, linkGroups, conflicts)

  let layout = buildInitialLayout(cards, input.previousLayout)
  layout = applyTransactionIntent(layout, input.transactionContext)

  const structuralWarnings = detectStructuralImpossibleCases(layout, constraints)
  warnings.push(...structuralWarnings)
  markUnresolvableConstraintsAsIgnored(constraints, structuralWarnings)

  const seenLayoutHashes = new Set()

  for (let pass = 0; pass < RESOLUTION_LIMITS.MAX_PASSES; pass++) {
    const layoutHash = buildLayoutHash(layout, constraints)
    if (seenLayoutHashes.has(layoutHash)) {
      warnings.push(buildCycleDetectedWarning(input.transactionContext))
      break
    }
    seenLayoutHashes.add(layoutHash)

    const passResult = runResolutionPass(layout, constraints, input.transactionContext)
    layout = passResult.layout
    warnings.push(...passResult.warnings)

    if (passResult.stable) {
      break
    }

    if (passResult.repairCount > cards.length * RESOLUTION_LIMITS.MAX_REPAIRS_PER_PASS_MULTIPLIER) {
      warnings.push(buildMaxRepairsWarning(input.transactionContext))
      break
    }
  }

  const normalized = normalizeVisualIndexes(layout)

  return {
    layoutByCardId: normalized.layoutByCardId,
    orderedCardIdsByColumnId: normalized.orderedCardIdsByColumnId,
    visibleResolvedRows: normalized.visibleResolvedRows,
    projectionWarnings: warnings
  }
}
```

### 8.3 Ordre de traitement des violations

L’ordre canonique des passes est défini en section 4.9.

Résumé opérationnel :

```txt
1. résoudre les collisions de colonne ;
2. résoudre les links désalignés ;
3. résoudre à nouveau les collisions créées par les links ;
4. résoudre les conflicts ;
5. résoudre à nouveau les collisions créées par les conflicts ;
6. répéter jusqu’à stabilité ou warning d’impossibilité.
```

`played` et `locked` ne sont pas des violations à réparer. Ce sont des murs. Si une violation touche une card fixe, le solver tente de bouger les autres cards. Si toutes les cards concernées sont fixes, l’état est impossible.

Les conditions d’arrêt, limites de passes et détection de cycle sont définies en section 4.10.

---

## 9. Résolution des links

Pour chaque groupe linké, le solver choisit une row cible.

### Cas 1 — une card du groupe est fixe

```txt
A locked row 4
B libre
C libre
→ targetRow = 4
```

B et C doivent rejoindre la row 4 si leurs colonnes le permettent.

### Cas 2 — plusieurs cards fixes sur la même row

```txt
A locked row 4
B played row 4
C libre
→ targetRow = 4
```

C suit.

### Cas 3 — plusieurs cards fixes sur des rows différentes

```txt
A locked row 2
B played row 5
→ impossible
```

### Cas 4 — aucune card fixe

La row cible est choisie selon les règles canoniques de la section 4.8.

Résumé :

```txt
1. une target avec priorité de propagation >= 500 peut devenir la référence du groupe ;
2. sinon appliquer la stratégie enregistrée dans `link_created` : `move_to_first`, `move_to_last` ou `average_position` ;
3. si la targetRow initiale est bloquée, tester les candidateRows alternatives par coût croissant ;
4. si aucune candidateRow valide n’existe, produire un warning `link_unresolvable`.
```

La stratégie de link est copiée dans l’event au moment de `link_created`. Modifier la configuration de jam plus tard ne réinterprète pas rétroactivement les anciens links.

---

## 10. Résolution des collisions

Quand deux cards se retrouvent sur la même row dans une colonne, le solver applique la stratégie canonique de la section 4.5 : la card fixed ou la plus prioritaire garde la place, l’autre est poussée vers le slot valide le plus proche, en préférant le bas en cas d’égalité stricte.

Si la card poussée appartient à un link, cette card devient un relais de priorité pour son propre groupe linké selon les règles chiffrées de la section 4.7.

---

## 11. Résolution des conflicts

Si deux cards en conflict sont sur la même row, le solver déplace la card dont le coût de déplacement est le plus faible.

Critères :

```txt
1. ne jamais déplacer played
2. ne jamais déplacer locked
3. éviter de déplacer l’anchor
4. éviter de déplacer un groupe linké si cela coûte plus cher
5. déplacer la card libre vers le slot valide le plus proche
```

Si déplacer une card conflictuelle implique de déplacer son groupe linké, le solver évalue le coût du groupe complet.

Si aucune réparation ne peut séparer les deux cards sans déplacer du fixed, le solver retourne un warning.

---

## 12. Propagation de priorité

La propagation est obligatoire.

Cas validé :

```txt
A pousse B
B link C
→ C gagne une priorité sur les autres cards de sa colonne
```

Le solver doit maintenir une file de propagation conceptuelle en appliquant les valeurs canoniques de la section 4.7 :

```js
[
  { cardId: "A", reason: "user_move", priority: 1000 },
  { cardId: "B", reason: "pushed_by_A", priority: 800 },
  { cardId: "C", reason: "linked_to_B", priority: 700 }
]
```

Quand une card est déplacée ou poussée :

1. elle peut créer une collision dans sa colonne ;
2. la card poussée peut elle-même appartenir à un link ;
3. le link de cette card doit être réaligné ;
4. ce réalignement peut pousser d’autres cards ;
5. la propagation continue jusqu’à stabilité ou impossibilité.

Cela évite les comportements où un link marche une fois sur deux selon l’ordre des colonnes.

---

## 13. Normalisation finale

À la fin, le solver peut compacter l’affichage, mais uniquement en produisant un `visualIndex` global.

```txt
resolvedRows visibles globales : 1, 3, 7
visualIndex global correspondant : 1, 2, 3
```

La normalisation ne doit jamais réécrire les `resolvedRow`. Elle ajoute seulement une information d’affichage.

Règles :

```txt
- Deux cards ayant le même resolvedRow obtiennent toujours le même visualIndex.
- Une colonne sans card sur une row globale affiche une cellule vide, pas un hole.
- Le rang local d’une card dans sa colonne ne doit jamais servir à déduire un plateau joué.
- La composition des plateaux joués/verrouillés reste définie par resolvedRow.
```

---

## 14. Transactions qui déclenchent le resolver

Le resolver doit être appelé après toute transaction qui modifie l’ordre, les cards visibles ou les contraintes :

- ajout/retrait participation ;
- drag appearance/hole ;
- création/suppression link ;
- création/suppression conflict ;
- lock/unlock ;
- skip/remplacement depuis drawer d’appel ;
- hole ajouté/supprimé ;
- plateau played/unplayed ;
- reveal round ;
- participant left ;
- instrument hidden/shown ;
- undo/redo.

Même si une action ne semble rien déplacer, appeler le resolver doit être sans risque et idempotent.

---

## 15. Validation avant transaction vs replay défensif

La politique canonique complète est définie en sections 4.2 et 4.14.

### Avant transaction

L’UI doit refuser les actions manifestement impossibles : drag played/locked, skip played/locked, link même colonne, link avec conflict direct, conflict entre targets déjà linkées, conflict insoluble entre fixed déjà alignés, suppression de played, move horizontal.

Elle doit demander confirmation pour les actions destructives ou ambiguës : masquer une colonne liée, supprimer une appearance future, supprimer un hole, supprimer une target linkée, marquer `left` avec futures locked, choisir un remplaçant déjà linké.

### Pendant le replay

Si un event invalide existe malgré tout, la projection ne doit pas crasher.

Elle doit :

- préserver played/locked ;
- ignorer ou clamper l’intention impossible ;
- produire un `projectionWarning` stable ;
- continuer le replay.

---

## 16. Exemples de référence

### 16.1 Drag simple avec collision

```txt
Avant : A, B, C
Action : C déplacé entre A et B
Après : A, C, B
```

C garde la position demandée. B est poussée.

### 16.2 Drag qui pousse une card linkée

```txt
Chant   : A, B
Guitare : C, D
B link D
Action : A est déplacé après B, ce qui pousse B
```

B est poussée dans Chant. D doit suivre B en Guitare si elle est mobile. Si D pousse C ou une autre card, la propagation continue.

### 16.3 Link avec target fixe

```txt
A locked row 2
B libre row 5
A link B
```

B rejoint la row 2 si possible. A ne bouge pas.

### 16.4 Link impossible avec deux targets fixes

```txt
A locked row 2
B played row 5
A link B
```

Warning : link impossible, les deux targets sont fixes sur des rows différentes.

### 16.5 Conflict simple

```txt
A row 3
B row 3
A conflict B
```

Le solver déplace la card au coût le plus faible vers le slot valide le plus proche.

### 16.6 Conflict impossible

```txt
A locked row 3
B played row 3
A conflict B
```

Warning : conflict impossible, les deux targets sont fixes sur la même row.

### 16.7 Rounds mélangés

```txt
Avant : A r1, B r1, A r2, B r2
Contrainte : B r2 doit être alignée avec une card d’une autre colonne row 1
Après possible : B r2, A r1, B r1, A r2
```

Le résultat est valide si toutes les contraintes dures sont satisfaites. Le round n’interdit pas ce mélange.

### 16.8 Suppression de link ou conflict

Supprimer une contrainte ne restaure pas un ancien ordre. Le solver repart de l’ordre résolu courant et ne bouge que ce qui est nécessaire pour satisfaire les contraintes restantes.

---

## 17. Tests minimaux attendus

Le moteur doit avoir des tests couvrant au minimum les scénarios suivants, plus les invariants obligatoires de la section 4.15 et les fixtures canoniques de la section 4.27.

1. même event log rejoué deux fois → même projection exacte ;
2. drag simple qui pousse une card mobile ;
3. drag qui pousse une card linkée et propage son link ;
4. propagation en chaîne `A pousse B`, `B link C`, `C pousse D`, `D link E` ;
5. link aligné avec une target locked ;
6. link impossible avec deux targets fixed sur des rows différentes ;
7. link `move_to_first` choisissant la row la plus haute ;
8. link `move_to_last` choisissant la row la plus basse ;
9. link `average_position` avec arrondi canonique ;
10. link targetRow bloquée par une card fixed puis candidateRow alternative ;
11. conflict simple entre deux cards mobiles ;
12. conflict où une card est locked ;
13. conflict impossible entre deux cards fixed ;
14. création de link refusée si conflict direct ;
15. création de link refusée si deux targets dans la même colonne ;
16. création de conflict refusée si les targets sont déjà dans le même link group ;
17. suppression de link ne provoquant pas un retour magique à l’ancien ordre ;
18. suppression de conflict ne provoquant pas un retour magique à l’ancien ordre ;
19. reveal round puis résolution par solver ;
20. mélange de rounds autorisé si nécessaire ;
21. played empêchant toute modification de sa position ;
22. locked empêchant toute modification de sa position ;
23. hidden column ignorée par le resolver visible ;
24. réaffichage d’une hidden column relançant une résolution stable ;
25. hole mobile traité comme une card normale ;
26. hole played/locked immobile ;
27. hole de `jouer sans` membre d’un link group explicite ;
28. `appearance_skipped` délinkant puis repoussant uniquement l’appearance ciblée ;
29. skip avec remplaçant déjà linked nécessitant confirmation UI ;
30. collision entre deux cards mobiles : garde la plus prioritaire et pousse vers le slot valide le plus proche ;
31. collision avec une card fixed : la fixed garde sa row ;
32. cycle détecté avec warning `resolver_cycle_detected` ;
33. max passes atteint avec warning `resolver_max_passes_reached` ;
34. `projectionWarnings` produits au format standard ;
35. `resolvedRow` stable pour played/locked malgré normalisation `visualIndex` ;
36. deux cards avec le même `resolvedRow` obtiennent le même `visualIndex` global ;
37. le rang local dans une colonne ne sert jamais à définir un plateau logique ;
38. score égal départagé par ordre précédent, ordre de création, puis id ;
39. undo/redo linéaire puis replay cohérent.
