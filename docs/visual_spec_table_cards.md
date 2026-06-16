# Confiture.live — Visual Spec Table Cards

## Objectif du fichier

Ce document cadre l’affichage et les interactions des cards dans le tableau organisateur de Confiture.live.

Il complète :

- `confiture_event_actions_spec.md`
- `sync_strategy.md`
- `data_model.md`

Le tableau affiche des colonnes d’instruments. Dans chaque colonne, les éléments affichés sont des cards. Une card représente soit :

- une `Appearance` : passage concret d’un participant sur un instrument pour un round donné ;
- un `Hole` : emplacement volontairement vide, équivalent visuel d’une appearance sans musicien.

La card ne doit pas devenir un cockpit. Elle doit afficher l’information essentielle, les états importants, et seulement les actions rapides nécessaires pendant une jam.

---

# 1. Principes généraux

## 1.1 Mobile-first

L’interface est pensée d’abord pour mobile/tablette.

Les cards doivent rester :

- lisibles à distance courte ;
- manipulables au doigt ;
- compactes ;
- suffisamment hautes pour afficher actions + états sans confusion ;
- compatibles avec des colonnes scrollables horizontalement.

## 1.2 Actions visibles limitées

Une card `Appearance` affiche directement seulement :

```txt
- bouton link
- bouton lock/unlock
- menu trois points
- handle drag sur desktop uniquement
```

Sur mobile, le drag se fait par long press ou interaction équivalente définie par la lib DnD. Le handle desktop ne doit pas encombrer la version mobile.

## 1.3 Pas de redondance

Les actions liées au link ne doivent pas apparaître dans le menu trois-points.

Règle stricte :

```txt
Le link passe uniquement par le bouton link visible sur la card.
```

Le menu trois-points ne doit pas contenir :

```txt
- créer un link
- modifier un link
- supprimer un link
- jouer avec...
```

## 1.4 Drawer participant

Le drawer participant sert à modifier :

```txt
- le nom du participant
- les instruments joués par le participant
```

Donc les actions suivantes ne doivent pas être dans le menu card :

```txt
- ajouter un instrument
- retirer cet instrument
```

Ces actions sont disponibles dans le drawer participant.

---

# 2. Types de cards

## 2.1 Appearance card

Une `AppearanceCard` représente :

```txt
participant + participation + appearanceIndex + instrument + position courante
```

Exemple :

```txt
Nicolas
Guitare · Round 2
```

Elle est liée à :

```txt
appearanceId
participationId
participantId
instrumentId
appearanceIndex
```

## 2.2 Hole card

Une `HoleCard` représente un emplacement vide volontaire.

Elle est liée à :

```txt
holeId
instrumentId
position
roundIndex éventuel
```

Un hole peut :

```txt
- être joué
- être locké
- être linké
- être déplacé verticalement s’il n’est ni joué ni locké
- être supprimé avec confirmation
```

Un hole ne peut pas :

```txt
- avoir de participant
- avoir de drawer participant
- être concerné par un conflict en V0
- générer automatiquement des holes dans les rounds suivants
```

---

# 3. Appearance card — Contenu visuel

## 3.1 Structure recommandée

```txt
┌──────────────────────────────┐
│ Nicolas                  ⋮   │
│ Guitare · Round 2            │
│ [badges éventuels]           │
│                              │
│ [link] [lock/unlock]         │
└──────────────────────────────┘
```

Sur desktop uniquement, un handle drag peut apparaître :

```txt
┌──────────────────────────────┐
│ ⋮⋮ Nicolas              ⋮    │
│ Guitare · Round 2            │
│ [badges éventuels]           │
│ [link] [lock/unlock]         │
└──────────────────────────────┘
```

## 3.2 Informations principales

La card doit afficher :

```txt
- nom du participant
- instrument, si nécessaire dans les contextes ambigus
- round / appearanceIndex si le round est supérieur à 1 ou si le contexte le nécessite
```

Dans une colonne nommée “Guitare”, il n’est pas obligatoire de répéter “Guitare” sur chaque card si cela surcharge l’UI.

Reco :

```txt
- Round 1 : ne pas afficher le round si cela allège l’interface.
- Round 2+ : afficher un badge ou une petite mention “R2”, “R3”.
```

## 3.3 Badges d’état

Badges possibles :

```txt
- linked
- locked
- played
- skipped récent / remplacé, si visible temporairement
- conflict warning, seulement en mode conflict ou si action refusée
```

Les badges doivent rester discrets. Les états principaux doivent aussi être visibles par la forme/couleur de la card.

---

# 4. Appearance card — États visuels

## 4.1 État normal

État d’une card future non jouée, non lockée, non linkée.

UI :

```txt
- fond standard
- bordure standard
- nom lisible
- actions visibles
```

## 4.2 État linked

Une appearance fait partie d’un link actif.

UI :

```txt
- bouton link en état actif
- icône link pleine/active ou couleur accentuée
- éventuel badge discret “lié”
```

Règle :

```txt
L’icône link doit avoir un aspect non lié et un aspect lié.
```

Exemples :

```txt
Non lié : icône link outline / couleur neutre
Lié : icône link active / couleur accent / badge
```

## 4.3 État locked

Une card locked est strictement verrouillée.

UI :

```txt
- icône cadenas fermé
- léger marqueur visuel de verrouillage
```

Règles :

```txt
- impossible à déplacer manuellement
- impossible à déplacer automatiquement
- impossible à déplacer par link/conflict/recalcul
```

Si l’organisateur tente une action incompatible :

```txt
- action refusée
- snackbar explicative
```

## 4.4 État unlocked

UI :

```txt
- icône cadenas ouvert ou discret
```

Règle :

```txt
La card peut être déplacée si elle n’est pas played.
```

## 4.5 État played

Une appearance jouée devient historique.

UI :

```txt
- card grisée
- actions de déplacement désactivées
- lock visuellement inutile ou masqué/désactivé
- link/conflict actions désactivées sauf consultation visuelle
```

Règles :

```txt
- ne peut plus bouger
- ne peut plus être supprimée comme future appearance
- ne peut plus être remplacée
```

## 4.6 État sélectionnée en mode link

Quand le tableau est en mode link :

```txt
- la card anchor est mise en évidence
- les cards sélectionnées sont clairement actives
- les cards non sélectionnables sont atténuées
```

La card anchor est celle depuis laquelle le mode link a été lancé.

Règle importante :

```txt
Recliquer sur le bouton link de la card anchor sort du mode link.
```

## 4.7 État sélectionnée en mode conflict

Quand le tableau est en mode conflict :

```txt
- la card anchor est mise en évidence
- les cards sélectionnées pour conflit sont actives
- les cards déjà en conflict avec l’anchor sont indiquées
- les cards non sélectionnables sont atténuées
```

Le mode conflict doit avoir une ambiance visuelle différente du mode link pour éviter toute confusion.

---

# 5. Appearance card — Actions directes

## 5.1 Bouton link

Position :

```txt
action directe sur la card
```

Fonction :

```txt
- si aucun mode link actif : active le mode link avec cette card comme anchor
- si mode link actif avec cette card comme anchor : quitte le mode link
- si mode link actif avec une autre anchor : sélectionne/désélectionne cette card si elle est éligible
```

Éligibilité d’une cible link :

```txt
- autre colonne que l’anchor
- appearance ou hole
- non played
- non locked
- pas de conflict direct ou induit avec les targets sélectionnées
- une seule target par instrument
```

Ne pas ouvrir de drawer.

Ne pas ouvrir de menu dédié.

Validation du link :

```txt
via barre d’action du mode link dans le tableau :
- Valider
- Annuler
```

## 5.2 Bouton lock/unlock

Position :

```txt
action directe sur la card
```

Fonction :

```txt
- si unlocked : crée appearance_locked
- si locked : crée appearance_unlocked
```

Feedback :

```txt
- silent
- changement visuel immédiat de l’icône
```

Si l’action échoue :

```txt
- snackbar explicative
```

## 5.3 Menu trois-points

Position :

```txt
en haut ou à droite de la card
```

Fonction :

```txt
ouvrir le menu actions secondaires
```

Ne doit pas contenir les actions de link.

## 5.4 Drag / reorder

Desktop :

```txt
handle dédié discret
```

Mobile/tablette :

```txt
long press + drag ou affordance tactile selon la lib DnD
```

Règles :

```txt
- vertical uniquement dans la même colonne
- impossible si played
- impossible si locked
- si card linkée, déplacement du groupe linké selon les règles d’ordre
- si impossible, action refusée + snackbar
```

Animation :

```txt
tout déplacement doit être animé, jamais téléporté
```

Durée recommandée :

```txt
800 à 1000 ms pour les gros déplacements visibles
200 à 300 ms pour micro-ajustements
```

---

# 6. Appearance card — Menu trois-points

Menu recommandé :

```txt
- Modifier le musicien
- Jouer sans...
- Créer / retirer un conflit
- Supprimer ce passage
- Musicien parti
- Supprimer le participant
```

## 6.1 Modifier le musicien

Ouvre le drawer participant.

Dans ce drawer, l’organisateur peut :

```txt
- modifier le nom
- ajouter un instrument
- retirer un instrument
```

Feedback :

```txt
- modification nom : silent
- ajout instrument : snackbar + apparition animée des nouvelles cards
- retrait instrument : confirmation si nécessaire + snackbar
```

## 6.2 Jouer sans...

Cette action depuis une card est différente du flux `Plateau sans [instrument manquant]` du drawer d’appel : ici, on crée volontairement un trou lié à l’appearance source, sans repousser l’appearance source via `appearance_skipped`.

Déclenche une action métier :

```txt
appearance + hole + link
```

UI recommandée :

```txt
menu card → Jouer sans...
→ sélection d’un ou plusieurs instruments à exclure
→ validation
```

Conséquence :

```txt
- création d’un hole dans chaque colonne choisie
- link entre l’appearance et le(s) hole(s)
```

Feedback :

```txt
- snackbar
- animation d’apparition des holes
- animation de déplacement si le link réorganise
```

## 6.3 Créer / retirer un conflit

Déclenche le mode conflict du tableau.

Le menu ne doit pas gérer directement la sélection. Il active seulement le mode.

Comportement :

```txt
menu card → Créer / retirer un conflit
→ tableau passe en mode conflict
→ sélection/désélection des cards
→ validation dans la barre d’action du tableau
→ dialog pour choisir scope
```

Les holes visibles dans le tableau doivent être atténués/non sélectionnables en mode conflict : il n’y a pas de conflict sur hole en V0.

Scope demandé à la validation :

```txt
- seulement ce passage
- en général
```

## 6.4 Supprimer ce passage

Action uniquement pour appearance future non jouée.

Règles :

```txt
- confirmation obligatoire
- si l’appearance a un link, le dialog doit le préciser
- ne supprime pas le participant
- ne supprime pas la participation complète
- ne renumérote pas les appearances matérialisées
```

Message dialog recommandé :

```txt
Supprimer ce passage ?
Ce musicien restera inscrit. Seul ce passage sera retiré.
```

Si linked :

```txt
Ce passage est lié à d’autres éléments. Supprimer ce passage supprimera aussi les liens associés.
```

Feedback :

```txt
- snackbar après validation
- animation retrait card
```

## 6.5 Musicien parti

Passe le participant en `left`.

Règles :

```txt
- confirmation obligatoire
- supprime de la projection active toutes les appearances futures du participant
- empêche la création d’appearances futures pour les rounds suivants
- conserve les passages déjà joués
```

Message dialog recommandé :

```txt
Marquer ce musicien comme parti ?
Ses passages futurs seront retirés, mais les passages déjà joués resteront dans l’historique.
```

Feedback :

```txt
- snackbar
- animation retrait des appearances futures
```

## 6.6 Supprimer le participant

Visible uniquement si le participant n’a jamais joué.

Si le participant a déjà joué :

```txt
ne pas afficher l’action
ou afficher désactivée avec suggestion “Marquer comme parti”
```

Règles :

```txt
- confirmation obligatoire
- retire participant, participations et appearances futures de la projection active
- conserve l’historique eventLog
```

Feedback :

```txt
- snackbar
- animation retrait
```

---

# 7. Hole card — Contenu visuel

## 7.1 Structure recommandée

```txt
┌──────────────────────────────┐
│ Trou                     ⋮   │
│ Batterie · Round 1           │
│ [badges éventuels]           │
│                              │
│ [link] [lock/unlock]         │
└──────────────────────────────┘
```

Texte principal :

```txt
Trou
```

Texte secondaire possible :

```txt
Sans musicien
```

Si le hole est lié à une action “Jouer sans”, on peut afficher :

```txt
Sans batterie
```

ou dans la colonne Batterie :

```txt
Trou volontaire
```

Ne pas surcharger : le contexte de la colonne suffit souvent.

## 7.2 Hole joué

UI :

```txt
- grisé comme une appearance jouée
- immobile
- suppression désactivée
```

## 7.3 Hole locké

UI :

```txt
- cadenas fermé
- drag désactivé
```

## 7.4 Hole linké

UI :

```txt
- bouton link actif
- badge/link indicator discret
```

---

# 8. Hole card — Actions directes

## 8.1 Bouton link

Même règle que pour appearance :

```txt
- active le mode link avec le hole comme anchor
- indique l’état lié/non lié
- permet de sortir du mode link si le hole est l’anchor
```

Un link peut cibler :

```txt
- appearance
- hole
```

## 8.2 Bouton lock/unlock

Même règle que pour appearance.

## 8.3 Menu trois-points

Menu hole minimal.

```txt
- Supprimer le trou
```

Pas de conflict sur hole en V0.

## 8.4 Drag

Règles :

```txt
- vertical uniquement
- impossible si played
- impossible si locked
- confirmation non nécessaire pour déplacement
```

---

# 9. Hole card — Menu trois-points

## 9.1 Supprimer le trou

Confirmation obligatoire.

Message dialog recommandé :

```txt
Supprimer ce trou ?
```

Si linked :

```txt
Ce trou est lié à un autre passage. Le supprimer supprimera aussi les liens associés.
```

Règles :

```txt
- supprime uniquement le hole
- ne supprime jamais le participant ou l’appearance liée
- supprime/ignore les links associés au hole
```

Feedback :

```txt
- snackbar
- animation retrait
```

---

# 10. Cards dans le drawer d’appel

Le drawer d’appel affiche les musiciens du plateau à appeler.

Pour chaque musicien appelé, l’interface doit proposer :

```txt
- le marquer introuvable
```

## 10.1 Action “musicien introuvable”

Quand un musicien est introuvable, ne pas seulement repousser automatiquement sans choix. L’UI doit proposer des remplacements.

Flow recommandé :

```txt
Drawer d’appel
→ Musicien introuvable
→ panneau/remplacement pour cet instrument
→ proposer 3 musiciens de remplacement
→ proposer “Plateau sans [instrument manquant]”
```

Les 3 suggestions doivent être calculées selon :

```txt
- même instrument
- non joués en priorité
- disponibles
- non locked
- non played
- respect des conflicts
- respect raisonnable des links existants
- position proche / équitable
```

Si l’organisateur choisit un remplaçant :

```txt
- le remplaçant prend la place dans le plateau courant
- l’appearance introuvable est delinkée si nécessaire
- l’appearance introuvable est repoussée d’un plateau via appearance_skipped
- animation de remplacement dans le tableau
```

Si l’organisateur choisit “Plateau sans [instrument manquant]” :

```txt
- un hole remplace l’appearance dans le plateau courant
- l’appearance introuvable est delinkée si nécessaire
- l’appearance introuvable est repoussée d’un plateau via appearance_skipped
- le hole est joué avec le plateau si le plateau est validé
```

Important :

```txt
appearance_skipped n’est pas un état durable.
C’est une action ponctuelle de report.
Le bouton `Plateau sans [instrument manquant]` produit un hole de remplacement dans le plateau appelé et repousse l’appearance introuvable.
```

Feedback :

```txt
- snackbar après remplacement ou hole
- animation de déplacement/remplacement
```

---

# 11. Actions désactivées selon état

## 11.1 Si card played

Désactiver :

```txt
- drag
- suppression passage
- lock/unlock si inutile
- modification de link
- conflict si cela implique déplacement
```

Autoriser :

```txt
- consultation visuelle
```

## 11.2 Si card locked

Désactiver :

```txt
- drag
- déplacement automatique
- suppression tant que la card reste locked
```

Autoriser :

```txt
- unlock
- menu trois-points pour actions compatibles ne supprimant pas la card locked
```

## 11.3 Si participant left

Les appearances futures ne doivent plus être affichées.

Les appearances déjà jouées restent visibles.

---

# 12. Accessibilité et lisibilité

## 12.1 Tailles tactiles

Les boutons directs doivent avoir une zone tactile suffisante.

Recommandation :

```txt
minimum 40x40 px
idéal 44x44 px
```

## 12.2 Labels accessibles

Chaque action iconique doit avoir un label accessible :

```txt
- Créer ou modifier un lien
- Verrouiller ce passage
- Déverrouiller ce passage
- Ouvrir les actions du passage
```

## 12.3 États non portés uniquement par couleur

Ne jamais indiquer un état seulement par la couleur.

Chaque état doit avoir au moins :

```txt
- icône
- badge
- texte court
- changement de forme/opacity
```

---

# 13. Résumé opérationnel pour Codex

## AppearanceCard

Actions directes :

```txt
- link
- lock/unlock
- menu trois-points
- drag desktop/mobile
```

Menu :

```txt
- Modifier le musicien
- Jouer sans...
- Créer / retirer un conflit
- Supprimer ce passage
- Musicien parti
- Supprimer le participant si jamais joué
```

Pas dans le menu :

```txt
- link
- ajouter instrument
- retirer instrument
```

## HoleCard

Actions directes :

```txt
- link
- lock/unlock
- menu trois-points
- drag
```

Menu :

```txt
- Supprimer le trou
```

## Drawer participant

Contient :

```txt
- modification nom
- ajout/retrait instruments
```

## Drawer d’appel

Contient :

```txt
- musicien introuvable
- 3 remplaçants proposés
- Plateau sans [instrument manquant]
```

## États importants

```txt
- normal
- linked
- locked
- played
- selected in link mode
- selected in conflict mode
- disabled/not selectable
