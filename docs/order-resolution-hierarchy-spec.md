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

### Row résolue

La row résolue est la ligne logique utilisée par le solver pour aligner les links et séparer les conflicts.

Elle peut être différente de l’index visuel compact final. Une normalisation visuelle peut être faite à la fin si elle ne modifie pas la composition des plateaux joués ou verrouillés.

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
layout_cycle_detected
hidden_column_not_resolved
```

L’UI organisateur n’affiche pas forcément tous les warnings. En revanche, le moteur doit toujours les produire pour debug, tests et admin.

### 4.4 Définition exacte de `resolvedRow` et `visualIndex`

Le resolver doit distinguer deux notions.

```txt
resolvedRow = ligne logique utilisée pour links, conflicts, played, locked et collisions.
visualIndex = index compact utilisé pour afficher une colonne dans l’UI.
```

Règles :

```txt
- `resolvedRow` est la valeur de référence pour déterminer si deux cards sont sur le même plateau logique.
- `visualIndex` peut être recalculé à la fin pour afficher une liste compacte.
- Une card played conserve son `resolvedRow` historique.
- Une card locked conserve son `resolvedRow` tant qu’elle reste locked.
- La normalisation visuelle ne doit jamais changer la composition des plateaux joués ou verrouillés.
- Les tests de links/conflicts utilisent `resolvedRow`, jamais `visualIndex`.
```

En cas d’ambiguïté, le mot `row` dans la spec resolver signifie `resolvedRow`.

Exemple autorisé :

```txt
resolvedRows internes : 1, 3, 7
visualIndex affiché   : 1, 2, 3
```

Exemple interdit :

```txt
A played resolvedRow 4
normalisation finale → A resolvedRow 2
```

Une normalisation compacte peut produire un `visualIndex`, mais ne doit pas réécrire les `resolvedRow` fixes.

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

Le solver cherche les violations dans cet ordre :

```txt
1. collision dans une même colonne
2. link désaligné
3. conflict sur la même row
4. intention de transaction non respectée
5. instabilité excessive / mouvements inutiles
```

`played` et `locked` ne sont pas des violations à réparer. Ce sont des murs. Si une violation touche une card fixe, le solver tente de bouger les autres cards. Si toutes les cards concernées sont fixes, l’état est impossible.

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

La row cible dépend de la stratégie copiée au moment de `link_created` :

```txt
move_to_first
move_to_last
average_position
```

- `move_to_first` : row la plus haute des targets.
- `move_to_last` : row la plus basse des targets.
- `average_position` : moyenne des rows des targets, arrondie vers la row la plus haute en cas d’égalité.

Si une target a été déplacée par la dernière action ou poussée par propagation, elle peut devenir la référence prioritaire du groupe pour cette passe.

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

À la fin, le solver peut compacter l’affichage des colonnes :

```txt
rows internes : 1, 3, 7
index visuel : 1, 2, 3
```

Mais il ne doit jamais changer la composition ou l’ordre historique des plateaux joués/verrouillés.

Recommandation : distinguer deux notions :

```txt
resolvedRow  = row logique utilisée par les contraintes
visualIndex  = index compact pour affichage
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

### Avant transaction

L’UI doit refuser une action manifestement impossible :

- déplacer une card played ;
- déplacer une card locked ;
- créer un link avec deux targets dans la même colonne ;
- créer un link entre deux targets en conflict direct ;
- créer un conflict impossible à résoudre entre deux cards fixes déjà alignées.

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

Le moteur doit avoir des tests couvrant au minimum :

1. même event log rejoué deux fois → même projection exacte ;
2. drag simple qui pousse une card mobile ;
3. drag qui pousse une card linkée et propage son link ;
4. propagation en chaîne `A pousse B`, `B link C`, `C pousse D`, `D link E` ;
5. link aligné avec une target locked ;
6. link impossible avec deux targets fixed sur des rows différentes ;
7. conflict simple entre deux cards mobiles ;
8. conflict où une card est locked ;
9. conflict impossible entre deux cards fixed ;
10. création de link refusée si conflict direct ;
11. création de link refusée si deux targets dans la même colonne ;
12. suppression de link ne provoquant pas un retour magique à l’ancien ordre ;
13. suppression de conflict ne provoquant pas un retour magique à l’ancien ordre ;
14. reveal round puis résolution par solver ;
15. mélange de rounds autorisé si nécessaire ;
16. played empêchant toute modification de sa position ;
17. locked empêchant toute modification de sa position ;
18. undo/redo linéaire puis replay cohérent.
