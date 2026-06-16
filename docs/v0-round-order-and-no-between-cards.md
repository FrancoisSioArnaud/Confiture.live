# V0 — Ordre des rounds et suppression de l’ajout entre cards

Ce document consolide les décisions V0 sur les deuxièmes passages, l’ordre des appearances et la suppression de l’ajout entre cards.

---

## 1. Ajout entre cards

L’ajout entre deux cards est supprimé de la V0 et déplacé en V1.

À ne pas implémenter en V0 :

- zone `Entre les cards` ;
- bouton `+` entre deux cards ;
- menu `Ajouter un trou` / `Ajouter un participant` depuis un gap ;
- ajout participant ciblant directement le round 2+ depuis une zone entre cards ;
- ajout manuel de hole entre deux cards ;
- `participation_added.insertionMode = between_targets`.

La base de données n’est pas en production. Il n’est pas nécessaire de conserver de code legacy pour relire d’anciens events `between_targets`.

Les events de drag vertical (`appearance_moved_between`, `hole_moved_between`) restent V0 : ils servent au déplacement manuel dans une colonne, pas à l’ajout entre cards.

---

## 2. Rounds par instrument

Chaque instrument est indépendant.

Quand on révèle le round 2 d’un instrument, les appearances du round 2 se collent immédiatement à la suite des appearances du round 1 de cette même colonne.

Exemple initial :

| Ordre | Chant | Guitare | Batterie |
|---:|---|---|---|
| 1 | Anna | Noé | Sam |
| 2 | Léo | Iris | Nina |
| 3 | Maya | Tom | Eli |
| 4 | Zoé | — | Lou |
| 5 | — | — | Max |

Après reveal round 2 dans les trois colonnes :

| Ordre | Chant | Guitare | Batterie |
|---:|---|---|---|
| 1 | Anna | Noé | Sam |
| 2 | Léo | Iris | Nina |
| 3 | Maya | Tom | Eli |
| 4 | Zoé | Noé' | Lou |
| 5 | Anna' | Iris' | Max |
| 6 | Léo' | Tom' | Sam' |
| 7 | Maya' | — | Nina' |
| 8 | Zoé' | — | Eli' |
| 9 | — | — | Lou' |
| 10 | — | — | Max' |

`Noé'` vient juste après `Tom`. La colonne Guitare ne laisse pas une ligne vide pour attendre `Zoé` ou `Max` dans les autres colonnes.

---

## 3. Tri attendu

Tri d’une colonne :

```txt
appearanceIndex ASC
puis positionInRound ASC
puis id ASC en fallback stable
```

À faire :

```txt
Anna, Léo, Maya, Zoé, Anna', Léo', Maya', Zoé'
```

À ne pas faire :

```txt
Anna, Anna', Léo, Léo', Maya, Maya', Zoé, Zoé'
```

---

## 4. Ajout d’un participant quand round 2 est visible

Exemple Guitare :

```txt
Avant : Noé, Iris, Tom, Noé', Iris', Tom'
Ajout de Paul
Après : Noé, Iris, Tom, Paul, Noé', Iris', Tom', Paul'
```

La nouvelle participation reçoit une appearance à la fin de chaque round déjà visible.

---

## 5. Appearances jouées et hiérarchie d’ordre

Une appearance jouée ne doit pas être déplacée visuellement par un ajout ultérieur.

Si une insertion logique en fin de round 1 entrerait en conflit avec une card déjà jouée du round 2, `played` gagne contre l’ordre round-first.

Exemple :

```txt
Avant : A, B, C, A', B', C'
A, B, C et A' sont joués.
Ajout de D.
Après : A, B, C, A', D, B', C', D'
```

À ne pas faire :

```txt
A, B, C, D, A', B', C', D'
```

La hiérarchie complète est définie dans `order-resolution-hierarchy-spec.md` :

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

Le code doit éviter de réordonner brutalement les cards jouées et doit réconcilier les contraintes globalement à chaque action qui modifie l’ordre.
