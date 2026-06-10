# Spec visuelle — Tableau et cards de gestion de jam

## 1. Objectif du tableau

Le tableau est l’interface principale de gestion d’une jam session.

Il permet à l’organisateur de :

- visualiser les plateaux à venir ;
- voir les musiciens par instrument ;
- identifier les musiciens déjà passés ;
- lancer l’appel d’un plateau ;
- valider rapidement un plateau joué ;
- gérer les liens entre musiciens ;
- gérer les trous volontaires ;
- comprendre les boucles de passage.

Le tableau est pensé pour un usage mobile et tablette, avec la même logique responsive.

---

## 2. Structure générale du tableau

Le tableau est composé de :

- une colonne fixe à gauche pour les actions de plateau ;
- une colonne par instrument ;
- une carte par case de musicien ou de trou ;
- un scroll horizontal si les colonnes dépassent la largeur disponible ;
- un scroll vertical pour parcourir les lignes de plateau.

Exemple :

```text
        Chant        Guitare       Basse        Batterie      Piano
📣 ✓    Sarah        Nicolas       Tom          Emma          Jeanne
📣 ✓    Léa          Paul          Karim        Lucas         Clara
📣 ✓    Marc         Julie         Max          Hugo          Alice
```

Chaque ligne correspond à un plateau potentiel.

Chaque colonne correspond à une file d’attente indépendante d’un instrument.

---

## 3. Header du tableau

### 3.1 Header instrument

Le header de chaque colonne affiche uniquement le nom de l’instrument.

Exemple :

```text
Chant
```

```text
Guitare
```

```text
Batterie
```

Aucune statistique n’est affichée dans le header du tableau.

À ne pas afficher dans le header :

- nombre de musiciens restants ;
- nombre de musiciens jamais passés ;
- état de boucle ;
- total d’inscrits ;
- badges ou compteurs.

Ces informations appartiennent à d’autres zones de l’interface, pas au tableau.

### 3.2 Style du header

Recommandation visuelle :

- sticky en haut pendant le scroll vertical ;
- texte court, très lisible ;
- aligné avec les cards de sa colonne ;
- hauteur compacte ;
- fond légèrement différencié du tableau.

---

## 4. Colonne gauche — actions de plateau

La colonne gauche contient les actions directes de chaque ligne.

Il n’y a pas de notion de ligne sélectionnée en V0.

Chaque ligne affiche directement deux boutons :

1. ouvrir le drawer d’appel ;
2. marquer le plateau comme joué.

Exemple :

```text
📣 ✓
```

### 4.1 Bouton ouvrir le drawer d’appel

Icône recommandée :

```text
📣
```

Action : ouvrir le drawer d’appel du plateau correspondant.

Le drawer affiche les musiciens de la ligne en grand pour permettre à l’organisateur de les appeler facilement.

### 4.2 Bouton plateau joué

Icône : même icône que le bouton “musicien joué”.

Recommandation :

```text
✓
```

Action : marquer tous les musiciens de la ligne comme ayant joué.

Effet :

- toutes les cards musicien de la ligne passent en état `joué` ;
- les trous volontaires de la ligne passent en historique ;
- la ligne reste à sa place ;
- les lignes jouées ne remontent pas automatiquement ;
- les colonnes recalculent les futurs passages si nécessaire.

### 4.3 Style de la colonne gauche

Recommandation :

- colonne sticky à gauche ;
- largeur compacte ;
- deux boutons empilés ou côte à côte selon la largeur disponible ;
- boutons très accessibles au doigt ;
- pas d’autre action visible dans cette colonne.

---

## 5. Card musicien — structure commune

Chaque case contenant un musicien est affichée sous forme de card compacte.

Structure recommandée :

```text
┌──────────────┐
│ Nicolas      │
│ 🔗 A · 🔁2    │
│ ✓      ⋯     │
└──────────────┘
```

Contenu possible :

- nom du musicien ;
- tag de lien ;
- tag de boucle ;
- actions visibles ;
- menu secondaire.

### 5.1 Nom du musicien

Le nom est l’information principale.

Règles :

- il doit être très lisible ;
- il ne doit pas être masqué par les badges ;
- si le nom est long, il peut être tronqué avec ellipsis ;
- deux musiciens ne peuvent pas avoir exactement le même nom dans une jam.

### 5.2 Instrument affiché dans la card

L’instrument n’est pas répété dans la card, car il est déjà indiqué par la colonne.

Exception : colonne `Autres`.

Dans la colonne `Autres`, la card affiche le nom du musicien et le détail de l’instrument.

Exemple :

```text
Léa
saxophone
```

---

## 6. Actions visibles dans une card

### 6.1 Bouton “musicien joué”

Icône :

```text
✓
```

Le bouton est visible uniquement pour les prochains musiciens qui vont jouer selon la logique de file d’attente.

Il n’est pas visible sur tous les musiciens futurs.

Effet :

- la card passe en état `joué` ;
- le passage est conservé dans l’historique ;
- la card devient grisée ;
- la card n’est plus draggable.

### 6.2 Bouton link

Icône :

```text
🔗
```

Action : entrer en mode link depuis ce musicien.

Le mode link permet :

- de lier ce musicien à d’autres musiciens ;
- de délier des musiciens déjà liés ;
- de lier un trou volontaire au groupe.

### 6.3 Menu secondaire

Icône :

```text
⋯
```

Actions possibles :

- modifier le participant ;
- marquer comme parti ;
- veux jouer sans ;
- supprimer la participation si elle n’a jamais été jouée ;
- annuler le passage si la card est déjà jouée.

---

## 7. État normal

État par défaut d’un musicien actif, non joué, non lié, hors boucle.

Affichage :

```text
┌──────────────┐
│ Nicolas      │
│ 🔗      ⋯    │
└──────────────┘
```

Style :

- fond normal ;
- texte principal fort ;
- bordure simple ;
- draggable verticalement ;
- pas de badge particulier.

---

## 8. État prochain à jouer

Un musicien prochain à jouer est le prochain musicien disponible dans sa colonne.

Affichage :

```text
┌──────────────┐
│ Nicolas      │
│ ✓  🔗   ⋯    │
└──────────────┘
```

Style :

- même base que l’état normal ;
- bouton check visible ;
- légère mise en avant possible, mais pas obligatoire ;
- draggable tant qu’il n’est pas joué.

Règle : le check n’est visible que pour les prochains musiciens jouables.

---

## 9. État joué

Un musicien joué est un passage validé.

Affichage :

```text
┌──────────────┐
│ Nicolas      │
│ ✓ joué   ⋯   │
└──────────────┘
```

Style :

- fond gris ;
- texte atténué ;
- card figée ;
- non draggable ;
- reste visible dans l’historique du tableau ;
- ne remonte pas automatiquement.

Actions disponibles :

- menu `⋯` ;
- action `Annuler le passage`.

Si le passage est annulé :

- la card garde sa position ;
- elle redevient non jouée ;
- elle redevient draggable si elle est dans une zone modifiable.

---

## 10. État boucle / rejoue

Quand un musicien réapparaît parce qu’il a déjà joué une première fois, il est affiché en état boucle.

L’état boucle doit être visible mais discret.

Affichage demandé : petit tag bleu avec icône ou emoji boucle + numéro de boucle.

Exemples :

```text
🔁2
```

```text
↻2
```

```text
boucle 2
```

Recommandation :

```text
🔁2
```

Format card :

```text
┌──────────────┐
│ Nicolas      │
│ 🔁2  🔗  ⋯   │
└──────────────┘
```

Style du tag boucle :

- petit tag bleu ;
- texte blanc ou bleu foncé selon contraste ;
- arrondi fort ;
- très court ;
- placé dans la ligne de badges.

Règle de numérotation :

- `🔁2` = deuxième passage potentiel du musicien ;
- `🔁3` = troisième passage potentiel ;
- etc.

Le premier passage n’affiche pas de tag boucle.

---

## 11. État parti

Un musicien marqué comme parti ne doit plus apparaître dans les futurs passages.

Il reste visible uniquement dans les passages déjà joués.

Affichage dans l’historique :

```text
┌──────────────┐
│ Nicolas      │
│ ✓ joué · parti│
└──────────────┘
```

Style :

- même style que joué ;
- badge ou mention `parti` ;
- texte atténué ;
- non draggable.

Règles :

- si un musicien part avant d’avoir joué, il disparaît du tableau futur ;
- il reste visible dans la liste des participants de la jam avec l’état `parti` ;
- si un musicien a déjà joué, ses passages joués restent visibles dans le tableau.

---

## 12. Trou volontaire

Un trou volontaire est une case explicitement créée par l’organisateur.

Cas d’usage principal : un musicien ou un groupe veut jouer sans un instrument.

Exemple : Nicolas chant + guitare veut jouer sans batterie.

Affichage :

```text
┌──────────────┐
│ Ø Sans       │
│ batterie     │
│ 🔗 A    ⋯    │
└──────────────┘
```

Style :

- fond distinct du musicien normal ;
- bordure pointillée ou hachurée ;
- texte clair : `Sans batterie` ;
- ne doit pas ressembler à une erreur ou à une donnée manquante.

Règles :

- le trou ne fait pas partie des boucles ;
- le trou peut être linké à un musicien ou à un groupe ;
- le trou suit le groupe auquel il est lié ;
- si le plateau est joué, le trou est conservé dans l’historique ;
- le trou peut être supprimé avant passage.

---

## 13. Action “veux jouer sans”

L’action `Veux jouer sans` est accessible dans le menu `⋯` d’une card musicien.

Flow :

1. l’organisateur ouvre le menu `⋯` d’un musicien ;
2. il clique sur `Veux jouer sans` ;
3. une liste des autres instruments disponibles s’affiche ;
4. il coche un ou plusieurs instruments ;
5. il valide ;
6. l’app crée un trou dans chaque colonne choisie ;
7. les trous sont linkés au musicien ou au groupe du musicien.

Exemple :

```text
Chant        Guitare       Batterie
Nicolas      Nicolas       Sans batterie
🔗 A         🔗 A          🔗 A
```

Si plusieurs instruments sont cochés, plusieurs trous sont créés.

---

## 14. Affichage des links

Les musiciens et trous liés doivent être clairement identifiables.

Proposition : utiliser un badge de groupe.

Exemples :

```text
🔗 A
```

```text
🔗 B
```

```text
🔗 C
```

Toutes les cards du même groupe lié affichent le même badge.

Exemple :

```text
Chant        Guitare       Batterie
Nicolas      Nicolas       Sans batterie
🔗 A         🔗 A          🔗 A
```

Style recommandé :

- badge court ;
- même couleur de bordure pour les cards liées ;
- même identifiant de groupe ;
- ne pas afficher de longs textes comme `lié avec...` dans le tableau.

---

## 15. Mode link

Quand l’organisateur clique sur l’icône link d’une card, le tableau passe en mode link.

### 15.1 Card source

La card source est mise en avant fortement.

Affichage possible :

```text
Nicolas
source
```

Style :

- bordure accentuée ;
- fond légèrement accentué ;
- badge `source` ou état visuel équivalent.

### 15.2 Cards déjà liées

Les cards déjà liées à la source sont mises en avant avec le même badge de groupe.

L’organisateur peut recliquer dessus pour les délier.

### 15.3 Cards sélectionnables

Les cards compatibles restent cliquables.

Compatibles :

- musicien non joué ;
- autre colonne ;
- non parti ;
- pas déjà incompatible avec le groupe.

### 15.4 Cards incompatibles

Les cards incompatibles sont visibles mais atténuées.

Exemples de cards incompatibles :

- musicien déjà joué ;
- même instrument déjà présent dans le groupe ;
- participant parti ;
- case non modifiable.

### 15.5 Barre de validation

En mode link, une barre d’action apparaît en bas :

```text
Annuler        Valider
```

Le recalcul du tableau se fait après validation.

---

## 16. Participant multi-instruments

Un participant peut apparaître dans plusieurs colonnes avec le même nom.

Exemple : Nicolas chant + guitare.

Si les instruments sont liés :

```text
Chant        Guitare
Nicolas      Nicolas
🔗 A         🔗 A
```

Si les instruments ne sont pas liés :

```text
Chant        Guitare
Nicolas      Nicolas
```

Règles :

- même nom affiché dans chaque colonne ;
- si les cases sont liées, elles ont le même badge de link ;
- si elles ne sont pas liées, elles se comportent comme deux participations indépendantes ;
- pas d’avertissement affiché dans le tableau si les instruments ne sont pas liés.

---

## 17. Colonne `Autres`

Dans la colonne `Autres`, la card affiche le nom du musicien et le détail libre de l’instrument.

Exemple :

```text
┌──────────────┐
│ Léa          │
│ saxophone    │
│ 🔗      ⋯    │
└──────────────┘
```

Si la card est en boucle :

```text
┌──────────────┐
│ Léa          │
│ saxophone    │
│ 🔁2 🔗   ⋯   │
└──────────────┘
```

---

## 18. Drawer d’appel

Le drawer d’appel est ouvert via le bouton `📣` dans la colonne gauche.

Il affiche les musiciens du plateau en grand.

Exemple :

```text
Plateau

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

Actions dans le drawer :

- `A joué` par musicien ;
- `N’est pas disponible` par musicien ;
- `Plateau joué` pour toute la ligne.

Le bouton `Plateau joué` dans le drawer a le même effet que le bouton check de la colonne gauche.

---

## 19. “N’est pas disponible” dans le drawer

Quand l’organisateur clique sur `N’est pas disponible`, l’app propose des remplaçants dans la même colonne.

Exemple :

```text
Remplacer Jérémy à la batterie

Lucas
non lié

Hugo
lié avec Sarah

Emma
non lié
```

Règles :

- le remplaçant prend la place du musicien indisponible ;
- le musicien indisponible est déplacé à la prochaine ligne suivante disponible ;
- aucun état durable `indisponible` n’est créé ;
- si le musicien indisponible est lié, il est délié après confirmation ;
- si le remplaçant est lié, il est délié après confirmation.

---

## 20. Drag vertical

Le drag and drop est uniquement vertical dans une colonne.

Il n’y a jamais de drag horizontal.

Règles :

- les cards non jouées sont draggable ;
- les cards jouées ne sont pas draggable ;
- les trous non joués peuvent être déplacés s’ils sont modifiables ;
- un groupe lié se déplace ensemble ;
- les autres cards de la colonne sont poussées pour éviter les trous ;
- le tableau ne crée pas de trou automatiquement lors d’un drag.

---

## 21. Priorité visuelle des states

Si plusieurs états s’appliquent à une card, l’ordre de priorité visuelle est :

1. joué ;
2. trou volontaire ;
3. mode link actif ;
4. lié ;
5. prochain à jouer ;
6. boucle ;
7. normal ;
8. parti.

Note : `parti` n’apparaît dans le tableau que pour les passages déjà joués conservés en historique.

---

## 22. Résumé des cards

### Normal

```text
Nicolas
🔗 ⋯
```

### Prochain à jouer

```text
Nicolas
✓ 🔗 ⋯
```

### Joué

```text
Nicolas
✓ joué ⋯
```

### Boucle

```text
Nicolas
🔁2 🔗 ⋯
```

### Lié

```text
Nicolas
🔗 A ⋯
```

### Multi-instrument lié

```text
Chant        Guitare
Nicolas      Nicolas
🔗 A         🔗 A
```

### Trou volontaire

```text
Sans batterie
🔗 A ⋯
```

### Joué + parti

```text
Nicolas
✓ joué · parti
```

---

## 23. Décisions UI actées

- Le header du tableau affiche uniquement le nom de la colonne.
- La colonne gauche contient uniquement deux actions : ouvrir le drawer d’appel et marquer le plateau joué.
- Le bouton plateau joué utilise la même icône que le bouton musicien joué.
- Il n’y a pas de ligne sélectionnée.
- Les actions de ligne sont directes.
- Le tag boucle est un petit tag bleu avec icône/emoji boucle + numéro de boucle.
- Le drag and drop est uniquement vertical.
- Aucun drag horizontal n’existe.
- Les lignes jouées ne remontent pas automatiquement.
- Les musiciens partis disparaissent du futur mais restent dans l’historique s’ils ont joué.

---

## 24. Compléments UI appliqués par recommandation

Cette section verrouille les points visuels encore ouverts.

### 24.1 Trou manuel non lié

Un trou manuel non lié est affiché comme un trou volontaire classique, mais sans badge de link.

Affichage :

```text
Sans basse
⋯
```

Style :

- fond distinct ;
- bordure pointillée ou hachurée ;
- libellé explicite `Sans <instrument>` ;
- aucun badge `🔗` si le trou n'est pas lié.

Actions dans le menu `⋯` tant que le plateau n'est pas joué :

- supprimer le trou ;
- lier le trou ;
- modifier si nécessaire.

Une fois joué, le trou est grisé et conservé comme élément d'historique.

### 24.2 Ajout d'un trou manuel depuis le drawer d'appel

Dans le drawer d'appel, chaque instrument peut proposer l'action :

```text
Jouer sans cet instrument
```

Cette action crée une card `Sans <instrument>` sur la ligne appelée.

Le musicien qui devait occuper cette place est déplacé à la prochaine ligne suivante disponible.

### 24.3 Suppression d'un trou

Un trou non joué est supprimable depuis son menu `⋯`.

Si le trou est lié, la suppression le retire aussi du groupe lié.

Un trou joué n'est pas supprimable directement depuis le tableau. Il faut d'abord annuler le passage de la case ou du plateau.

### 24.4 Annulation d'un passage joué

Depuis une card jouée, le menu `⋯` propose :

```text
Annuler le passage
```

Après clic, un dialogue propose :

```text
Annuler uniquement cette case
Annuler tout le plateau
```

Recommandation visuelle :

- dialogue court ;
- message clair ;
- action destructive visuellement différenciée ;
- aucun mouvement automatique de ligne pendant l'annulation.

### 24.5 État de synchronisation

La synchronisation ne doit pas gêner l'organisateur pendant la jam.

Affichage recommandé :

- petit indicateur discret dans la barre supérieure ;
- `Synchronisé` si tout est à jour ;
- `À synchroniser` si des actions locales n'ont pas encore été persistées ;
- pas de snackbar répétitif à chaque retry.

### 24.6 Mode lecture seule multi-appareil

En V0, si une jam est déjà ouverte en édition sur un autre appareil, l'interface du second appareil doit être en lecture seule ou bloquée.

Affichage recommandé :

```text
Jam ouverte sur un autre appareil
Modification désactivée
```

Les boutons d'action du tableau sont alors disabled.

---

## 25. Règles finales de densité mobile

Les cards doivent rester compactes.

Priorité du contenu dans une card :

1. nom du musicien ou libellé du trou ;
2. tag link si présent ;
3. tag boucle si présent ;
4. check si la case est prochainement jouable ;
5. menu `⋯`.

À éviter :

- phrases longues dans les cards ;
- répétition du nom de l'instrument hors colonne `Autres` ;
- trop d'icônes visibles ;
- statistiques dans les headers de colonne ;
- état `parti` visible dans les futures lignes.
