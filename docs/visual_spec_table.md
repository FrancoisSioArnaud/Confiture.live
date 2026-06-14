# Confiture.live — Visual Spec Table

## Objectif du fichier

Ce document définit l’affichage et les interactions du tableau organisateur de Confiture.live.

Il complète :

- `confiture_event_actions_spec.md`
- `sync_strategy.md`
- `data_model.md`
- `visual_spec_table_cards.md`

Le tableau est l’écran principal de gestion d’une jam. Il affiche les instruments en colonnes et les passages en cards. Les plateaux sont déduits par alignement horizontal des cards de chaque colonne.

---

# 1. Principe général du tableau

## 1.1 Colonnes d’instruments

Le tableau affiche une colonne par instrument visible.

Exemple :

```txt
┌─────────┬──────────┬───────┬──────────┐
│ Chant   │ Guitare  │ Basse │ Batterie │
├─────────┼──────────┼───────┼──────────┤
│ Léa     │ Nicolas  │ Tom   │ Sarah    │
│ Emma    │ Jules    │ Max   │ Rayan    │
│ ...     │ ...      │ ...   │ ...      │
└─────────┴──────────┴───────┴──────────┘
```

Chaque colonne contient :

```txt
- header instrument
- cards appearance/hole
- séparateurs ou zones d’ajout entre cards
- bouton afficher round suivant
```

## 1.2 Plateaux déduits

Un plateau est déduit par la position horizontale des cards.

Exemple :

```txt
Plateau 1 = première card visible de chaque colonne
Plateau 2 = deuxième card visible de chaque colonne
Plateau 3 = troisième card visible de chaque colonne
```

Le tableau ne stocke pas directement une ligne plateau comme vérité métier. Les plateaux sont une projection visuelle à partir des colonnes.

## 1.3 Mobile/tablette

Le tableau doit être utilisable sur mobile/tablette.

Règles :

```txt
- scroll horizontal fluide entre colonnes
- largeur colonne stable
- cards assez compactes
- actions tactiles accessibles
- transitions visibles mais non gênantes
```

---

# 2. Header global de la page jam

Le header global doit contenir les actions et états globaux.

Éléments recommandés :

```txt
- nom de la jam
- bouton retour/liste jams
- indicateur sync discret
- bouton undo
- bouton configuration jam
```

## 2.1 Indicateur sync

L’indicateur doit rester discret et positif.

États recommandés :

```txt
Synchronisé
Sauvegarde locale active
Synchronisation en cours
À sauvegarder
Erreur réseau, sauvegarde locale active
```

Ne pas afficher une snackbar à chaque sync réussie.

En cas offline/désync :

```txt
Le message doit rester rassurant.
L’organisateur doit comprendre que l’app continue de fonctionner.
```

## 2.2 Undo

Le bouton undo est global.

Règles :

```txt
- undo linéaire uniquement
- pour undo l’action 4, les actions 5, 6, 7 doivent déjà avoir été undo
- undo crée une nouvelle transaction/event
- l’historique n’est jamais supprimé
```

Feedback :

```txt
- snackbar
- animation des changements dans le tableau si visibles
```

## 2.3 Configuration jam

Le bouton configuration ouvre la modale de configuration de jam.

La modale contient notamment :

```txt
- nom/date de la jam
- instruments visibles/masqués
- ajout/renommage instrument
- link reorder strategy
```

Il ne faut pas créer de bouton dédié à la stratégie de réorganisation dans le tableau.

---

# 3. Header de colonne

Chaque colonne affiche :

```txt
- nom instrument
- compteur éventuel
```

## 3.1 Nom instrument

Le nom est affiché simplement :

```txt
Chant
Guitare
Basse
Batterie
```

## 3.2 Compteur

Le compteur recommandé indique :

```txt
nombre de musiciens qui n’ont pas encore joué une première fois sur cet instrument
```

Affichage possible :

```txt
Guitare · 5 à faire passer
```

ou badge discret :

```txt
Guitare [5]
```

## 3.3 Pas d’actions lourdes dans le header de colonne

Ne pas mettre dans le header :

```txt
- supprimer instrument
- renommer instrument
- config colonne
```

Ces actions vont dans la modale de configuration jam.

---

# 4. Colonne instrument

## 4.1 Contenu

Une colonne contient une liste verticale :

```txt
- appearance cards
- hole cards
- zones d’ajout entre cards
- séparation éventuelle entre rounds
- bouton afficher round suivant
```

## 4.2 Largeur

La largeur doit être stable.

Reco :

```txt
mobile/tablette : colonne assez étroite pour voir au moins une colonne entière et deviner la suivante
desktop : plusieurs colonnes visibles
```

La card doit rester plus étroite que large, mais suffisamment lisible.

## 4.3 Scroll

Le tableau peut avoir :

```txt
- scroll horizontal global
- scroll vertical page/global
```

Éviter les scrolls verticaux imbriqués dans chaque colonne si cela rend le mobile difficile.

---

# 5. Rounds visibles

## 5.1 Affichage round 1 par défaut

Par défaut, chaque colonne affiche uniquement le round 1.

## 5.2 Afficher round suivant

En bas de colonne :

```txt
bouton “Afficher round suivant”
```

Quand cliqué :

```txt
- reveal du round suivant pour cette colonne
- création/projection des appearances du round visible
- animation d’apparition
```

Feedback :

```txt
silent
```

L’apparition visuelle suffit.

## 5.3 Ajout après reveal de round

Règle importante :

```txt
Si on ajoute une participation après reveal du round 2 depuis le flux standard,
la projection ajoute une appearance à la fin du round 1 ET à la fin du round 2 visible.
```

Pour tous les rounds déjà visibles :

```txt
la nouvelle participation reçoit une appearance positionnée à la fin du round visible concerné.
```

Pour les rounds non visibles :

```txt
les appearances restent calculées plus tard.
```

## 5.4 Ajout entre deux cards dans un round spécifique

Si l’organisateur clique entre deux cards du round 2 :

```txt
la nouvelle participation démarre à partir du round 2.
```

Conséquence :

```txt
- pas d’appearance rétroactive en round 1
- appearance créée à l’endroit ciblé en round 2
- appearances futures calculées à partir de cette base
```

Même logique pour round 3+.

---

# 6. Zones entre cards

Entre deux cards, une zone d’action peut apparaître au tap/clic.

Options :

```txt
- Ajouter un participant ici
- Ajouter un trou ici
```

## 6.1 Ajouter un participant ici

Ouvre le drawer participant avec l’instrument et le round ciblés préremplis.

Règles :

```txt
- dans round 1 : crée une participation à partir du round 1
- dans round 2 : crée une participation à partir du round 2
- dans round N : crée une participation à partir du round N
```

Feedback :

```txt
- apparition animée de la card
- snackbar seulement si ajout à participant existant / ajout d’instrument
```

## 6.2 Ajouter un trou ici

Crée un hole à la position ciblée.

Feedback :

```txt
silent + apparition animée
```

Confirmation non nécessaire à la création.

---

# 7. Drag and drop

## 7.1 Règle générale

Le drag est vertical uniquement dans une colonne.

Interdit :

```txt
- drag horizontal entre instruments
- drag d’une card played
- drag d’une card locked
- drag qui viole un conflict
- drag qui casse un link non résolvable
```

## 7.2 Drag d’une card linkée

Si une card linkée est déplacée :

```txt
le groupe linké doit rester aligné si possible.
```

Si impossible :

```txt
action refusée + snackbar explicative
```

## 7.3 Animation

Tous les déplacements visibles doivent être animés.

Règle :

```txt
Aucune card ne doit se téléporter après une réorganisation.
```

Durée recommandée :

```txt
800 à 1000 ms pour réorganisation importante
200 à 300 ms pour ajustement simple
```

---

# 8. Mode link du tableau

## 8.1 Déclenchement

Le mode link est déclenché par :

```txt
bouton link sur une card appearance ou hole
```

Il ne doit pas y avoir de drawer link.

Il ne doit pas y avoir de link dans le menu trois-points.

## 8.2 Anchor

La card depuis laquelle le bouton link est cliqué devient l’anchor.

Règle :

```txt
Recliquer sur le bouton link de l’anchor quitte le mode link.
```

## 8.3 État visuel du tableau

En mode link :

```txt
- le tableau change légèrement d’apparence
- l’anchor est très visible
- les cards sélectionnables sont mises en évidence
- les cards non sélectionnables sont atténuées
- les cards déjà linkées à l’anchor apparaissent sélectionnées
```

## 8.4 Sélection

L’organisateur peut sélectionner des cards dans d’autres colonnes.

Règles :

```txt
- pas deux targets dans la même colonne
- pas de target played incompatible
- pas de target locked si cela force son déplacement
- pas de target en conflict contradictoire
```

Un hole peut être sélectionné.

## 8.5 Barre d’action du mode link

Une barre d’action persistante apparaît.

Actions :

```txt
- Valider
- Annuler
```

Elle peut afficher :

```txt
2 passages sélectionnés
3 passages sélectionnés
```

## 8.6 Validation

À la validation :

```txt
- création/suppression des links nécessaires
- réorganisation selon linkReorderStrategy
- animation des déplacements
- snackbar si des passages ont bougé
```

Snackbar recommandée si déplacement :

```txt
Certains passages ont été déplacés pour respecter le lien.
```

Si refus par conflict :

```txt
Snackbar explicative.
```

Exemple :

```txt
Impossible de créer ce lien : ces passages sont en conflit.
```

## 8.7 Stratégie de réorganisation

La stratégie est définie dans la configuration de jam.

Valeurs :

```txt
move_to_first
move_to_last
average_position
```

Défaut :

```txt
move_to_first
```

### `move_to_first`

```txt
Le groupe linké est aligné vers la position la plus haute / première parmi les targets.
```

### `move_to_last`

```txt
Le groupe linké est aligné vers la position la plus basse / dernière parmi les targets.
```

### `average_position`

```txt
Le groupe linké est aligné autour de la moyenne des positions des targets.
```

En cas d’égalité ou d’arrondi :

```txt
utiliser la position la plus haute compatible par défaut
```

---

# 9. Mode conflict du tableau

## 9.1 Déclenchement

Le mode conflict est déclenché depuis :

```txt
menu trois-points d’une appearance card
→ Créer / retirer un conflit
```

Pas de drawer conflict.

## 9.2 État visuel

Le mode conflict doit être visuellement distinct du mode link.

Recommandation :

```txt
- couleur d’accent différente
- wording clair
- icône conflict/interdit
- cards non sélectionnables atténuées
```

## 9.3 Sélection

L’organisateur sélectionne/désélectionne des cards.

Règles :

```txt
- conflict sur appearance pour “ce passage seulement”
- conflict sur participation pour “en général”
- hole non concerné par conflict en V0
```

## 9.4 Validation

À la validation, afficher un dialog obligatoire :

```txt
Ce conflit concerne :
- seulement ce passage
- en général
```

Puis :

```txt
- créer/supprimer les conflicts nécessaires
- réorganiser si nécessaire
- afficher snackbar
- animer les déplacements
```

## 9.5 Suppression conflict

Pour enlever un conflict :

```txt
- entrer en mode conflict depuis une card en conflict
- les cards actuellement en conflict sont visibles
- recliquer sur une card en conflict la désélectionne
- valider supprime le conflict correspondant
```

Pas de `conflict_updated`.

Modifier = supprimer puis recréer.

---

# 10. Actions de plateau

Les plateaux sont déduits, mais l’UI doit permettre d’agir sur une ligne de plateau.

## 10.1 Colonne ou zone d’action plateau

À gauche du tableau ou en overlay par ligne, afficher :

```txt
- bouton ouvrir drawer d’appel
- bouton plateau joué
```

La zone doit suivre visuellement les lignes du tableau.

## 10.2 Ouvrir drawer d’appel

Ouvre le drawer d’appel du plateau.

Le drawer affiche :

```txt
- chaque instrument du plateau
- le musicien ou hole correspondant
- état disponible/prêt
- action “musicien introuvable” pour chaque appearance musicien
```

## 10.3 Plateau joué

Marque toutes les appearances/holes du plateau comme played.

UI :

```txt
- cards grisées
- déplacement désactivé
- plateau visuellement historique
```

Feedback :

```txt
silent ou snackbar légère optionnelle
```

La transformation visuelle suffit généralement.

## 10.4 Annuler plateau joué

Autorisé uniquement sur le dernier plateau joué recommandé.

UI :

```txt
action secondaire dans drawer d’appel ou menu plateau
```

Feedback :

```txt
dialog si nécessaire
snackbar après action
```

---

# 11. Drawer d’appel

## 11.1 Objectif

Le drawer d’appel aide l’organisateur à appeler les musiciens du plateau courant.

Il doit permettre de gérer le cas réaliste :

```txt
un musicien appelé est introuvable ou indisponible ponctuellement
```

## 11.2 Action musicien introuvable

Pour une appearance donnée :

```txt
bouton “Musicien introuvable”
```

L’UI ouvre un choix de remplacement.

## 11.3 Suggestions de remplacement

Afficher 3 suggestions.

Chaque suggestion doit être un musicien possible pour le même instrument.

Critères de suggestion :

```txt
- même instrument
- disponible
- pas déjà played dans ce plateau
- non locked incompatible
- respecte conflicts
- minimise l’injustice dans l’ordre
- priorité aux musiciens proches dans la liste
```

Affichage :

```txt
- nom
- éventuellement position actuelle / round
- indication si déplacement nécessaire
```

## 11.4 Faire sans musicien

Toujours proposer :

```txt
Faire sans musicien
```

Effet :

```txt
- remplace l’appearance appelée par un hole dans le plateau courant
- repousse l’appearance introuvable d’un plateau
- delink l’appearance introuvable si elle était linkée
```

## 11.5 Sélection d’un remplaçant

Effet :

```txt
- remplaçant prend la place dans le plateau courant
- appearance introuvable est repoussée d’un plateau via appearance_skipped
- si l’appearance introuvable était linkée, elle est delinkée avant report
- animation dans le tableau
```

Feedback :

```txt
snackbar
```

Message possible :

```txt
Le musicien a été remplacé et repoussé au plateau suivant.
```

---

# 12. Configuration jam

La modale configuration jam contient :

```txt
- modifier nom/date
- ajouter instrument
- renommer instrument
- masquer instrument
- réordonner instruments
- choisir stratégie de réorganisation des links
```

## 12.1 Masquer instrument

Masquer un instrument :

```txt
- rend la colonne invisible
- retire l’instrument du drawer d’appel
- ne supprime pas l’historique
- ne supprime pas les events
```

Si links actifs :

```txt
dialog avec warning spécifique
confirmation autorisée
```

## 12.2 Link reorder strategy

Valeurs :

```txt
move_to_first
move_to_last
average_position
```

L’action de modification doit être enregistrée dans l’eventLog.

Feedback :

```txt
snackbar
```

---

# 13. Floating action button

## 13.1 Ajouter participant

Bouton flottant en bas à droite.

UI :

```txt
PersonAddIcon uniquement
```

Action :

```txt
ouvre drawer ajout participant
```

Feedback :

```txt
- nouveau participant : silent, apparition des cards suffit
- ajout d’instrument à participant existant : snackbar
```

---

# 14. Feedback organisateur dans le tableau

## 14.1 Silent

Utiliser silent quand le changement est immédiatement visible.

Exemples :

```txt
- création participant
- ajout hole
- reveal round
- lock/unlock
- plateau joué
```

## 14.2 Snackbar

Utiliser snackbar quand une conséquence indirecte doit être comprise.

Exemples :

```txt
- link crée un déplacement
- conflict crée un déplacement
- ajout instrument à participant existant
- remplacement musicien introuvable
- action refusée
- sync warning positif
```

## 14.3 Dialog

Utiliser dialog quand l’action est destructive, ambiguë ou nécessite un choix.

Exemples :

```txt
- supprimer appearance
- supprimer hole
- participant parti
- supprimer participant
- masquer instrument avec contenu/links
- choisir scope conflict
```

## 14.4 Animation

Toute modification spatiale doit être animée.

Exemples :

```txt
- card déplacée par link
- card déplacée par conflict
- appearance_skipped
- remplacement dans drawer d’appel
- suppression card
- apparition card
- reveal round
```

---

# 15. États globaux du tableau

## 15.1 Mode normal

Actions disponibles :

```txt
- drag
- link button
- menu card
- lock/unlock
- ouvrir drawer d’appel
- plateau joué
- ajout participant/hole
```

## 15.2 Mode link

Actions disponibles :

```txt
- sélectionner/désélectionner cards
- valider
- annuler
- recliquer link anchor pour quitter
```

Actions désactivées :

```txt
- drag
- menu trois-points
- plateau joué
- ajout participant/hole
```

## 15.3 Mode conflict

Actions disponibles :

```txt
- sélectionner/désélectionner cards
- valider
- annuler
```

Actions désactivées :

```txt
- drag
- menu trois-points autre que sortie mode
- plateau joué
- ajout participant/hole
```

## 15.4 Mode sync warning

Ne bloque pas la jam.

UI :

```txt
- indicateur discret dans header
- message positif
```

Exemple :

```txt
Sauvegarde locale active. Les changements seront envoyés dès que possible.
```

---

# 16. Résumé opérationnel pour Codex

## Table

```txt
- colonnes instrument visibles
- cards appearance/hole
- plateaux déduits par lignes
- actions plateau alignées avec lignes
- scroll horizontal mobile
- animations de déplacement obligatoires
```

## Modes

```txt
- normal
- link
- conflict
```

## Link

```txt
- déclenché uniquement par bouton link card
- pas de drawer
- pas de menu link
- anchor claire
- recliquer link anchor quitte
- validation par barre d’action
- stratégie de réorganisation depuis config jam
```

## Conflict

```txt
- déclenché depuis menu card
- mode tableau dédié
- pas de drawer
- validation avec dialog scope
```

## Drawer participant

```txt
- modifier nom
- ajouter/retrait instruments
```

## Drawer d’appel

```txt
- appeler plateau
- musicien introuvable
- 3 remplaçants
- faire sans musicien
- appearance_skipped ponctuel
```

## Feedback

```txt
- silent si changement visible
- snackbar si conséquence indirecte
- dialog si destruction/choix
- animation pour tout déplacement
