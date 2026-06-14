# Drawer d’appel Spec — Confiture.live

## 1. Objectif

Le drawer d’appel sert à gérer un plateau précis au moment de l’appeler.

Il doit permettre à l’organisateur de :

- voir clairement qui appeler par instrument ;
- marquer le plateau joué ;
- gérer un musicien introuvable ;
- choisir un remplaçant ;
- faire sans musicien sur un instrument ;
- garder le tableau cohérent et déterministe.

---

## 2. Accès UI

Depuis la colonne d’actions de plateau :

```txt
Bouton appeler / ouvrir drawer d’appel sur une ligne plateau
```

Le drawer cible un `plateauIndex` précis déduit de la projection.

---

## 3. Format responsive

Mobile :

```txt
Drawer plein écran.
```

Tablette :

```txt
Drawer latéral large ou modal large.
```

Le bouton principal `Plateau joué` doit être sticky en bas.

---

## 4. Contenu du drawer

Afficher les instruments dans l’ordre de la jam, hors instruments masqués.

Pour chaque instrument :

```txt
Instrument
Nom du musicien
Badges éventuels : lié, rejoue, verrouillé
Actions : Introuvable / Remplacer / Faire sans musicien selon contexte
```

Pour un hole :

```txt
Instrument
Sans musicien
Badge éventuel : lié, verrouillé
```

Exemple :

```txt
Chant
Sarah

Guitare
Nicolas

Basse
Tom

Batterie
Sans musicien
```

---

## 5. Action principale : plateau joué

Bouton :

```txt
Plateau joué
```

Effet :

```txt
plateau_played
```

Tous les targets du plateau deviennent played :

- appearances ;
- holes.

Feedback :

- drawer se ferme ;
- cards grisées dans le tableau ;
- pas besoin de snackbar sauf cas spécifique.

Règles :

- played = immobile ;
- un plateau déjà joué ne doit pas être rejoué ;
- `plateau_unplayed` est une action secondaire, hors flux principal.

---

## 6. Musician introuvable

### 6.1 Déclencheur

Dans le drawer, sur une ligne musicien :

```txt
Musicien introuvable
```

Cette action ne crée pas un état durable `temporarily_away`.

Elle déclenche une logique ponctuelle :

```txt
appearance_skipped
```

---

### 6.2 Effet général

Quand une appearance est skipped :

- elle est repoussée au prochain slot valide dans sa colonne ;
- si elle est linkée, le link est supprimé après confirmation ;
- seul ce passage est repoussé ;
- le groupe linké ne suit pas ;
- le participant ne devient pas `left` ;
- aucune présence temporaire durable n’est stockée.

---

## 7. Remplaçants proposés

Après clic “Musicien introuvable”, afficher un panneau de choix.

Le système propose jusqu’à trois remplaçants possibles dans la même colonne/instrument.

Critères :

- appearances futures ;
- non played ;
- non locked sauf si explicitement impossible ;
- participant pas `left` ;
- pas en conflict avec les autres targets du plateau ;
- si possible, priorité aux musiciens n’ayant pas encore joué ce round/appearanceIndex ;
- respecter les links/conflicts autant que possible.

Afficher aussi toujours :

```txt
Faire sans musicien
```

---

## 8. UI d’un remplaçant proposé

Chaque option remplaçant affiche :

```txt
Nom
Instrument
Indications :
- déjà lié
- rejoue en round X
- déplacera ce passage
```

Exemple :

```txt
Léa
Batterie · prochain passage
```

Si le remplaçant est linké :

```txt
Lié à Nicolas guitare
```

---

## 9. Sélection d’un remplaçant

Quand l’organisateur choisit un remplaçant :

1. le remplaçant prend le slot du musicien introuvable ;
2. le musicien introuvable est repoussé au prochain slot valide ;
3. les cards déplacées sont animées ;
4. une snackbar confirme le report/remplacement.

Event principal :

```txt
appearance_skipped
```

Events complémentaires possibles :

```txt
link_removed
appearance_moved_between
appearance_materialized
```

---

## 10. Cas : musicien introuvable linké

Si l’appearance introuvable est linkée :

Afficher un dialog :

```txt
Délier ce passage ?
Ce musicien est lié à un autre passage. Pour le repousser ou le remplacer, le link sera supprimé.
```

Actions :

```txt
Annuler
Délier et continuer
```

Si confirmé :

- supprimer le link ;
- repousser seulement l’appearance introuvable ;
- ne pas déplacer le groupe linké.

---

## 11. Cas : remplaçant linké

Si le remplaçant proposé est linké :

Afficher un dialog :

```txt
Délier le remplaçant ?
Ce musicien est lié à un autre passage. Pour le mettre ici, le link sera supprimé.
```

Actions :

```txt
Annuler
Délier et remplacer
```

Si confirmé :

- supprimer le link du remplaçant ;
- déplacer le remplaçant dans le slot ;
- repousser l’appearance introuvable.

---

## 12. Faire sans musicien

Option toujours disponible dans la liste de remplacement :

```txt
Faire sans musicien
```

Effet :

- créer un hole à la place de l’appearance introuvable ;
- repousser l’appearance introuvable au prochain slot valide ;
- si l’appearance introuvable était linkée, confirmer puis supprimer le link ;
- le hole pourra être marqué played avec le plateau.

Events :

```txt
hole_added reason: call_drawer_without_musician
appearance_skipped
éventuel link_removed
```

Feedback :

```txt
Snackbar : Le plateau jouera sans musicien sur cet instrument.
```

Animation :

- card musicien sort du slot ;
- hole apparaît dans le slot ;
- card musicien réapparaît plus bas.

---

## 13. Remplacement impossible

Si aucun remplaçant valide n’existe, afficher seulement :

```txt
Faire sans musicien
```

Si même cette action est impossible pour une raison de lock/played inattendue, afficher snackbar :

```txt
Impossible de modifier ce passage.
```

---

## 14. Drawer après remplacement

Après choix d’un remplaçant ou “faire sans musicien” :

- le drawer doit rester ouvert ;
- le contenu du plateau doit être mis à jour ;
- l’organisateur peut ensuite marquer le plateau joué.

Ne pas fermer automatiquement le drawer après `appearance_skipped`.

Le drawer se ferme automatiquement seulement après `plateau_played`.

---

## 15. Interaction avec locks

Si l’appearance introuvable est locked :

- l’action “Musicien introuvable” devrait être désactivée ;
- ou demander unlock avant.

Reco V0 : désactiver avec tooltip/message :

```txt
Ce passage est verrouillé.
```

Si un remplaçant potentiel est locked :

- ne pas le proposer comme remplaçant.

---

## 16. Interaction avec played

Une appearance played ne doit pas apparaître comme remplaçant.

Un plateau played ne doit pas ouvrir le drawer d’appel en mode édition normale.

Si drawer ouvert puis plateau joué ailleurs via undo/replay, désactiver les actions.

---

## 17. Interaction avec conflicts

Ne pas proposer un remplaçant qui créerait un conflict avec les autres targets du plateau.

Si la liste est vide à cause des conflicts, l’option “Faire sans musicien” reste disponible.

---

## 18. Interaction avec instrument masqué

Le drawer d’appel n’affiche pas les instruments masqués.

Si un plateau historique contient une target sur instrument masqué, ce cas ne doit pas apparaître dans le flux d’appel V0.

---

## 19. Events produits par le drawer

Le drawer d’appel peut produire :

```txt
plateau_played
plateau_unplayed si action secondaire
appearance_skipped
hole_added
link_removed
appearance_moved_between
appearance_materialized
```

Ne pas produire :

```txt
participant_marked_left
participant_removed
participation_removed
participant_updated
appearance_note_updated
```

---

## 20. Feedback

### Musician skipped avec remplaçant

Snackbar :

```txt
Passage repoussé et remplaçant sélectionné
```

### Musician skipped sans remplaçant

Snackbar :

```txt
Le plateau jouera sans musicien sur cet instrument
```

### Delink nécessaire

Dialog avant action.

### Plateau joué

Feedback visuel suffit.

---

## 21. Non objectifs V0

Ne pas implémenter :

- appel micro/son ;
- notifications aux musiciens ;
- timer de scène ;
- statut “appelé” durable ;
- statut “temporairement absent” durable ;
- remplacement multi-instrument automatique complet ;
- drawer de gestion avancée des links ;
- notes.
