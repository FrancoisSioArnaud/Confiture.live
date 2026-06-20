# Drawer Participant Spec — Confiture.live

## 1. Objectif

Le drawer participant sert à créer ou modifier un musicien.

Il doit gérer :

- nom ;
- instruments joués ;
- ajout d’un instrument à un participant existant ;
- retrait d’un instrument ;
- création des participations et appearances correspondantes ;
- conflicts automatiques entre participations incompatibles ;
- links initiaux éventuels entre appearances.

Il ne sert pas à gérer les notes. Il n’y a aucune note dans l’app V0.

---

## 2. Accès UI

### 2.1 Création participant

Depuis :

- bouton flottant bas droite `PersonAddIcon` ;
- ajout entre deux cards : hors V0, déplacé en V1.

### 2.2 Édition participant

Depuis :

- menu trois-points d’une card appearance → “Modifier le musicien”.

Ne pas mettre dans le menu card :

- ajouter instrument ;
- retirer instrument.

Ces actions se font dans le drawer participant.

---

## 3. Format responsive

Mobile :

```txt
Drawer plein écran ou bottom drawer haut selon contrainte UI.
```

Tablette :

```txt
Drawer latéral large.
```

Le bouton principal doit être sticky en bas.

---

## 4. Champs

### 4.1 Nom

Champ :

```txt
Nom du musicien
```

Validation :

- requis ;
- trim automatique ;
- pas de doublon exact dans la même jam ;
- comparaison insensible aux espaces de début/fin ;
- accents conservés.

Erreur :

```txt
Un musicien porte déjà ce nom dans cette jam.
```

---

### 4.2 Instruments

Liste de checkboxes dans l’ordre des instruments actifs de la jam.

Les instruments masqués ne doivent pas être proposés.

Chaque instrument sélectionné crée ou conserve une `Participation`.

Validation :

```txt
Au moins un instrument doit être sélectionné.
```

---

### 4.3 Instrument “Autre”

Si l’instrument `Autre` est sélectionné :

- afficher un champ libre `Préciser l’instrument` ;
- stocker la valeur dans `customInstrumentLabel` de la participation ;
- ne pas créer automatiquement une nouvelle colonne.

---

## 5. Création d’un participant

### 5.1 Transaction minimale

Pour un nouveau participant avec un instrument :

```txt
participant_created
participation_added
```

Feedback :

```txt
Silent + apparition animée des cards
```

---

### 5.2 Nouveau participant multi-instruments

Pour plusieurs instruments :

```txt
participant_created
participation_added instrument A
participation_added instrument B
conflict_created instrument_constraint entre participations incompatibles
éventuels link_created si l’organisateur choisit de les jouer ensemble
```

Règle de base :

```txt
Les participations d’un même participant sont en conflict par défaut, sauf celles explicitement linkées pour une même appearance.
```

---

## 6. Édition d’un participant

Le drawer doit afficher :

- nom actuel ;
- instruments actuels cochés ;
- instruments disponibles non cochés ;
- statut éventuel `parti` si applicable.

### 6.1 Modifier le nom

Events :

```txt
participant_updated
```

Feedback : silent.

---

### 6.2 Ajouter un instrument

Quand un instrument est ajouté à un participant existant :

Events :

```txt
participation_added
conflict_created instrument_constraint avec les autres participations incompatibles
éventuels link_created si demandé
```

Feedback :

```txt
Snackbar + apparition animée des cards
```

Message :

```txt
Instrument ajouté au musicien
```

---

### 6.3 Retirer un instrument

Quand un instrument est décoché :

Event :

```txt
participation_removed
```

Avant validation, si la participation a :

- appearances futures ;
- links ;
- locks ;
- appearances played ;

afficher un dialog.

Wording :

```txt
Retirer cet instrument ?
Les passages futurs sur cet instrument seront retirés. Les passages déjà joués resteront dans l’historique.
```

Feedback après validation : snackbar.

---

## 7. Rounds et insertion

### 7.1 Ajout depuis bouton flottant ou drawer standard

En V0, le drawer participant ne gère pas l’ajout entre deux cards.

```txt
insertionMode = end_of_visible_rounds
startAppearanceIndex = 1
```

Conséquence :

- créer une appearance en fin de round 1 ;
- si round 2 est déjà visible, créer une appearance en fin de round 2 ;
- idem pour les autres rounds déjà visibles ;
- les rounds futurs seront générés plus tard ;
- aucun ciblage de round supérieur depuis une zone entre cards.

### 7.2 Ajout depuis zone entre deux cards

Hors V0, déplacé en V1.

La V0 ne doit pas afficher de zone “Ajouter un participant” entre deux cards et ne doit pas produire `insertionMode = between_targets`.
## 8. Links initiaux dans le drawer

Le link principal dans l’usage courant passe par le bouton link de la card et le mode link du tableau.

Dans le drawer participant, pour un participant multi-instruments, une section peut permettre de choisir si certaines participations du même participant doivent jouer ensemble lors de leur première appearance.

Cette section doit rester simple.

Exemple :

```txt
Faire passer ensemble :
[ ] Chant + Guitare
[ ] Chant + Basse
[ ] Guitare + Basse
```

À la validation :

- les pairs cochées créent des `link_created` entre appearances correspondantes ;
- les pairs non cochées gardent ou créent un `conflict_created instrument_constraint`.

Important :

- pas de drawer de link ;
- pas de gestion avancée des links ici ;
- les links entre musiciens différents se font dans le tableau.

---

## 9. Conflicts automatiques

Quand un participant a plusieurs participations :

- créer des conflicts `instrument_constraint` entre les participations incompatibles ;
- si un link explicite existe entre deux appearances, le conflict équivalent ne doit pas empêcher ce link précis ;
- les conflicts structurels doivent rester simples en V0.

Reasons autorisées :

```txt
instrument_constraint
manual
```

Dans le drawer participant, seuls les conflicts `instrument_constraint` automatiques sont générés. Les conflicts manuels passent par le mode conflict du tableau.

---

## 10. Actions non présentes dans ce drawer

Ne pas mettre dans le drawer participant :

- notes ;
- mode conflict manuel ;
- gestion avancée des links ;
- marquer plateau joué ;
- musicien introuvable ;
- sync status.

---

## 11. Boutons

Création :

```txt
Annuler
Ajouter le musicien
```

Édition :

```txt
Annuler
Enregistrer
```

Si aucun changement : bouton principal disabled.

Si validation en cours : loader dans le bouton.

---

## 12. Feedback

Cas : nouveau participant.

```txt
Pas de snackbar.
L’apparition des cards suffit.
```

Cas : ajout instrument à participant existant.

```txt
Snackbar : Instrument ajouté au musicien.
```

Cas : retrait instrument.

```txt
Dialog si impact important, puis snackbar : Instrument retiré.
```

Cas : nom modifié.

```txt
Silent.
```

---

## 13. Events produits

Le drawer participant peut produire :

```txt
participant_created
participant_updated
participation_added
participation_removed
conflict_created
conflict_removed si nécessaire
link_created pour links initiaux simples
link_removed si une modification retire un link initial existant
appearance_materialized si nécessaire
```

Ne pas produire :

```txt
participation_updated
participant_note_updated
appearance_note_updated
play_without_created
play_without_removed
```

---

## 14. Edge cases

### 14.1 Participant déjà left

Si un participant est `left`, l’édition doit être limitée ou afficher un warning.

Reco V0 : ne pas permettre d’ajouter un instrument à un participant marked left. Proposer de créer un nouveau participant si nécessaire.

---

### 14.2 Instrument masqué

Si un participant avait une participation sur un instrument ensuite masqué :

- ne pas afficher cet instrument comme actif dans les options ;
- afficher éventuellement une ligne informative dans l’édition avancée post-V0 ;
- en V0, ne pas proposer de modifier cette participation depuis le drawer standard.

---

### 14.3 Nom doublon avec participant removed

Reco V0 : un participant `removed` peut libérer le nom. Un participant `left` ne libère pas le nom.

---

## 15. Non objectifs V0

Ne pas implémenter :

- gestion QR participant ;
- édition participant par participant lui-même ;
- notes ;
- photo/avatar ;
- instruments favoris globaux ;
- historique détaillé dans le drawer ;
- merge multi-client.


### Doublon de nom à l’ajout

Dans le drawer d’ajout, si le nom saisi correspond à un participant existant, l’UI doit afficher une proposition claire :

- ajouter les instruments sélectionnés au participant existant ;
- ou changer le nom pour créer un participant distinct.

La création d’un nouveau participant avec exactement le même nom reste interdite. L’action `Ajouter l’instrument à ce participant` produit une transaction d’édition du participant existant avec `participation_added` pour les instruments manquants.
