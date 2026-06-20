# Confiture.live — Product Spec V0

## Objectif du fichier

Ce fichier est la spec produit centrale de Confiture.live.

Il ne doit pas dupliquer toute la logique détaillée des autres specs. Il sert à :

- cadrer la vision produit ;
- définir le périmètre V0 ;
- relier les specs détaillées entre elles ;
- donner à Codex une lecture claire de ce qui doit être développé from scratch ;
- éviter de réintroduire des logiques legacy.

Quand une règle est détaillée dans un fichier spécialisé, Codex doit appliquer le fichier spécialisé en priorité.

---

## Fichiers de spec de référence

Codex doit considérer ces fichiers comme un ensemble cohérent :

```text
product-spec.md
technical-stack.md
confiture_event_actions_spec.md
sync_strategy.md
data_model.md
visual_spec_table.md
visual_spec_table_cards.md
```

Rôle de chaque fichier :

```text
product-spec.md
= vision produit, périmètre V0, règles fonctionnelles générales.

technical-stack.md
= technologies à utiliser, architecture applicative et conventions techniques.

confiture_event_actions_spec.md
= liste détaillée des actions/events, payloads, règles d’ordre, feedback organisateur.

sync_strategy.md
= stratégie local-first, sync backend sans client sessions V0, snapshots et erreurs de sync.

data_model.md
= modèles client/backend, eventLog, transactions, snapshots, projection.

visual_spec_table.md
= affichage global du tableau, colonnes, rounds, modes link/conflict, drawer d’appel.

visual_spec_table_cards.md
= affichage et actions des cards appearance/hole.
```

---

## Vision produit

Confiture.live est une application mobile-first pour organiser des jam sessions dans des bars.

L’application remplace la liste papier de l’organisateur par un tableau vivant permettant de :

- inscrire rapidement des musiciens ;
- gérer les participations par instrument ;
- afficher les passages à venir par colonne d’instrument ;
- former des plateaux cohérents ;
- gérer les musiciens multi-instruments ;
- gérer les musiciens qui veulent jouer ensemble ;
- gérer les musiciens ou passages qui ne doivent pas jouer ensemble ;
- gérer les trous volontaires ;
- suivre les plateaux joués ;
- gérer les musiciens absents au moment de l’appel ;
- garder un historique fiable de la jam ;
- fonctionner en local même avec un réseau instable.

Le produit doit rester utilisable en conditions réelles : bruit, urgence, faible disponibilité mentale, écran mobile/tablette, connexion potentiellement mauvaise.

---

## Principe architectural produit

La vérité principale n’est pas l’état visuel final du tableau.

La vérité principale est la liste ordonnée des actions effectuées pendant la jam.

```text
EventLog + Snapshot éventuel → Projection déterministe → Tableau affiché
```

Codex doit donc développer l’application autour de ces principes :

- chaque action organisateur produit une transaction ;
- une transaction contient un ou plusieurs `JamEvent` ;
- l’état affiché est recalculé par projection ;
- la projection doit être déterministe ;
- l’eventLog doit suffire à reconstruire la jam ;
- les snapshots ne sont qu’une optimisation ;
- le front applique les actions localement immédiatement ;
- le backend persiste l’historique et les snapshots ;
- il n’y a qu’un client actif en édition par jam.

---

## Plateformes V0

### Inclus

- Application web mobile-first.
- Utilisable sur smartphone.
- Utilisable sur tablette avec layout plus confortable.
- Même logique UX mobile/tablette.
- Utilisable sur desktop en dépannage, mais desktop non prioritaire.

### Exigences UI

- Grandes zones tactiles.
- Peu d’actions visibles en même temps.
- Feedback clair mais non envahissant.
- Animations sur les déplacements importants.
- Aucun blocage inutile pendant la jam.

---

## Authentification et accès

### V0

- Pas d’authentification organisateur obligatoire.
- L’écran d’accueil affiche les jams existantes.
- Une jam peut être créée et ouverte directement.
- V0 : aucune client session. Plusieurs devices peuvent envoyer des transactions. Le backend accepte les transactions valides et les ordonne par `serverSequenceNumber`.
- Les client sessions, leases, heartbeat, takeover et lecture seule multi-device sont repoussés en V1.

### V1 / hors V0

- Compte organisateur.
- Jams privées par organisateur.
- QR code participant.
- Inscription autonome des participants.
- Multi-client temps réel.

---

## Écran liste des jams

Objectif : ouvrir une jam existante ou en créer une nouvelle.

Chaque card de jam affiche :

- nom ;
- date indicative ;
- nombre de musiciens uniques ;
- nombre de plateaux joués ;
- dernière modification si utile.

Actions :

- bouton `Ouvrir` ;
- bouton supprimer avec confirmation ;
- bouton créer une jam.

Règles :

- la card entière ne doit pas ouvrir la jam ;
- l’ouverture passe par le bouton `Ouvrir` ;
- la suppression demande une confirmation via Dialog.

Empty state :

```text
Aucune jam créée pour l’instant.
```

Action principale :

```text
Créer une jam
```

---

## Création et configuration d’une jam

La création et l’édition de jam utilisent une modale ou un écran dédié cohérent.

Champs principaux :

- nom de la jam ;
- date indicative ;
- instruments actifs ;
- ordre des instruments ;
- ajout d’instrument personnalisé ;
- stratégie de réorganisation des links.

Instruments par défaut, dans cet ordre :

```text
Chant
Guitare
Basse
Batterie
Piano
Autre
```

Ajout d’instrument personnalisé :

- champ placeholder : `Ajouter un instrument` ;
- bouton inline à droite du champ pour valider ;
- instrument disponible uniquement dans la jam en cours.

Suppression d’instrument :

- le wording produit doit plutôt parler de masquer l’instrument ;
- l’instrument n’est pas supprimé physiquement de l’historique ;
- la colonne devient invisible dans le tableau ;
- l’instrument disparaît de la modale d’appel ;
- si des participations ou links actifs existent, afficher un warning spécifique ;
- la confirmation reste autorisée.

Stratégie de réorganisation des links :

```text
move_to_first     défaut
move_to_last
average_position
```

Cette configuration doit être enregistrée comme action/event.

---

## Modèle métier produit

### Participant

Personne réelle inscrite dans la jam.

Exemple : Nicolas.

### Participation

Inscription d’un participant sur un instrument.

Exemple : Nicolas joue guitare.

### Appearance

Occurrence concrète d’une participation dans un round donné.

Exemple : Nicolas guitare round 1, puis Nicolas guitare round 2.

Les links ciblent des appearances, pas seulement des participations.

### Hole

Card sans musicien, dans une colonne donnée.

Exemple : trou batterie pour un passage guitare-voix sans batterie.

Un hole peut être linké, locké, joué ou supprimé s’il n’est pas joué.

### Link

Contrainte positive : plusieurs targets doivent jouer sur le même plateau.

Targets possibles :

- appearance ;
- hole.

### Conflict

Contrainte négative : deux éléments ne peuvent pas jouer ensemble.

Scopes V0 :

```text
participation
appearance
```

Reasons V0 :

```text
instrument_constraint
manual
```

### Lock

Verrouillage strict d’une appearance ou d’un hole.

Un élément locké :

- ne peut pas être déplacé automatiquement ;
- ne peut pas être déplacé manuellement ;
- doit être unlock avant modification de position.

### Played

État historique.

Un élément joué :

- reste visible ;
- est grisé ;
- ne bouge plus ;
- n’est plus candidat aux réorganisations.

---

## Tableau de jam

Le tableau est l’écran principal de la jam.

Principe :

- une colonne = un instrument ;
- une card = une appearance ou un hole ;
- les plateaux sont déduits de l’alignement horizontal des cards ;
- il n’y a pas de drag horizontal ;
- le drag est uniquement vertical dans une colonne ;
- les colonnes sont indépendantes par défaut ;
- les links/conflicts/locks peuvent contraindre la projection.

Affichage détaillé : voir `visual_spec_table.md`.

Affichage des cards : voir `visual_spec_table_cards.md`.

---

## Rounds et appearances

Le round est le n-ième passage d’une participation.

Exemple :

```text
Nicolas / Guitare / round 1
Nicolas / Guitare / round 2
Nicolas / Guitare / round 3
```

Règles V0 :

- round 1 visible par défaut ;
- les rounds suivants sont révélés colonne par colonne ;
- chaque instrument est indépendant : les cards d’une colonne sont compactées dans cette colonne, sans laisser de trous artificiels pour s’aligner sur la longueur des autres colonnes ;
- quand un round suivant est révélé dans une colonne, les appearances de ce round se collent immédiatement après les appearances du round précédent dans cette même colonne ;
- l’ordre visuel d’une colonne est `round ASC`, puis `positionInRound ASC` ;
- les holes manuels ne sont pas pris en compte pour créer des espaces artificiels dans les autres colonnes ;
- les appearances futures peuvent être calculées par défaut ;
- elles sont matérialisées dès qu’une action spécifique les cible ;
- si une participation est ajoutée alors que plusieurs rounds sont visibles, une appearance est créée/positionnée à la fin de chaque round visible de l’instrument concerné ;
- l’ajout entre deux cards est exclu de la V0 et déplacé en V1.

Exemple attendu dans une colonne Chant :

```text
Anna
Léo
Maya
Zoé
Anna'
Léo'
Maya'
Zoé'
```

Exemple attendu dans une colonne Guitare plus courte :

```text
Noé
Iris
Tom
Noé'
Iris'
Tom'
```

La colonne Guitare ne doit pas attendre la longueur de la colonne Chant avant d’afficher `Noé'`.

---

## Participants et drawer participant

Le drawer participant permet :

- créer un participant ;
- modifier son nom ;
- modifier les instruments joués ;
- ajouter une participation instrumentale ;
- retirer une participation instrumentale.

Les actions suivantes ne doivent pas être dans le menu card :

- ajouter un instrument ;
- retirer cet instrument.

Elles passent par le drawer participant.

Nom participant :

- requis ;
- unique dans une jam ;
- pas de gestion avancée d’identité en V0.

Suppression participant :

- seulement si le participant n’a jamais joué ;
- si le participant a déjà joué, proposer uniquement `Marquer comme parti` ;
- le menu secondaire d’une card ne doit jamais afficher simultanément `Supprimer participant` et `Musicien parti`.

Marquer comme parti :

- accessible depuis le menu trois-points d’une card ;
- passe le participant en `left` ;
- retire ses appearances futures ;
- empêche d’en créer dans les rounds suivants ;
- conserve les appearances déjà jouées.

---

## Cards

Une card appearance doit afficher :

- nom du musicien ;
- instrument si nécessaire ;
- états importants : linked, locked, played ;
- bouton link avec état lié/non lié ;
- bouton lock/unlock ;
- menu trois-points ;
- handle de drag sur desktop si applicable.

Le menu trois-points d’une appearance contient uniquement les actions secondaires non redondantes :

- modifier le musicien ;
- jouer sans… ;
- créer/retirer un conflit ;
- supprimer ce passage ;
- musicien parti ;
- supprimer participant si jamais joué.

Le menu ne doit pas contenir d’action link.

Une card hole affiche :

- libellé de trou ;
- instrument concerné ;
- états linked/locked/played ;
- bouton link ;
- bouton lock/unlock ;
- menu trois-points avec suppression du trou.

---

## Mode link

Le link se crée exclusivement via le bouton link d’une card.

Process :

1. l’organisateur clique sur le bouton link d’une card ;
2. le tableau passe en mode link ;
3. la card source devient l’anchor ;
4. l’organisateur sélectionne des cards dans d’autres colonnes ;
5. il valide explicitement ;
6. le système crée ou retire les links nécessaires ;
7. les cards sont réorganisées selon la stratégie de jam.

Sortie du mode link :

- annuler via la barre d’action ;
- ou recliquer sur le bouton link de la card anchor.

Feedback :

- animation de déplacement si cards réorganisées ;
- snackbar si des passages ont été déplacés ;
- snackbar explicative si action refusée par conflict.

---

## Mode conflict

Le conflict manuel se crée/supprime via un mode conflict du tableau.

Déclencheur :

- menu trois-points d’une card ;
- action `Créer / retirer un conflit`.

Process :

1. le tableau passe en mode conflict ;
2. la card source devient l’anchor ;
3. l’organisateur sélectionne ou désélectionne des cards ;
4. à la validation, une Dialog demande le scope ;
5. le système crée/supprime les conflicts ;
6. la projection réorganise si nécessaire.

Scope demandé à la validation :

```text
Seulement ce passage
En général
```

Mapping :

```text
Seulement ce passage → scope appearance
En général → scope participation
```

Pas de modification directe d’un conflict en V0.

Pour modifier : supprimer puis recréer.

---

## Trous et “jouer sans”

Un hole est une appearance sans musicien.

Il peut être créé en V0 :

- via `Jouer sans…` depuis le menu d’une appearance ;
- via `Plateau sans [instrument manquant]` dans le drawer d’appel.

L’ajout manuel de hole entre deux cards est hors V0 et déplacé en V1.

`Jouer sans…` ne doit pas être modélisé comme un type métier séparé.

Il produit :

```text
hole_added + link_created
```

Si un hole linké est supprimé :

- le hole disparaît ;
- les links ciblant ce hole sont supprimés ou ignorés dans la projection ;
- l’appearance musicien liée reste intacte.

Toute suppression de hole demande confirmation.

Si le hole a un link, le Dialog doit le préciser.

---

## Drawer d’appel

Le drawer d’appel sert à appeler un plateau.

Il affiche les instruments dans le même ordre que le tableau.

Pour chaque instrument :

- nom du musicien ;
- ou hole / sans musicien ;
- état link/lock si utile ;
- actions nécessaires au live.

Action globale :

```text
Plateau joué
```

Action par musicien :

```text
Musicien introuvable
```

Quand un musicien est introuvable :

- proposer trois remplaçants possibles ;
- proposer aussi `Plateau sans [instrument manquant]` ;
- si un remplaçant est choisi, il remplace l’appearance dans le tableau ;
- l’appearance introuvable est skippée et repoussée d’un plateau ;
- si l’appearance introuvable est linkée, elle est délinkée puis repoussée seule ;
- si `Plateau sans [instrument manquant]` est choisi, elle est remplacée par un hole.

Cette logique correspond à `appearance_skipped`.

`appearance_skipped` n’est pas un état durable.

---

## Plateau joué

Un plateau est déduit de l’alignement horizontal des cards.

L’organisateur peut :

- ouvrir le drawer d’appel du plateau ;
- marquer le plateau joué.

Quand un plateau est joué :

- toutes les appearances du plateau deviennent played ;
- tous les holes du plateau deviennent played ;
- les cards deviennent historiques ;
- elles ne bougent plus ;
- les plateaux futurs peuvent être recalculés.

Annulation :

- undo global recommandé ;
- `plateau_unplayed` reste possible selon les règles détaillées dans `confiture_event_actions_spec.md`.

---

## Undo

L’undo est linéaire.

Pour annuler une action ancienne, il faut d’abord avoir annulé toutes les actions plus récentes encore actives.

L’undo :

- ne supprime jamais les events historiques ;
- ajoute une transaction/event de revert ;
- garde l’historique complet ;
- recalcule la projection.

---

## Synchronisation et offline

L’application est local-first.

Pendant la jam :

- chaque action est appliquée localement immédiatement ;
- chaque action est persistée localement ;
- chaque transaction est envoyée au backend ;
- si le backend est indisponible, l’utilisateur continue à travailler ;
- l’état de sync reste positif et rassurant ;
- un warning discret indique que la sauvegarde backend est en attente.

Un seul client actif peut éditer une jam en temps réel.

Détails complets : `sync_strategy.md`.

---

## Feedback organisateur

Feedbacks possibles :

```text
silent
snackbar
dialog
animation
dialog + snackbar
animation + snackbar
```

Principes :

- ne pas afficher de snackbar pour les actions évidentes visuellement ;
- utiliser Dialog pour actions destructives ou ambiguës ;
- utiliser snackbar pour expliquer un déplacement automatique ou un refus ;
- utiliser animations pour tous les déplacements de cards.

Exemples :

- `jam_created` : silent, arrivée directe sur la page ;
- `jam_updated` : snackbar ;
- `participant_created` : silent, apparition des cards suffisante ;
- ajout d’un instrument à un participant existant : snackbar + apparition animée ;
- link créé avec déplacement : animation + snackbar ;
- suppression appearance/hole : Dialog obligatoire + snackbar ;
- conflict contradictoire avec link : snackbar explicative.

La source détaillée reste `confiture_event_actions_spec.md`.

---

## Hors périmètre V0

Ne pas développer en V0 :

- QR code participant ;
- compte organisateur ;
- multi-client temps réel ;
- édition collaborative ;
- notes sur participant, participation ou appearance ;
- drawer link ;
- drawer conflict ;
- `play_without_created` / `play_without_removed` comme events dédiés ;
- `plateau_composition_forced` ;
- drag horizontal ;
- suppression physique RGPD avancée ;
- historique détaillé éditable par transaction.

---

## Règles non négociables pour Codex

- Développer from scratch en se basant sur les specs actuelles, pas sur l’ancien modèle `ParticipantEntry`, `LinkGroup`, `PlayedPassage` comme source de vérité.
- La source de vérité est l’eventLog.
- La projection du tableau doit être pure et testable.
- L’UI ne doit pas modifier directement l’état final comme vérité durable.
- Les notes ne doivent pas être implémentées.
- Les links passent uniquement par le bouton link et le mode link du tableau.
- Les conflicts passent uniquement par le mode conflict.
- Les instruments d’un participant se modifient dans le drawer participant.
- Les rounds visibles et appearances matérialisées doivent respecter `data_model.md`.
- Les règles d’ordre doivent respecter `confiture_event_actions_spec.md`.


## Iconographie des actions de jam

La V0 utilise une iconographie MUI stable pour les actions principales du tableau :

| Action | Icône MUI |
|---|---|
| Déplacer une card | `drag_handle` |
| Créer / visualiser un link | `link` |
| Modifier le musicien | `edit` |
| Jouer sans | `disabled_by_default` |
| Créer / retirer un conflit | `swords` |
| Supprimer ce passage | `delete` |
| Musicien parti / supprimer participant | `person_off` |
| Appeler plateau | `campaign` |
| Marquer comme joué | `check_circle` |

Ces icônes doivent être utilisées dans les actions directes, les menus secondaires des cards et le rail de plateau quand l’action correspondante est présente.



## Plateau joué et instruments vides

Quand un plateau est marqué joué, chaque colonne visible doit être figée sur cette ligne. Si une colonne est vide, l’app crée un trou joué `played_empty_slot` avant de marquer le plateau joué. Les participations ajoutées plus tard ne peuvent pas venir occuper cette ligne historique.

### Règles visuelles cards — V0

Les états des cards ne sont pas signalés par des bordures colorées. La bordure reste neutre pour tous les états (`link`, `locked`, `conflict`, sélection, played).

```txt
- link inactif : icône link blanche, cliquable ;
- link actif : icône link en jaune, couleur d’accent link du thème ;
- locked : icône lock en couleur d’accent lock verte du thème ;
- conflict : chip / icône conflict uniquement pour les conflits entre deux participants différents ;
- played : opacity / chip joué.
```

Les boutons du rail de plateau sont côte à côte et en icône seule :

```txt
[campaign] appeler plateau
[check_circle] marquer comme joué
```



### Règles d’entêtes tableau — V0 compacte

La colonne plateau possède une entête alignée en hauteur avec les entêtes instruments. Les gaps verticaux sont identiques entre la colonne plateau et les colonnes instruments. Les entêtes instruments affichent uniquement le nom de l’instrument en niveau de titre plus grand ; les compteurs et mentions de round visible ne sont pas affichés dans ces entêtes.

### Drag visuel des locked

Les cards locked ne doivent pas bouger visuellement pendant le drag and drop d’autres éléments. Elles restent stables, sans transform/preview/transition parasite ; les autres cards peuvent se réorganiser autour.

## Mise à jour — validation des modes link/conflict

En V0, les modes link et conflict utilisent une interaction de tableau dédiée :

- le bouton d’entrée dans le mode reste sur la card hors mode ;
- une fois le mode actif, les cards n’ont plus de boutons internes ;
- toute la card est cliquable pour sélectionner/désélectionner ;
- `Annuler` et `Valider` sont disponibles en fixed bottom ;
- le bouton flottant d’ajout participant est masqué pendant le mode actif ;
- une seule card par colonne peut être sélectionnée à la fois ;
- cliquer une card sélectionnée la désélectionne ;
- link et conflict partagent les mêmes règles de sélection, avec des couleurs distinctes.
