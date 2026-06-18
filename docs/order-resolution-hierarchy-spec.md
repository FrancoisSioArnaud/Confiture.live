# V0 — Résolution d’ordre déterministe et hiérarchie des contraintes

Ce document définit la logique officielle de résolution d’ordre du tableau Confiture.live V0.

Il complète et prime sur les anciennes formulations dispersées dans :

- `projection-engine-spec.md` ;
- `confiture_event_actions_spec.md` ;
- `v0-round-order-and-no-between-cards.md` ;
- `event-payloads-reference.md`.

Objectif : garantir qu’à partir du même historique d’events, le frontend et le backend reconstruisent toujours exactement le même tableau, action après action.

---

## 1. Principe fondamental

La source de vérité n’est pas l’ordre affiché courant.

La source de vérité est :

```txt
eventLog ordonné + transactions actives + configuration de jam
```

La projection doit être recalculée de manière déterministe :

```txt
état initial
→ transaction 1 appliquée
→ résolution d’ordre
→ transaction 2 appliquée
→ résolution d’ordre
→ transaction 3 appliquée
→ résolution d’ordre
→ état final
```

Même entrée = même sortie.

Cela signifie :

- aucune action ne doit appliquer seulement un déplacement local isolé ;
- chaque action qui modifie l’ordre ou les contraintes déclenche une réconciliation par le moteur ;
- la dernière action fournit une intention principale, appelée `anchor` ;
- le moteur conserve cette intention autant que possible ;
- les autres cards se réorganisent autour en respectant la hiérarchie des contraintes ;
- le résultat doit être rejouable depuis zéro sans dépendre d’un état React, d’un cache UI ou d’un ordre DOM.

Formulation produit :

```txt
La dernière action utilisateur exprime l’intention principale.
Le moteur conserve cette intention autant que possible, puis réorganise les autres cards pour respecter les contraintes, dans l’ordre : played, locked, anchor, décisions d’appel, conflicts, links, manual order, round order, base order.
```

---

## 2. Projection, events et états dérivés

### 2.1 Les events décrivent les intentions

Les events ne doivent pas forcément lister tous les déplacements induits par le moteur.

Exemple :

```txt
Utilisateur déplace A.
A est linké à C.
A conflict avec B.
```

La transaction peut contenir seulement l’intention principale :

```txt
appearance_moved_between(A, afterTarget, beforeTarget)
```

Puis le resolver déterministe doit produire :

```txt
A reste au plus proche de la position demandée.
C suit A à cause du link.
B est poussé à cause du conflict.
```

Ces déplacements induits sont des **résultats de projection**, pas nécessairement des events supplémentaires.

### 2.2 La projection peut stocker des champs dérivés

Pendant le replay, le moteur peut écrire dans la projection des champs dérivés, par exemple :

```js
{
  resolvedOrderKey: "...",
  resolvedPlateauIndex: 4,
  playedAtPlateauIndex: 3,
  frozenOrderKey: "...",
  lastManualOrderKey: "..."
}
```

Ces champs sont recalculables depuis l’eventLog. Ils peuvent apparaître dans un snapshot, mais ne remplacent jamais les events comme source de vérité.

### 2.3 Pas d’effet caché non déterministe

Interdit dans le moteur de résolution :

- `Date.now()` ;
- `Math.random()` ;
- lecture du DOM ;
- lecture IndexedDB/localStorage ;
- ordre dépendant de l’itération non stable d’un objet ;
- résolution différente selon le navigateur.

Chaque tie-break doit avoir un fallback stable explicite.

---

## 3. Vocabulaire

### Card

Une card est une cible ordonnable du tableau :

- `appearance` ;
- `hole`.

### Plateau résolu

Un plateau résolu est une ligne visuelle du tableau après réconciliation.

Le plateau résolu peut être différent du simple tri naturel `round ASC / position ASC` si des contraintes fortes s’appliquent.

### Anchor

L’`anchor` est la card ou le groupe de cards qui exprime l’intention principale de la dernière action utilisateur.

| Action | Anchor |
|---|---|
| `appearance_moved_between` | appearance déplacée |
| `hole_moved_between` | hole déplacé |
| `link_created` | card d’origine du mode link (`anchorTarget`) |
| `conflict_created` | card d’origine du mode conflict (`anchorTargetId`) |
| `participation_added` | nouvelle appearance du round concerné, avec intention de fin de round visible |
| `hole_added` | nouveau hole, avec intention de position issue de l’action |
| `appearance_skipped` | décision d’appel : skipped + replacement/hole éventuel |
| `plateau_played` | targets du plateau joué, désormais figées |
| `appearance_locked` / `hole_locked` | card lockée, figée à sa position courante |
| `round_revealed` | pas d’anchor forte ; ordre naturel + contraintes existantes |
| `link_removed` / `conflict_removed` | pas d’anchor forte ; préserver l’ordre résolu courant si rien n’oblige à bouger |

L’anchor est forte, mais pas absolue : elle ne peut jamais battre `played` ou `locked`.

### Zone impactée

La zone impactée est l’ensemble minimal à réconcilier :

- colonne de l’anchor ;
- colonnes des cards linkées à l’anchor ;
- colonnes contenant des conflicts actifs avec l’anchor ;
- colonnes contenant une card déplacée en cascade.

En V0, il est acceptable de réconcilier tout le tableau visible si l’algorithme reste déterministe et suffisamment simple.

---

## 4. Hiérarchie officielle

Ordre du plus prioritaire au moins prioritaire :

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

### 0. `removed / left / hidden`

Ce niveau filtre les cards avant résolution.

- Une appearance supprimée n’est pas affichée.
- Un hole supprimé n’est pas affiché.
- Une participation supprimée ne génère plus d’appearances futures.
- Un participant `left` ne génère plus d’appearances futures non jouées.
- Un instrument hidden n’apparaît plus dans le tableau ni dans le drawer d’appel.

Exception : l’historique joué reste visible si la spec le prévoit.

### 1. `played`

Une card jouée est immobile.

Règles :

- une card jouée ne bouge plus ;
- un ajout ultérieur ne peut pas passer devant elle si cela modifie son ordre visuel ;
- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un lock est secondaire sur une card jouée, car `played` est déjà plus fort.

Le moteur doit conserver l’ordre historique de jeu des cards jouées. Pour cela, au moment de `plateau_played`, la projection doit figer au minimum :

```txt
playedAtPlateauIndex
frozenOrderKey ou frozenResolvedIndex
```

Ces champs peuvent être dérivés pendant le replay.

### 2. `locked`

Une card lockée non jouée est figée tant qu’elle n’est pas unlock.

Règles :

- une card lockée ne bouge pas ;
- un drag ne peut pas la déplacer ;
- un link ne peut pas la réaligner ;
- un conflict ne peut pas la repousser ;
- un ajout ultérieur ne doit pas passer devant si cela implique de la décaler.

Différence :

```txt
played = historique réel, immuable
locked = intention organisateur, réversible via unlock
```

### 3. Anchor de la dernière action utilisateur

L’anchor indique quelle card doit être préservée lorsque plusieurs cards non figées se gênent.

Règles :

- l’anchor doit rester au plus proche possible de la position demandée ;
- les autres cards non jouées et non lockées se réorganisent autour ;
- l’anchor peut pousser une autre card conflictuelle ;
- l’anchor peut entraîner son groupe linké ;
- l’anchor ne peut jamais déplacer du `played` ou du `locked`.

Exemple :

```txt
A est déplacé sur le plateau 3.
B est déjà plateau 3.
A conflict B.
A est l’anchor.
```

Résultat attendu si B est mobile :

```txt
A reste plateau 3.
B est déplacé au premier slot suivant valide.
```

Si B est joué ou locké, le déplacement de A est refusé ou clampé avec warning en replay.

### 4. Décisions d’appel

Les décisions prises dans le drawer d’appel sont prioritaires, car elles concernent le plateau en cours.

Exemples :

- `appearance_skipped` ;
- remplacement par un autre musicien ;
- “faire sans musicien”.

Règles :

- ces décisions ne doivent pas être annulées implicitement par un ajout, un reveal round ou une réorganisation automatique ;
- elles ne peuvent pas déplacer du `played` ou du `locked` ;
- si la décision est impossible à cause d’une contrainte forte, l’action doit être refusée avec snackbar avant création de transaction.

### 5. `conflict`

Un conflict est une interdiction de cohabitation.

Règles :

- deux cards en conflict ne peuvent pas rester sur le même plateau ;
- un conflict gagne contre un link ;
- un conflict peut déplacer des cards non jouées, non lockées et non anchor ;
- si le conflict concerne l’anchor et une autre card mobile, l’autre card bouge ;
- si aucune résolution valide n’existe, l’action est refusée.

### 6. `link`

Un link est une contrainte positive : jouer ensemble.

Règles :

- un link essaye d’aligner ses targets sur le même plateau ;
- si une card linkée est déplacée, le groupe linké doit suivre ;
- aucun déplacement partiel du groupe linké n’est autorisé via drag ;
- le link ne peut pas violer un conflict ;
- le link ne peut pas déplacer du `played` ou du `locked`.

Si un déplacement manuel d’une card linkée crée un conflict avec une autre card, le moteur essaye d’abord de déplacer l’autre card conflictuelle. Si c’est impossible, le déplacement est refusé.

### 7. `manual order` existant

Le manual order représente les préférences d’ordre déjà enregistrées par drag.

Règles :

- il prime sur l’ordre automatique ;
- il ne prime pas sur `played` ;
- il ne prime pas sur `locked` ;
- il ne prime pas sur l’anchor de la dernière action ;
- il ne prime pas sur conflicts ou links actifs.

### 8. `round / appearanceIndex`

Le round structure l’ordre naturel :

```txt
round 1 complet
round 2 complet
round 3 complet
```

Cette règle est inférieure aux décisions humaines et aux contraintes.

### 9. `base order`

Ordre d’arrivée ou ordre de base de la participation dans son instrument.

Exemple :

```txt
A, B, C
Ajout D
→ A, B, C, D
```

### 10. Fallback stable par id

Dernier recours pour garantir une projection déterministe.

---


### 5.1 Contraintes inter-colonnes uniquement

En V0, `link` et `conflict` sont des contraintes de plateau entre colonnes différentes.

Règles officielles :

- un `link` ne peut jamais relier deux cards de la même colonne / du même instrument ;
- un `conflict` ne peut jamais relier deux cards de la même colonne / du même instrument ;
- l'UI doit refuser la sélection dès que les deux targets sont dans la même colonne ;
- les builders de transactions doivent retourner `null` ou refuser la transaction si cette règle est violée ;
- le resolver doit rester défensif : si un ancien event invalide existe malgré tout dans l'event log, il doit ignorer/supprimer la contrainte pour le calcul visible, ajouter un `projectionWarning` déterministe, et ne pas réorganiser la colonne ;
- le backend peut valider la forme du payload, mais la validation métier complète dépend de la projection car le payload ne contient pas forcément l'instrument de chaque target.

Raison produit : dans une même colonne, deux cards sont déjà ordonnées verticalement. Un link ou conflict a du sens uniquement pour aligner ou séparer des cards situées dans des colonnes différentes sur un même plateau visuel.

## 5. Quand lancer la résolution

La résolution doit être lancée après chaque transaction appliquée.

Elle est particulièrement importante après :

- `participation_added` ;
- `participation_removed` ;
- `appearance_moved_between` ;
- `hole_moved_between` ;
- `link_created` ;
- `link_removed` ;
- `conflict_created` ;
- `conflict_removed` ;
- `appearance_locked` ;
- `appearance_unlocked` ;
- `hole_locked` ;
- `hole_unlocked` ;
- `appearance_skipped` ;
- remplacement depuis drawer d’appel ;
- `hole_added` ;
- `hole_removed` ;
- `plateau_played` ;
- `plateau_unplayed` ;
- `round_revealed` ;
- `participant_marked_left` ;
- instrument hidden/shown.

Même si une action ne semble pas déplacer de card, le resolver peut être lancé sans risque : il doit être idempotent.

---

## 6. Algorithme conceptuel recommandé

Pseudo-flux :

```txt
Pour chaque transaction active, dans l’ordre déterministe :
  1. appliquer ses events bruts au state projeté ;
  2. déterminer l’anchor et l’intention d’ordre de cette transaction ;
  3. appeler resolveOrderAfterTransaction(state, context) ;
  4. écrire dans la projection l’ordre résolu déterministe.
```

À l’intérieur du resolver :

```txt
1. Construire les cards visibles actives.
2. Partir de l’ordre résolu précédent de la projection.
3. Appliquer les filtres removed / left / hidden.
4. Identifier et figer played.
5. Identifier et figer locked.
6. Identifier l’anchor et sa position souhaitée.
7. Construire les groupes linkés.
8. Placer l’anchor ou son groupe au plus proche de l’intention demandée.
9. Résoudre les conflicts en déplaçant la card la moins prioritaire.
10. Réconcilier les links restants sans violer les conflicts.
11. Préserver le manual order existant quand il ne contredit pas les contraintes fortes.
12. Compléter avec round / appearanceIndex, puis base order, puis id.
13. Répéter jusqu’à stabilisation ou impossibilité explicite.
```

La résolution doit avoir un nombre maximal d’itérations pour éviter les boucles infinies. Si ce maximum est atteint, le moteur doit produire un `projectionWarning` déterministe.

---

## 7. Validation avant transaction vs replay défensif

### 7.1 Avant création de transaction

L’UI doit refuser une action si elle sait que la résolution nécessiterait de :

- déplacer une card `played` ;
- déplacer une card `locked` ;
- violer un conflict ;
- casser un link sans action explicite de délink ;
- déplacer une card hors de sa colonne ;
- créer un ordre non déterministe.

### 7.2 Pendant le replay

Si un event invalide existe malgré tout dans l’historique, la projection ne doit pas crasher.

Elle doit :

- conserver les contraintes fortes ;
- ignorer ou clamper l’intention impossible ;
- produire un `projectionWarning` ;
- continuer le replay de manière déterministe.

---

## 8. Exemples de référence

### 8.1 Ajout après un préfixe joué

État avant :

```txt
A joué
B joué
C joué
A' joué
B'
C'
```

Ajout de D.

La règle round-first normale voudrait :

```txt
A, B, C, D, A', B', C', D'
```

Mais `A'` est déjà joué. Le résultat attendu est :

```txt
A, B, C, A', D, B', C', D'
```

`played` gagne sur le round-first.

### 8.2 Drag qui crée un conflict

```txt
Utilisateur déplace A sur le plateau de B.
A conflict B.
A est l’anchor.
B n’est ni played ni locked.
```

Résultat :

```txt
A reste à la position demandée.
B est déplacé au premier slot suivant valide.
```

Si B est `played` ou `locked`, le déplacement de A est refusé.

### 8.3 Drag d’une card linkée

```txt
A est linké à C.
Utilisateur déplace A.
```

Résultat :

```txt
A bouge.
C suit A pour rester sur le même plateau.
```

Si C ne peut pas suivre à cause de `played`, `locked` ou conflict non résoluble, le déplacement est refusé.

### 8.4 Drag d’une card linkée avec conflict externe

```txt
A est linké à C.
Utilisateur déplace A au plateau de B.
A conflict B.
A est l’anchor.
C appartient au groupe linké de A.
B est mobile.
```

Résultat :

```txt
A et C sont positionnés ensemble.
B est déplacé au premier slot suivant valide.
```

Si B est `played` ou `locked`, le déplacement est refusé.

### 8.5 Création de link contradictoire

```txt
A conflict C.
Utilisateur essaye de linker A et C.
```

Résultat :

```txt
Le link est refusé.
Snackbar : Impossible de créer ce link : ces passages ont un conflit.
```

### 8.6 Suppression de link ou conflict

Supprimer un link ou un conflict ne doit pas faire “revenir magiquement” les cards à un ancien ordre.

Le resolver est relancé, mais il part de l’ordre résolu courant. Si aucune contrainte active n’oblige à bouger, l’ordre reste stable.

---

## 9. Tests minimaux attendus

Le moteur doit avoir des tests couvrant au minimum :

1. même event log rejoué deux fois → même projection exacte ;
2. ajout D après `A, B, C, A'` joués ;
3. drag A sur B avec conflict, B mobile ;
4. drag A sur B avec conflict, B played ;
5. drag A linké à C ;
6. drag A linké à C avec conflict externe mobile ;
7. drag A linké à C avec conflict externe locked ;
8. création de link refusée si conflict direct ;
9. lock empêchant une insertion ultérieure de passer devant ;
10. suppression de conflict ne provoquant pas un retour magique à l’ordre ancien ;
11. suppression de link ne provoquant pas un retour magique à l’ordre ancien ;
12. `round_revealed` respectant played/locked/manual/link/conflict ;
13. replay après undo linéaire produisant un état cohérent.
