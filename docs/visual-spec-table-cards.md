# Spec visuelle — Tableau, cards et states de jam

## 1. Objectif UI

L'interface doit permettre à un organisateur de jam de gérer rapidement les plateaux depuis un téléphone ou une tablette.

Priorités :

- lisibilité immédiate ;
- actions rapides ;
- cartes compactes ;
- erreurs limitées ;
- état du tableau compréhensible en un coup d'œil.

---

## 2. Layout général du tableau

Le tableau est une grille plateau-first avec :

- une colonne gauche dédiée aux actions de plateau ;
- une colonne par instrument ;
- une ligne par plateau potentiel ;
- une cellule rendue pour chaque couple plateau/instrument, même quand elle est vide ;
- une carte par musicien ou trou volontaire quand la cellule est occupée ;
- des colonnes de largeur fixe partagée entre header et cellules ;
- scroll horizontal pour les instruments ;
- scroll vertical pour les lignes de plateaux.

Cette grille ne doit pas devenir une juxtaposition de listes indépendantes par instrument : l'alignement d'une ligne matérialise le plateau et les cellules vides préservent cette lecture.

### Sticky

- Le header des instruments est sticky en haut.
- La colonne gauche d'actions est sticky à gauche.

### Mobile

Sur mobile :

- colonnes instrument scrollables horizontalement ;
- cartes compactes ;
- drawers full screen ;
- actions principales accessibles sans sous-navigation complexe.

### Tablette

Sur tablette :

- même logique ;
- plus de colonnes visibles ;
- colonnes plus larges ;
- drawers plus confortables.

---

## 3. Header du tableau

Le header de chaque colonne affiche uniquement le nom de l'instrument.

Exemples :

```text
Chant
Guitare
Basse
Batterie
Piano
Autre
```

Aucune statistique n'est affichée dans le header.

---

## 4. Colonne gauche — actions de plateau

Chaque ligne du tableau contient deux boutons directs dans la colonne gauche :

1. ouvrir le drawer d'appel ;
2. marquer le plateau joué.

Il n'y a pas de mode “ligne sélectionnée”.

### Bouton ouvrir le drawer d'appel

Icône recommandée : mégaphone / appel.

Exemple :

```text
📣
```

Action : ouvre le drawer d'appel pour la ligne.

### Bouton plateau joué

Icône : le même check que le bouton “musicien joué”.

Action : marque tous les musiciens de la ligne comme joués et valide les trous de la ligne comme partie du plateau.

---

## 5. Card musicien — structure de base

Une carte musicien doit afficher :

- nom du musicien ;
- tags d'état si nécessaire ;
- actions principales.

Structure compacte :

```text
Nicolas
✓  🔗  ⋯
[tag éventuel]
```

Les actions sont placées sous le nom, et non à droite du nom, afin de garder des colonnes étroites et stables.

Dans une colonne instrument standard, on ne répète pas le nom de l'instrument.

Dans la colonne “Autre”, on affiche le détail de l'instrument :

```text
Léa
saxophone
✓  🔗  ⋯
```

Le détail d'instrument custom est une ligne séparée : il n'est pas concaténé au nom du participant.

---

## 6. Actions visibles sur une card

### Actions principales

- `✓` : marquer comme joué ;
- `🔗` : entrer en mode link ;
- `⋯` : ouvrir les actions secondaires.

### Visibilité du check

Le check est visible uniquement sur les prochains musiciens jouables de chaque colonne.

Les cartes futures plus basses dans la colonne n'affichent pas le check.

### Menu `⋯`

Actions secondaires :

- modifier ;
- marquer comme parti ;
- veux jouer sans… ;
- supprimer cette participation si elle n'a jamais été jouée ;
- annuler le passage si la carte est déjà jouée.

---

## 7. Card normale

État par défaut pour un musicien actif non joué.

```text
Nicolas
🔗  ⋯
```

Style :

- fond normal ;
- texte principal très lisible ;
- carte draggable via long press ;
- pas de badge si aucun état particulier.

---

## 8. Card prochain à jouer

Le prochain musicien jouable d'une colonne affiche le check.

```text
Nicolas
✓  🔗  ⋯
```

Style :

- fond normal ;
- bordure légèrement renforcée ;
- check visible ;
- draggable via long press.

---

## 9. Card jouée

Une carte jouée représente un passage historique.

```text
Nicolas
✓ joué
⋯
```

Style :

- fond gris ;
- texte atténué ;
- non draggable ;
- pas de check d'action visible ;
- menu `⋯` disponible pour annulation ou action secondaire.

Actions possibles :

- annuler le passage ;
- marquer comme parti.

---

## 10. Card boucle / rejoue

Quand un musicien réapparaît en boucle, la carte affiche uniquement un petit tag bleu avec :

- icône ou emoji boucle ;
- numéro de boucle.

Exemple :

```text
Nicolas
🔁 2
🔗 ⋯
```

Le tag `🔁 2` signifie que le musicien est dans sa deuxième boucle de passage.

Style du tag :

- fond bleu ;
- texte clair ;
- petit format ;
- arrondi ;
- discret mais visible.

Pas de texte “rejoue” si le tag boucle est présent.

---

## 11. Card participant parti

Un participant marqué comme parti ne s'affiche plus dans les passages futurs.

S'il a déjà joué, ses cartes jouées restent visibles dans l'historique.

Affichage historique :

```text
Nicolas
✓ joué · parti
⋯
```

Style :

- fond gris joué ;
- badge ou texte secondaire “parti” ;
- non draggable.

---

## 12. Card trou volontaire

Un trou volontaire indique qu'aucun musicien ne doit jouer cet instrument sur cette ligne.

Exemple batterie :

```text
Ø Sans batterie
🔗 ⋯
```

Style :

- fond distinct du fond normal ;
- bordure pointillée ou hachurée ;
- texte explicite ;
- ne doit jamais ressembler à un bug ou à une cellule vide accidentelle.

Actions :

- link ;
- supprimer le trou si la ligne n'est pas jouée ;
- menu `⋯`.

Si le trou est joué dans un plateau validé, il reste visible dans l'historique.

---

## 13. Insertion entre deux cards

Quand l'organisateur clique entre deux cartes dans une colonne, une modale s'ouvre.

La modale propose deux choix :

```text
Ajouter ici

Ajouter un trou
Ajouter un participant
```

### Ajouter un trou

- ajoute un trou à cet endroit dans la colonne ;
- pousse les cartes suivantes vers le bas ;
- le trou n'est pas linké par défaut.

### Ajouter un participant

- ouvre le drawer d'ajout participant ;
- l'instrument de la colonne est précoché ;
- le participant est inséré à cet endroit après validation.

### Zone cliquable

La zone entre deux cartes doit être assez grande pour être tapable, mais visuellement discrète.

Affichage recommandé :

- petit séparateur léger ;
- apparition d'un bouton `+` au tap ou au hover tablette ;
- pas de bruit visuel permanent.

---

## 14. Affichage des links

Les cartes liées partagent :

- une bordure colorée commune ;
- un badge de groupe ;
- une icône link.

Exemple :

```text
Nicolas
🔗 A
```

Autre groupe :

```text
Sarah
🔗 B
```

### Groupe avec trou

Exemple guitare-voix sans batterie :

```text
Chant        Guitare       Batterie
Nicolas      Nicolas       Ø Sans batterie
🔗 A         🔗 A          🔗 A
```

---

## 15. Mode link

Quand l'organisateur clique sur `🔗`, le tableau passe en mode link.

### Header de mode

Un bandeau ou footer sticky indique :

```text
Mode lien
Sélectionne les musiciens à faire passer ensemble.

Annuler     Valider
```

### Card source

La carte source est mise en avant fortement.

```text
Nicolas
source
```

Style :

- bordure accentuée ;
- fond accentué ;
- badge “source”.

### Cartes déjà liées

Les cartes déjà liées sont mises en avant avec le même groupe.

```text
Jérémy
lié
```

### Cartes compatibles

Les cartes compatibles restent cliquables.

### Cartes incompatibles

Les cartes incompatibles sont atténuées et non cliquables.

Incompatibles :

- carte déjà jouée ;
- même instrument déjà présent dans le groupe ;
- participant parti ;
- action qui casserait une règle métier.

### Délier

Dans le même mode, recliquer sur une carte déjà liée la retire du groupe.

---

## 16. “Veux jouer sans…”

Action disponible dans le menu `⋯` d'une card.

Flow :

1. clic sur `⋯` ;
2. choix “Veux jouer sans…” ;
3. drawer compact ;
4. liste des autres instruments disponibles ;
5. sélection d'un ou plusieurs instruments ;
6. validation ;
7. création de trous linkés au participant ou au groupe.

Exemple drawer :

```text
Nicolas veut jouer sans :

☐ Chant
☐ Guitare
☑ Batterie
☐ Piano

Valider
```

Si Nicolas est déjà dans un groupe lié, les trous sont liés au groupe complet.

---

## 17. Drawer d'appel

Le drawer d'appel est accessible via le bouton `📣` de la colonne gauche.

### Format

- full screen sur mobile ;
- drawer large sur tablette ;
- bouton “Plateau joué” sticky en bas.

### Contenu

Chaque instrument est affiché avec le musicien correspondant en grand.

```text
Plateau #4

Chant
Sarah

Guitare
Nicolas

Basse
Tom

Batterie
Jérémy

Piano
Jeanne
```

Pour un trou :

```text
Batterie
Sans batterie
```

Pour “Autre” :

```text
Autre
Léa — saxophone
```

### Actions par musicien

- A joué ;
- N'est pas disponible.

### Action globale

- Plateau joué.

Après validation du plateau joué, le drawer se ferme automatiquement.

---

## 18. “N'est pas disponible”

Depuis le drawer d'appel, l'action ouvre une liste de remplaçants.

Exemple :

```text
Remplacer Jérémy — Batterie

Lucas
Non lié

Hugo
Lié avec Sarah — sera délié

Emma
🔁 2 · non lié
```

### Remplaçant non lié

- prend la place actuelle ;
- le musicien indisponible est déplacé à la prochaine ligne suivante disponible.

### Remplaçant lié

Confirmation :

```text
Hugo est lié à Sarah.
Le choisir va le délier et le déplacer seul.
Continuer ?
```

Si confirmé :

- le remplaçant est délié ;
- il prend la place actuelle.

### Musician indisponible lié

Confirmation similaire.

Si confirmé :

- il est délié ;
- il est déplacé seul.

---

## 19. Drag and drop

Le drag and drop se fait uniquement en vertical dans une colonne.

Aucune affordance visuelle dédiée n'est affichée.

Interaction :

- long press sur une card ;
- déplacement vertical ;
- relâchement.

Pendant le drag :

- la carte suit le doigt ;
- les cartes non jouées se décalent ;
- les cartes jouées restent fixes ;
- les groupes liés bougent ensemble ;
- les trous linkés suivent leur groupe.

Si une action est impossible, l'app affiche un message clair.

---

## 20. Modales de confirmation

Les confirmations doivent être réservées aux actions risquées.

### Actions avec confirmation

- annuler un passage joué ;
- annuler tout un plateau ;
- marquer comme parti ;
- choisir un remplaçant lié ;
- rendre indisponible un musicien lié ;
- supprimer un trou lié ;
- supprimer une participation non jouée ;
- modifier un participant déjà joué.

### Style

Les textes doivent être courts.

Exemple :

```text
Annuler le passage ?

Nicolas sera remis comme non joué à cette position.

Annuler
Confirmer
```

---

## 21. Création / édition participant — UI

Drawer full screen sur mobile.

Champs :

- nom ;
- instruments en multi-select ;
- détail “autres” si nécessaire ;
- section “faire passer en même temps” ;
- bouton valider sticky en bas.

### Nom déjà utilisé

Erreur bloquante :

```text
Ce nom est déjà utilisé dans cette jam.
```

### Instruments

Les instruments sont affichés dans l'ordre défini dans la jam.

Quand le drawer est ouvert depuis une insertion dans une colonne, l'instrument de cette colonne est précoché.

---

## 22. Création / édition jam — UI

Même écran en création et en édition.

Champs :

- nom ;
- date indicative ;
- instruments activés ;
- ajout instrument personnalisé ;
- réorganisation des instruments.

En édition, afficher les stats :

- musiciens uniques ;
- participations instrumentales ;
- plateaux joués ;
- musiciens n'ayant pas encore joué au moins un instrument.

---

## 23. Écran liste des jams — UI

Liste simple triée par date indicative.

Chaque card jam :

```text
Jam du jeudi
12 juin 2026
18 musiciens · 6 plateaux joués
```

Action principale :

```text
+ Nouvelle jam
```

---

## 24. Sync / offline — UI

Indicateur discret en haut de la page jam.

États :

```text
Synchronisé
Sauvegarde locale
Synchronisation en attente
Hors ligne
```

En cas de multi-appareil bloqué :

```text
Cette jam est déjà ouverte ailleurs.
Pour éviter les conflits, l'édition est bloquée sur cet appareil.
```

---

## 25. Empty states

### Jam sans participant

```text
Aucun musicien inscrit.
Ajoute un participant pour commencer.
```

### Instrument sans inscrit

La colonne existe mais affiche une invitation discrète à ajouter un participant.

### Aucun remplaçant disponible

```text
Aucun remplaçant disponible pour cet instrument.
```

### Tous les musiciens ont joué au moins une fois

Pas de message bloquant.

Le tableau continue avec les boucles.

---

## 26. Priorité visuelle des states

Si plusieurs states s'appliquent, priorité :

1. joué ;
2. trou ;
3. mode link actif ;
4. lié ;
5. prochain à jouer ;
6. boucle ;
7. normal ;
8. parti.

Note : `parti` ne s'affiche dans le tableau que si le passage a déjà été joué. Sinon le participant disparaît des passages futurs.

---

## 27. Wording retenu

- `A joué`
- `Plateau joué`
- `Veux jouer sans…`
- `Marquer comme parti`
- `N'est pas disponible`
- `Sans batterie`, `Sans basse`, etc.
- `Faire passer en même temps ?`
- tag boucle : `🔁 2`, `🔁 3`, etc.


---

## Drawers V0 branchés au store local

Les drawers V0 utilisent le composant partagé `AppDrawer` pour garder un format cohérent : header avec titre et fermeture, contenu scrollable, et barre d'actions sticky en bas quand une validation est nécessaire.

Drawers disponibles en V0 locale :

- `ParticipantFormDrawer` : ajout participant, instruments multiples, détail `Autre`, paires à lier et validation de nom unique ;
- `CallPlateauDrawer` : appel d'une ligne, actions `A joué`, `N'est pas disponible` et action globale `Plateau joué` ;
- `UnavailableReplacementDrawer` : choix d'un remplaçant dans la même colonne, avec confirmation si une carte liée doit être déliée ;
- `WantsToPlayWithoutDrawer` : choix d'instruments à remplacer par des trous liés ;
- `InsertBetweenCardsDialog` : choix entre ajouter un participant ou ajouter un trou.

Les actions restent locales et passent par le store Zustand, qui délègue les règles métier au moteur pur.

---

## Drag vertical V0

Le tableau utilise `dnd-kit` uniquement pour déplacer verticalement une carte dans sa colonne.

Règles V0 :

- activation par long press ;
- axe horizontal verrouillé à `x = 0` ;
- drop accepté seulement si la cible est dans le même instrument ;
- aucune action ne permet de changer d'instrument ;
- les cartes jouées ne sont pas sources de drag ;
- au drop valide, l'UI appelle l'action locale `MOVE_ENTRY_VERTICAL` via le store Zustand ;
- les groupes linkés restent alignés par la projection du moteur, donc les trous linkés suivent le groupe projeté.

Limite V0 : le geste drag déplace l'entrée source dans l'ordre de sa colonne et réutilise l'action `MOVE_ENTRY_VERTICAL` existante. Il ne crée pas de drag horizontal et ne déclenche pas une action séparée de déplacement groupé ; l'alignement des éléments liés reste assuré au recalcul par la projection row-first du moteur.

---

## CTA global d'ajout participant

Le bouton global `Ajouter un participant` est un FAB fixe en bas à droite avec uniquement l'icône `PersonAddIcon` et l'`aria-label` correspondant. Il ouvre le drawer participant sans préselection d'instrument.

Ce CTA est complémentaire des petits boutons `+` de cellule :

- le CTA sert à ajouter rapidement un participant, y compris quand la jam est vide ;
- les boutons `+` de cellule restent disponibles pour insérer à une position précise ;
- le CTA est masqué quand un drawer ou un dialog est ouvert, ou pendant le mode link, pour ne pas gêner les actions sticky.
