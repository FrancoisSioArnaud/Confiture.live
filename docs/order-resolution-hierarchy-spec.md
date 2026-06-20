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

Autre cas important :

```txt
A est linké à C.
D est déplacé devant C dans la colonne de C.
```

La transaction peut seulement exprimer :

```txt
appearance_moved_between(D, beforeTarget=C)
```

Le resolver doit conserver ce déplacement de D, constater que C a été décalé, puis déplacer A pour rester aligné avec C. Le déplacement de D ne doit pas être refusé ni annulé simplement parce que C a un link.

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
| `link_created` | pas d’anchor de contrainte ; le link est un groupe non orienté |
| `conflict_created` | pas d’anchor de contrainte ; le conflict est une interdiction non orientée |
| `participation_added` | nouvelle appearance du round concerné, avec intention de fin de round visible |
| `hole_added` | nouveau hole, avec intention de position issue de l’action |
| `appearance_skipped` | décision d’appel : skipped + replacement/hole éventuel |
| `plateau_played` | targets du plateau joué, désormais figées |
| `appearance_locked` / `hole_locked` | card lockée, figée à sa position courante |
| `round_revealed` | pas d’anchor forte ; ordre naturel + contraintes existantes |
| `link_removed` / `conflict_removed` | pas d’anchor forte ; préserver l’ordre résolu courant si rien n’oblige à bouger |

L’anchor vient d’une action utilisateur concrète, par exemple un drag manuel. Un link ou conflict créé ne porte plus d’anchor métier : son sens de création ne doit pas influencer la résolution. L’anchor est forte, mais pas absolue : elle ne peut jamais battre `played` ou `locked`.


### Links non orientés

Un link est un groupe non orienté de targets. Il n’a pas d’anchor. Créer le même link depuis A, B ou C doit produire le même résultat.

Règles :

- un link actif contient toujours au moins deux targets ;
- une target ne peut appartenir qu’à un seul groupe link actif ;
- créer un link avec une target déjà linkée fusionne les groupes concernés ;
- retirer une target d’un link conserve le link restant si au moins deux targets restent ;
- si moins de deux targets restent, le link est supprimé ;
- supprimer une target ou un link ne provoque pas de retour magique de l’ordre courant.

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
B est déplacé vers le slot valide le plus proche.
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

- un conflict est uniquement inter-colonnes en V0 : il ne peut pas cibler deux cards du même instrument ;
- deux cards en conflict ne peuvent pas rester sur le même plateau, quel que soit le sens de création du conflict ;
- le conflict est une contrainte bidirectionnelle : `A → C` et `C → A` créent la même interdiction de cohabitation ;
- le sens de création sert seulement à définir l’anchor préférée au moment de la résolution ;
- `scope: appearance` concerne uniquement les appearances ciblées ;
- `scope: participation` concerne toute la soirée : toutes les appearances actuelles et futures issues des participations ciblées héritent du conflict ;
- quand un round suivant est révélé, le resolver réapplique les conflicts `scope: participation` aux nouvelles appearances matérialisées ;
- un conflict `scope: participation` doit séparer `A'` et `C'` de la même manière qu’il sépare `A` et `C` si ces appearances se retrouvent sur le même plateau ;
- un conflict gagne contre un link ;
- si le conflict concerne l’anchor et une autre card mobile, l’autre card bouge ;
- si la card à déplacer ne peut pas descendre, le resolver peut chercher un slot valide au-dessus ;
- si aucune résolution valide n’existe sans déplacer du `played` ou du `locked`, l’action est refusée ou produit un warning déterministe.

### 6. `link`

Un link est une contrainte positive : jouer ensemble.

Règles :

- un link est uniquement inter-colonnes en V0 : il ne peut pas cibler deux cards du même instrument ;
- un link essaye d’aligner ses targets sur le même plateau ;
- une card linkée reste déplaçable tant qu’elle n’est ni `played` ni `locked` ;
- si une card linkée est déplacée, le groupe linké doit suivre ;
- si une card non linkée est déplacée avant/après une card linkée et décale cette card linkée, les autres targets du link doivent suivre la card linkée déplacée ;
- aucun déplacement manuel ne doit être refusé uniquement parce qu’il touche une zone contenant un link ;
- aucun déplacement partiel durable du groupe linké n’est autorisé dans l’ordre résolu final ;
- le link ne peut pas violer un conflict ;
- le link ne peut pas déplacer du `played` ou du `locked`.

Si un déplacement manuel d’une card linkée crée un conflict avec une autre card, le moteur essaye d’abord de déplacer l’autre card conflictuelle. Si une card non-linkée décale une target linkée, le resolver conserve le déplacement manuel et réaligne le reste du groupe linké autour de la target décalée.

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
10. Réconcilier les links restants sans violer les conflicts, en tenant compte des link targets éventuellement déplacées par une card non linkée.
11. Préserver le manual order existant quand il ne contredit pas `played`, `locked` ou un conflict impossible à résoudre.
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
B est déplacé vers le slot valide le plus proche.
Le resolver essaye d’abord les slots suivants, puis les slots précédents si aucun slot suivant n’existe.
```

Une card qui a déjà un conflict reste draggable tant qu’elle n’est ni `played` ni `locked`. Le drag exprime une nouvelle intention ; le resolver réorganise ensuite le tableau si le conflict s’active sur la nouvelle ligne.

Si B est `played` ou `locked`, le déplacement de A est refusé ou clampé avec warning déterministe.

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

Une card qui a déjà un link reste draggable tant qu’elle n’est ni `played` ni `locked`. Le drag exprime une nouvelle intention ; le resolver déplace ensuite toutes les cards liées qui peuvent suivre.

Si C ne peut pas suivre à cause de `played`, `locked` ou conflict non résoluble, le déplacement est refusé ou clampé avec warning déterministe.

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
B est déplacé vers le slot valide le plus proche.
```

Si B est `played` ou `locked`, le déplacement est refusé ou clampé avec warning déterministe.

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


### 8.8 Exemple conflict bidirectionnel minimal

Setup :

```txt
Chant   : A, B
Guitare : C, D
```

Si l’organisateur crée un conflict `A → C`, A est l’anchor de cette action et C doit se déplacer car A et C sont sur le même plateau. Résultat attendu :

```txt
Chant   : A, B
Guitare : D, C
```

Si l’organisateur crée le même conflict dans l’autre sens `C → A`, C est l’anchor de cette action et A doit se déplacer. Résultat attendu :

```txt
Chant   : B, A
Guitare : C, D
```

Dans les deux cas, le conflict est bidirectionnel et actif immédiatement. Le sens de création ne décide pas si le conflict existe ; il sert seulement à savoir quelle card préserver en priorité pour cette transaction.

Cas sans slot suivant :

```txt
Chant   : A, B
Guitare : C, D
Conflict B → D
```

D ne peut pas descendre car il est déjà en bas de sa colonne. Le resolver doit donc chercher le slot valide le plus proche au-dessus et produire :

```txt
Chant   : A, B
Guitare : D, C
```

### 8.9 Conflict toute la soirée et reveal round

Setup :

```txt
Chant : A, B
Guitare : C, D
```

L’organisateur crée un conflict `A-C` avec `scope: participation` / “toute la soirée”. Le premier round est résolu :

```txt
Chant : A, B
Guitare : D, C
```

Quand le round 2 est révélé, les appearances `A'`, `B'`, `C'`, `D'` sont matérialisées. Le conflict de participation doit alors s’appliquer automatiquement aux nouvelles appearances :

```txt
Chant : A, B, A', B'
Guitare : D, C, D', C'
```

Il est interdit d’obtenir :

```txt
Chant : A, B, A', B'
Guitare : D, C, C', D'
```

car `A'` et `C'` seraient sur le même plateau.

Avec `scope: appearance`, seul le passage ciblé est concerné. Dans le même setup, un conflict `A-C` scope appearance peut déplacer `C` sous `D`, mais il ne doit pas imposer automatiquement `C'` sous `D'`.



### 8.7 Plateau joué avec colonnes vides

Quand un plateau est marqué joué, toute la ligne devient historique. Si un instrument visible n’avait aucune card sur cette ligne au moment du jeu, le frontend doit créer un hole `reason: played_empty_slot` avant de créer `plateau_played`. Ce hole est inclus dans les targets jouées.

Conséquence : une participation ajoutée plus tard dans cet instrument ne peut pas se placer sur une ligne déjà jouée ; elle doit être insérée après le trou joué, selon la hiérarchie `played > locked > anchor > ...`.

### 8.8 Anchor de déplacement manuel avec conflict

Lorsqu’un manual reorder crée ou active un conflict, la card déplacée est l’anchor prioritaire. Si A et C sont en conflict et que l’organisateur déplace A sur la ligne de C, le resolver doit essayer de déplacer C. Il ne doit déplacer A qu’en dernier recours si C est impossible à déplacer, et jamais si A est played ou locked.

### 8.9 Conflicts instrument_constraint

Les conflicts `reason: instrument_constraint` créés entre deux participations d’un même participant utilisent exactement le même resolver que les conflicts manuels. Ils ne sont pas un cas spécial : inter-colonnes uniquement, bidirectionnels, scope participation, appliqués aux rounds visibles et futurs.
