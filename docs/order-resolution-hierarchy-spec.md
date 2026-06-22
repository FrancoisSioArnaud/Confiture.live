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

## 4. Contraintes dures

Les contraintes dures doivent être satisfaites ou produire un warning/refus explicite.

### 4.1 Visibilité et appartenance

- Une card supprimée n’est pas affichée.
- Une participation supprimée ne génère plus d’appearances futures.
- Un participant `left` ne génère plus d’appearances futures non jouées.
- Un instrument hidden ne participe plus au tableau visible.
- Une card reste dans sa colonne instrument.

### 4.2 Unicité dans une colonne

Une colonne ne peut pas contenir deux cards sur la même row résolue :

```txt
A.columnId = B.columnId
→ row(A) != row(B)
```

### 4.3 Played

Une card jouée ne bouge jamais.

Règles :

- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un ajout ultérieur ne peut pas modifier sa position historique ;
- un hole joué suit la même règle.

### 4.4 Locked

Une card locked ne bouge jamais tant qu’elle n’est pas unlock.

Règles :

- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un ajout ultérieur ne doit pas la décaler ;
- un hole locked suit la même règle.

### 4.5 Links

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

### 4.6 Conflicts

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

### 4.7 Holes

- Un hole occupe une vraie position dans une colonne.
- Un hole peut être linked, conflicted, locked ou played selon son état.
- Un hole joué ou locked est fixe.
- Un hole ne génère pas de hole automatique dans les rounds suivants.

### 4.8 Rounds

Les rounds ne sont pas une contrainte d’ordre.

Règles :

- le round identifie l’occurrence d’une participation ;
- une appearance de round 2 peut être placée avant une appearance de round 1 si le solver en a besoin ;
- le reveal d’un round ajoute des appearances visibles, puis le solver résout l’ordre ;
- l’ajout d’une participation après reveal continue de créer une appearance par round visible, mais leur position finale dépend du solver.

---

## 5. Contraintes soft

Les contraintes soft servent à départager plusieurs solutions valides.

Priorités de coût recommandées :

```txt
interdit : déplacer played
interdit : déplacer locked
très cher : laisser un link désaligné
très cher : laisser un conflict non résolu
cher : ne pas respecter l’intention de la dernière action
moyen : bouger une card indirectement concernée
faible : déplacer une card libre de quelques rows
faible : changer l’ordre relatif de cards non concernées
fallback : ordre de création / id stable
```

Le round ne doit pas apparaître dans le coût de résolution.

Le solver doit minimiser :

- le nombre de cards déplacées ;
- la distance totale de déplacement ;
- les inversions d’ordre relatif non nécessaires ;
- les oscillations entre deux états ;
- les mouvements visuels non explicables.

---

## 6. États impossibles

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

Warning recommandé :

```js
{
  type: "link_unresolvable",
  reason: "linked_cards_fixed_on_different_rows",
  cardIds: ["appearance_a", "appearance_b"]
}
```

---

## 7. Algorithme de résolution

### 7.1 Pipeline global

```txt
Pour chaque transaction active :
  1. appliquer les events bruts au state projeté ;
  2. construire le context de transaction ;
  3. appeler resolveOrderAfterTransaction(state, context) ;
  4. écrire l’ordre résolu dans la projection ;
  5. continuer avec la transaction suivante.
```

Le resolver peut réconcilier tout le tableau visible. Il n’est pas obligé de limiter la résolution à une zone locale.

### 7.2 Pseudo-code

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

### 7.3 Ordre de traitement des violations

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

## 8. Résolution des links

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

## 9. Résolution des collisions

Quand deux cards se retrouvent sur la même row dans une colonne, le solver garde la card la plus prioritaire et pousse l’autre vers le slot valide le plus proche.

Priorité :

```txt
1. played
2. locked
3. anchor ou card directement manipulée
4. card poussée par propagation prioritaire
5. card appartenant à un groupe linké en cours d’alignement
6. card la plus stable dans l’ordre précédent
7. id stable
```

Si la card poussée appartient à un link, cette card devient un relais de priorité pour son propre groupe linké.

---

## 10. Résolution des conflicts

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

## 11. Propagation de priorité

La propagation est obligatoire.

Cas validé :

```txt
A pousse B
B link C
→ C gagne une priorité sur les autres cards de sa colonne
```

Le solver doit maintenir une file de propagation conceptuelle :

```js
[
  { cardId: "A", reason: "user_move", priority: 100 },
  { cardId: "B", reason: "pushed_by_A", priority: 80 },
  { cardId: "C", reason: "linked_to_B", priority: 70 }
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

## 12. Normalisation finale

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

## 13. Transactions qui déclenchent le resolver

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

## 14. Validation avant transaction vs replay défensif

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

## 15. Exemples de référence

### 15.1 Drag simple avec collision

```txt
Avant : A, B, C
Action : C déplacé entre A et B
Après : A, C, B
```

C garde la position demandée. B est poussée.

### 15.2 Drag qui pousse une card linkée

```txt
Chant   : A, B
Guitare : C, D
B link D
Action : A est déplacé après B, ce qui pousse B
```

B est poussée dans Chant. D doit suivre B en Guitare si elle est mobile. Si D pousse C ou une autre card, la propagation continue.

### 15.3 Link avec target fixe

```txt
A locked row 2
B libre row 5
A link B
```

B rejoint la row 2 si possible. A ne bouge pas.

### 15.4 Link impossible avec deux targets fixes

```txt
A locked row 2
B played row 5
A link B
```

Warning : link impossible, les deux targets sont fixes sur des rows différentes.

### 15.5 Conflict simple

```txt
A row 3
B row 3
A conflict B
```

Le solver déplace la card au coût le plus faible vers le slot valide le plus proche.

### 15.6 Conflict impossible

```txt
A locked row 3
B played row 3
A conflict B
```

Warning : conflict impossible, les deux targets sont fixes sur la même row.

### 15.7 Rounds mélangés

```txt
Avant : A r1, B r1, A r2, B r2
Contrainte : B r2 doit être alignée avec une card d’une autre colonne row 1
Après possible : B r2, A r1, B r1, A r2
```

Le résultat est valide si toutes les contraintes dures sont satisfaites. Le round n’interdit pas ce mélange.

### 15.8 Suppression de link ou conflict

Supprimer une contrainte ne restaure pas un ancien ordre. Le solver repart de l’ordre résolu courant et ne bouge que ce qui est nécessaire pour satisfaire les contraintes restantes.

---

## 16. Tests minimaux attendus

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
