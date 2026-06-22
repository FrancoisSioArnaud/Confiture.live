# V0 — Rounds visibles et suppression de l’ajout entre cards

Ce document conserve les décisions V0 sur la génération des rounds visibles et la suppression de l’ajout entre cards.

Il ne définit plus l’ordre final du tableau. L’ordre final est défini par le solver de contraintes dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

Règle importante : **les rounds ne sont pas une contrainte d’ordre**. Une appearance de round 2 peut passer avant une appearance de round 1 si le solver en a besoin pour résoudre links, conflicts, locks, played ou l’intention utilisateur.

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

Chaque instrument est indépendant pour la **génération** des appearances visibles.

Règles :

- round 1 est visible par défaut ;
- les rounds suivants sont révélés colonne par colonne ;
- révéler un round rend visibles/calculables les appearances correspondantes de cet instrument ;
- une participation ajoutée alors que plusieurs rounds sont visibles reçoit une appearance pour chaque round visible ;
- les rounds non visibles restent calculables plus tard ;
- un hole manuel ne génère pas de hole équivalent dans les rounds suivants.

Exemple de génération avant contraintes :

```txt
Chant : Anna r1, Léo r1, Maya r1, Anna r2, Léo r2, Maya r2
```

Cet ordre de génération est seulement un point de départ stable. Il peut être modifié par le solver.

---

## 3. Pas de tri round-first obligatoire

Ancienne règle supprimée :

```txt
appearanceIndex ASC
puis positionInRound ASC
```

À ne plus faire :

```txt
Forcer tout le round 1 avant tout le round 2.
Refuser un ordre parce qu’une round 2 passe avant une round 1.
Réparer un tableau en revenant à un tri round-first.
```

À faire :

```txt
Après chaque transaction, appeler le solver de réorder.
Laisser le solver mélanger les rounds si c’est nécessaire.
Utiliser le round comme metadata de l’appearance, pas comme priorité d’ordre.
```

---

## 4. Ajout d’un participant quand plusieurs rounds sont visibles

Exemple Guitare avec round 1 et round 2 visibles :

```txt
Avant génération : Noé r1, Iris r1, Tom r1, Noé r2, Iris r2, Tom r2
Ajout de Paul
Après génération : Noé r1, Iris r1, Tom r1, Paul r1, Noé r2, Iris r2, Tom r2, Paul r2
```

Ensuite, le solver peut produire un ordre différent si les contraintes l’exigent.

Exemple valide si un link ou conflict l’impose :

```txt
Noé r1, Paul r2, Iris r1, Tom r1, Paul r1, Noé r2, Iris r2, Tom r2
```

Le fait que `Paul r2` passe avant `Paul r1` ou avant d’autres round 1 n’est pas une erreur en soi. Seules les contraintes dures et les warnings du solver déterminent si l’ordre est valide.

---

## 5. Played, locked et resolver global

Une card jouée ou locked ne doit pas être déplacée par un ajout ultérieur ou par le reveal d’un round.

Règle déterministe :

```txt
Chaque transaction est appliquée dans l’ordre.
Après chaque transaction, le moteur de résolution d’ordre recalcule le tableau.
Le même eventLog doit toujours produire le même tableau final.
```

Contraintes qui priment :

```txt
- played immobile
- locked immobile
- une seule card par colonne/row
- links alignés si possible
- conflicts séparés si possible
- intention utilisateur respectée autant que possible
- minimisation des déplacements
```

Le round ne figure pas dans cette liste.
