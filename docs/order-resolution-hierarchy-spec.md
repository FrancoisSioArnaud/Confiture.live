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
- si aucune réparation valide n’existe pour la violation prioritaire : warning ciblé puis arrêt propre ;
- si MAX_PASSES est atteint : warning `resolver_max_passes_reached` ;
- si MAX_REPAIRS_PER_PASS est atteint : warning `resolver_max_passes_reached` reason `max_repairs_per_pass_reached` ;
- si le même layoutHash revient deux fois dans la même résolution : warning `resolver_cycle_detected` ;
- si aucune candidateRow valide n’est trouvée dans MAX_CANDIDATE_ROW_DISTANCE : warning ciblé selon la violation en cours.
```

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
function resolveOrderAfterTransaction(state, context) {
  const cards = buildVisibleCards(state)
  const fixed = collectFixedCards(cards)
  const linkGroups = buildLinkGroups(state.links, cards)
  const conflicts = buildActiveConflicts(state.conflicts, cards)
  const constraints = buildConstraints(cards, fixed, linkGroups, conflicts)

  let layout = buildInitialLayout(cards, state.previousResolvedLayout)
  layout = applyTransactionIntent(layout, context)

  const structuralWarnings = detectStructuralImpossibleCases(layout, constraints)
  if (structuralWarnings.length > 0) {
    return { layout: normalizeLayout(layout), warnings: structuralWarnings }
  }

  for (let pass = 0; pass < MAX_RESOLUTION_PASSES; pass++) {
    const violations = findViolations(layout, constraints)

    if (violations.length === 0) {
      return { layout: normalizeLayout(layout), warnings: [] }
    }

    const violation = pickHighestPriorityViolation(violations)
    const repairs = findPossibleRepairs(layout, violation, constraints, context)

    if (repairs.length === 0) {
      return {
        layout: normalizeLayout(layout),
        warnings: [buildUnresolvedViolationWarning(violation)]
      }
    }

    const repair = chooseLowestCostRepair(repairs, context)
    layout = applyRepair(layout, repair)
  }

  return {
    layout: normalizeLayout(layout),
    warnings: [{ type: "resolver_max_passes_reached" }]
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

Le moteur doit avoir des tests couvrant au minimum les scénarios suivants, plus les invariants obligatoires de la section 4.15.

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
