# Spécification produit — Outil de gestion de jam session

## 1. Vision produit

Le produit est une interface mobile/tablette destinée aux organisateurs de jam sessions dans des bars.

L'objectif principal est de remplacer la liste papier ou la gestion mentale pendant une jam, afin de :

- éviter le chaos de la liste d'inscription ;
- faire tourner les musiciens plus équitablement ;
- gagner du temps pendant la soirée ;
- permettre à l'organisateur de savoir rapidement qui doit jouer, qui a déjà joué, qui n'a pas encore joué, et qui est parti.

La V0 est centrée uniquement sur l'organisateur. Les participants ne s'inscrivent pas encore eux-mêmes via QR code.

---

## 2. Plateformes visées

### V0

- Interface mobile first.
- Compatible tablette en responsive.
- Même logique fonctionnelle sur mobile et tablette.
- Pas d'interface desktop prioritaire.

### Contraintes d'usage

L'interface doit être utilisable :

- en soirée ;
- debout ;
- rapidement ;
- dans un environnement bruyant ;
- avec une main si possible ;
- avec des erreurs de manipulation possibles.

---

## 3. Utilisateurs

## 3.1 Organisateur

Personne qui crée et gère la jam.

Il peut :

- créer une jam ;
- configurer les instruments disponibles ;
- ajouter des participants ;
- organiser les plateaux ;
- appeler les musiciens ;
- valider les passages joués ;
- gérer les absents, les musiciens partis, les liens entre musiciens et les trous volontaires.

## 3.2 Participant

Musicien présent à la jam.

En V0, il n'utilise pas directement l'application.

En V1, il pourra s'inscrire depuis son propre téléphone via QR code.

---

## 4. Périmètre V0

La V0 contient uniquement l'interface organisateur.

L'organisateur peut :

- créer une jam session ;
- modifier une jam existante ;
- configurer les instruments ;
- ajouter des participants ;
- assigner un ou plusieurs instruments à un participant ;
- gérer un tableau avec une colonne par instrument ;
- réordonner verticalement les musiciens dans chaque colonne ;
- créer des liens entre musiciens ou participations ;
- créer des trous volontaires ;
- indiquer qu'un musicien veut jouer sans certains instruments ;
- valider qu'un musicien a joué ;
- valider qu'un plateau entier a joué ;
- ouvrir un drawer d'appel des musiciens ;
- gérer un musicien non disponible au moment de l'appel ;
- marquer un musicien comme parti ;
- consulter les statistiques principales de la jam.

---

## 5. Périmètre V1 et plus

Les éléments suivants ne sont pas dans la V0.

### V1

- Authentification organisateur.
- Compte organisateur.
- Chaque organisateur voit uniquement ses propres jams.
- Inscription participant via QR code.
- Page participant dédiée.
- Choix, par le participant, de son nom et de son instrument.
- Choix éventuel des personnes avec qui il souhaite jouer.
- Options avancées d'alignement de liens :
  - remonter vers le plus avancé ;
  - descendre vers le plus en retard ;
  - trouver un juste milieu.

### Hors périmètre permanent

- Pas de drag and drop horizontal, ni en V0, ni en V1, ni plus tard.
- Le déplacement d'un participant d'un instrument à un autre se fait uniquement via édition, jamais par drag horizontal.

---

## 6. Accueil V0

En V0, l'application affiche toutes les jams du service.

L'organisateur peut :

- voir la liste des jams existantes ;
- ouvrir une jam ;
- créer une nouvelle jam.

En V1, cette vue sera remplacée ou filtrée par un compte organisateur.

---

## 7. Création et édition d'une jam

La création et l'édition d'une jam utilisent le même drawer.

En mode création, le drawer affiche les champs de configuration.

En mode édition, le drawer affiche les mêmes champs, avec en plus les informations de suivi de la jam.

## 7.1 Champs de configuration

Une jam contient :

- nom ;
- date indicative ;
- liste des instruments disponibles ;
- ordre d'affichage des instruments.

La date est uniquement informative. Elle ne bloque pas l'accès, ne déclenche pas de statut actif/terminé, et peut être modifiée à tout moment.

## 7.2 Instruments par défaut

Les instruments activés par défaut sont, dans cet ordre :

1. Chant
2. Guitare
3. Basse
4. Batterie
5. Piano
6. Autres

## 7.3 Instruments personnalisés

L'organisateur peut ajouter un instrument personnalisé en lui donnant un nom.

En V0, un instrument personnalisé est ajouté uniquement à la jam en cours.

Exemples :

- Saxophone
- Percussions
- Harmonica
- Violon

## 7.4 Réorganisation des instruments

L'organisateur peut réorganiser l'ordre des instruments.

Cet ordre détermine :

- l'ordre des colonnes dans le tableau ;
- l'ordre d'affichage dans les formulaires ;
- l'ordre d'affichage dans le drawer d'appel des musiciens.

## 7.5 Informations de suivi en édition

En mode édition, le drawer affiche aussi :

- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de musiciens n'ayant pas encore joué un instrument une première fois.

### Définition : musiciens n'ayant pas encore joué un instrument une première fois

Cette statistique compte les participations instrumentales qui n'ont jamais été passées à l'état `joué`.

Exemple :

- Nicolas joue batterie.
- Il joue une première fois.
- Même s'il peut rejouer ensuite en boucle, il n'est plus compté comme musicien n'ayant pas encore joué la batterie.

Si Nicolas est inscrit en chant et en guitare :

- s'il a joué chant mais pas guitare, il reste compté pour guitare ;
- la statistique concerne donc le couple `participant + instrument`.

---

## 8. Tableau principal de gestion

La jam est gérée depuis un tableau.

- Chaque colonne correspond à un instrument.
- Chaque ligne correspond à un plateau en préparation ou joué.
- Chaque case contient soit :
  - un participant ;
  - un trou volontaire.

Une ligne est considérée comme un plateau en préparation jusqu'au moment où les musiciens concernés sont validés comme ayant joué.

Quand les musiciens sont validés, leurs cases deviennent grisées.

---

## 9. Principe de base : ordre automatique par colonne

Chaque colonne fonctionne comme une file d'attente indépendante.

Quand un participant est ajouté à un instrument, il est placé à la suite du dernier participant réel de cette colonne, avant les répétitions de boucle.

Par défaut :

- il n'y a jamais de trou automatique ;
- les colonnes sont indépendantes ;
- les musiciens se placent les uns après les autres dans leur colonne ;
- les boucles complètent la suite quand tous les musiciens disponibles ont été affichés.

Exemple guitare :

```text
Nicolas
Paul
Emma
```

Si Julie est ajoutée en guitare :

```text
Nicolas
Paul
Emma
Julie
```

---

## 10. Drag and drop vertical

L'organisateur peut réordonner les participants verticalement dans une colonne.

Règles :

- drag vertical uniquement ;
- aucun drag horizontal ;
- le drag horizontal n'existera dans aucune version ;
- déplacer un participant dans une colonne décale automatiquement les autres participants de cette colonne ;
- les trous et liens doivent être pris en compte dans le recalcul.

Le changement d'instrument d'un participant se fait via la fiche d'édition du participant.

---

## 11. Boucles automatiques

Quand tous les participants disponibles d'une colonne ont été affichés, la colonne boucle automatiquement.

La boucle réaffiche les musiciens encore disponibles dans l'ordre de référence.

Exemple :

```text
1
2
3
4
5
1
2
3
4
5
1
2
3
4
5
```

Si un musicien 6 arrive avant que le musicien 1 ne rejoue, il est ajouté avant la boucle suivante :

```text
1
2
3
4
5
6
1
2
3
4
5
6
```

## 11.1 Ordre de référence

L'ordre de référence correspond à l'ordre naturel d'inscription dans la colonne.

Si l'organisateur modifie ponctuellement l'ordre visible de la première rotation, cela ne modifie pas forcément l'ordre de référence des boucles suivantes.

Exemple :

Ordre initial :

```text
1
2
3
4
5
```

L'organisateur réorganise ponctuellement :

```text
2
1
3
4
5
```

La boucle peut ensuite repartir sur l'ordre de référence :

```text
1
2
3
4
5
```

## 11.2 Quantité de boucle visible

L'interface doit afficher assez de lignes futures pour voir trois lignes pleines composées uniquement de musiciens ayant déjà bouclé.

Objectif : permettre à l'organisateur d'anticiper les prochains plateaux sans afficher une boucle infinie trop longue.

---

## 12. Participants

## 12.1 Création d'un participant

L'organisateur peut ajouter un participant depuis la page de gestion.

Champs :

- nom ;
- un ou plusieurs instruments ;
- précision texte si instrument = `Autres`.

## 12.2 Unicité du nom

Deux participants ne peuvent pas avoir exactement le même nom.

Si un nom existe déjà, l'application doit empêcher la création ou demander à modifier le nom.

Exemples :

- Nicolas
- Nicolas G.
- Nico batterie

## 12.3 Participant multi-instruments

Un participant peut être inscrit sur plusieurs instruments.

Exemple : Nicolas joue chant et guitare.

Dans ce cas :

- Nicolas apparaît dans la colonne Chant ;
- Nicolas apparaît dans la colonne Guitare ;
- les deux cases portent le même nom ;
- les deux participations peuvent être liées ou non.

Si elles ne sont pas liées, elles peuvent être appelées séparément.

## 12.4 Édition d'un participant

Chaque fiche participant propose une action d'édition.

L'édition permet de modifier :

- nom ;
- instruments ;
- précision de l'instrument si `Autres` ;
- liens entre ses propres instruments.

---

## 13. Section “faire passer en même temps”

Quand un participant possède plusieurs instruments, la modale de création/édition affiche une section :

> Faire passer en même temps ?

Cette section liste les liens possibles entre ses instruments.

Exemple : Nicolas a chant, guitare et batterie.

Options affichées :

- Chant + Guitare
- Chant + Batterie
- Guitare + Batterie

Chaque option peut être cochée.

Si deux liens se rejoignent par transitivité, l'application doit traiter l'ensemble comme un même groupe.

Exemple :

- Chant + Guitare coché ;
- Guitare + Batterie coché ;
- alors Chant + Guitare + Batterie forment un même groupe lié.

L'interface doit afficher clairement les liens créés.

---

## 14. Colonne “Autres”

La colonne `Autres` est une colonne fourre-tout.

Quand elle est sélectionnée pour un participant, un champ libre permet de préciser l'instrument réel.

Exemples :

- Léa — Saxophone
- Marc — Trompette
- Sofiane — Violon

Le champ libre sert uniquement à l'affichage dans la case.

Si un instrument devient suffisamment structurant pour la jam, l'organisateur peut créer une vraie colonne dédiée via les instruments personnalisés.

---

## 15. Actions dans une case participant

Chaque case participant peut proposer des actions.

Actions principales :

- check `a joué` quand le participant est prochain à jouer ;
- menu `...` pour les actions secondaires ;
- link ;
- édition ;
- marquer comme parti ;
- veux jouer sans.

Sur mobile, il faut éviter d'afficher trop d'icônes en permanence.

La proposition actuelle :

- actions principales visibles selon contexte ;
- actions secondaires dans le menu `...`.

---

## 16. Check “a joué”

Le bouton check indique qu'un participant a joué son instrument.

Il n'est pas visible pour tout le monde.

Il est visible uniquement pour les prochains musiciens qui vont jouer dans chaque colonne.

Quand un participant est validé comme ayant joué :

- sa case devient grisée ;
- son passage est figé dans l'historique ;
- il est considéré comme ayant joué cet instrument au moins une fois ;
- il n'est plus compté dans les musiciens n'ayant pas encore joué cet instrument une première fois.

## 16.1 Annuler “a joué”

L'annulation est prévue uniquement en cas d'erreur.

Une action explicite sur une case jouée ouvre une confirmation :

> Annuler le passage de ce musicien ?

Si confirmé :

- le participant redevient non joué sur ce passage ;
- il garde sa position ;
- le recalcul futur se fait en conséquence.

Si le participant faisait partie d'une ligne entièrement jouée, l'application peut demander s'il faut annuler :

- uniquement ce participant ;
- ou tout le plateau.

---

## 17. Actions directes de plateau

Il n'y a pas de ligne sélectionnée en V0.

Chaque ligne du tableau affiche directement deux actions dans la colonne fixe de gauche :

1. ouvrir le drawer d'appel ;
2. marquer le plateau comme joué.

## 17.1 Ouvrir le drawer d'appel

Cette action ouvre le drawer d'appel des musiciens pour la ligne concernée.

Le drawer permet :

- de voir les musiciens du plateau en grand ;
- de marquer un musicien comme ayant joué ;
- de marquer tout le plateau comme joué ;
- d'indiquer qu'un musicien n'est pas disponible ;
- de choisir un remplaçant ;
- d'ajouter une case vide volontaire sur la ligne si l'organisateur veut faire jouer le plateau sans un instrument.

## 17.2 Marquer le plateau comme joué

Cette action peut être faite :

- depuis le bouton direct de la ligne dans la colonne gauche ;
- depuis le drawer d'appel des musiciens.

Le bouton utilise la même icône que le bouton `a joué` d'un musicien.

Quand le plateau est marqué comme joué :

- tous les musiciens du plateau passent à l'état `joué` ;
- les trous volontaires du plateau sont conservés dans l'historique ;
- les cases deviennent grisées ;
- la ligne reste à sa place.

Important :

- les lignes jouées ne remontent pas automatiquement ;
- on ne modifie pas l'ordre des lignes pour regrouper les lignes jouées ;
- cela simplifie la logique et évite des mouvements inattendus.

---

## 18. Lignes incomplètes et colonnes vides volontaires

Par défaut, l'application évite les trous.

Cependant, l'organisateur doit pouvoir faire jouer un plateau sans musicien sur un instrument donné.

Il existe donc deux types de trous volontaires :

1. trou lié, créé via `Veux jouer sans` ;
2. trou manuel non lié, créé pour une ligne précise.

## 18.1 Trou manuel non lié

Un trou manuel non lié sert à faire jouer une ligne sans musicien sur un instrument, sans rattacher ce choix à un participant précis.

Cas d'usage :

- le plateau part sans bassiste ;
- aucun pianiste n'est disponible pour cette ligne ;
- l'organisateur veut valider le plateau sans attendre un remplaçant.

## 18.2 Ajout d'un trou manuel

En V0, l'ajout d'un trou manuel se fait depuis le drawer d'appel.

Dans le drawer, chaque instrument de la ligne peut proposer une action :

> Jouer sans cet instrument

Effet :

- une case `Sans <instrument>` est créée sur cette ligne ;
- aucun musicien n'est affecté à cette case ;
- le prochain musicien de cette colonne est repoussé à la ligne suivante disponible ;
- la colonne se recalcule automatiquement ;
- le trou ne fait pas partie des boucles.

Cette action peut aussi être disponible plus tard depuis le menu d'une colonne ou d'une case, mais le drawer d'appel est le point d'entrée V0 recommandé, car il correspond au moment où l'organisateur constate que le plateau va jouer sans cet instrument.

## 18.3 Suppression d'un trou manuel

Un trou manuel non joué peut être supprimé via son menu `...`.

Si le plateau est déjà joué, le trou reste dans l'historique et n'est plus supprimable sans annuler le passage du plateau ou de la case concernée.

---

## 19. Trous volontaires

Un trou volontaire représente l'absence assumée de musicien dans une colonne sur une ligne donnée.

Un trou peut être :

- créé explicitement ;
- lié à un participant ou à un groupe ;
- conservé dans l'historique si le plateau a joué ;
- supprimé avant passage.

Un trou ne fait jamais partie des boucles.

## 19.1 Trou lié

Un trou lié suit le participant ou le groupe auquel il est lié.

Cas d'usage :

- Nicolas joue guitare/voix ;
- il veut jouer sans batterie ;
- l'organisateur crée un trou dans la colonne Batterie lié à Nicolas ;
- si Nicolas est déplacé, le trou Batterie suit.

Un trou lié :

- suit le groupe verticalement ;
- empêche qu'un musicien soit proposé automatiquement sur cette ligne pour cet instrument ;
- est validé avec le plateau quand le plateau est marqué joué ;
- peut être délié ou supprimé avant passage.

---

## 20. Feature “veux jouer sans”

La feature s'appelle :

> Veux jouer sans

Elle permet de créer rapidement un ou plusieurs trous liés à un participant ou à un groupe.

## 20.1 Accès

L'action est accessible depuis le menu `...` d'une case participant dans une colonne.

Exemple :

- dans la colonne Chant ;
- l'organisateur ouvre le menu `...` de Guillaume ;
- il clique sur `Veux jouer sans` ;
- l'application affiche les autres instruments disponibles ;
- l'organisateur coche un ou plusieurs instruments.

## 20.2 Effet

Pour chaque instrument coché :

- l'application crée un trou dans la colonne correspondante ;
- ce trou est lié au participant ou au groupe du participant ;
- le trou suit le participant ou le groupe en cas de déplacement.

Exemple :

- Guillaume joue chant ;
- il veut jouer sans batterie et sans basse ;
- l'organisateur coche Batterie et Basse ;
- l'application crée un trou Batterie et un trou Basse sur la ligne de Guillaume.

---

## 21. Link entre musiciens

L'organisateur peut lier plusieurs participants pour qu'ils jouent ensemble sur la même ligne.

Un groupe lié peut contenir :

- plusieurs participants différents ;
- plusieurs instruments d'un même participant ;
- des trous volontaires.

Règles :

- maximum un élément par instrument dans un groupe lié ;
- les éléments liés se déplacent ensemble ;
- les trous liés suivent le groupe ;
- les liens peuvent être modifiés ou supprimés.

## 21.1 Création d'un link manuel

Process :

1. L'organisateur clique sur le bouton link d'un participant.
2. Le tableau passe en mode link.
3. Le participant sélectionné est mis en avant.
4. Les participants déjà liés sont aussi mis en avant.
5. L'organisateur sélectionne d'autres participants dans d'autres colonnes.
6. Il valide avec un bouton en bas.
7. Les participants sélectionnés sont alignés sur la même ligne.

## 21.2 Délier

Le même mode sert à lier et délier.

Si l'organisateur clique sur le bouton link d'un participant déjà lié :

- le mode link s'ouvre ;
- les membres du groupe sont mis en avant ;
- l'organisateur peut retirer un membre du groupe ;
- il valide les modifications.

## 21.3 Alignement V0

En V0, quand plusieurs participants sont liés, l'application aligne le groupe sur le participant le plus avancé, c'est-à-dire le plus haut dans le tableau.

Les participants les plus en retard remontent.

Exemple :

- Nicolas, guitare, ligne 3 ;
- Jérémy, batterie, ligne 5.

Si on les lie :

- Jérémy remonte ligne 3 ;
- les batteurs qui étaient ligne 3 et ligne 4 sont poussés vers le bas ;
- aucun trou n'est créé.

## 21.4 Déplacement d'un groupe lié

Si un participant lié est déplacé verticalement, tout son groupe lié change de ligne avec lui.

Les participants des colonnes concernées sont poussés automatiquement.

---

## 22. Suppression de la feature lock/unlock

La feature lock/unlock est supprimée.

Il n'y a donc pas de cadenas.

Les musiciens peuvent être déplacés par les règles de réorganisation automatique, sauf s'ils ont déjà joué et sont donc figés dans l'historique.

---

## 23. Drawer d'appel des musiciens

L'organisateur peut ouvrir un drawer d'appel depuis une ligne / un plateau.

Objectif : afficher clairement les musiciens à appeler sur scène.

Le drawer affiche en grand :

```text
Chant — Sarah
Guitare — Nicolas
Basse — Tom
Batterie — Jérémy
Piano — Clara
Autres — Léa, saxophone
```

## 23.1 Actions disponibles

Depuis ce drawer, l'organisateur peut :

- marquer un musicien comme ayant joué ;
- marquer tout le plateau comme joué ;
- indiquer qu'un musicien n'est pas disponible ;
- choisir un remplaçant.

---

## 24. “N'est pas disponible”

Cette action sert uniquement à trouver un remplaçant rapidement au moment de l'appel.

Elle ne crée pas d'état durable `indisponible`.

## 24.1 Principe

Si un musicien ne vient pas quand il est appelé :

- l'organisateur clique sur `N'est pas disponible` ;
- l'application affiche les prochains musiciens de la même colonne ;
- l'application indique pour chacun s'il est lié à d'autres musiciens ;
- l'organisateur choisit un remplaçant.

Les musiciens marqués comme partis ne sont pas proposés.

## 24.2 Remplacement

Quand un remplaçant est choisi :

- le remplaçant prend la place du musicien absent ;
- le musicien absent est déplacé à la prochaine ligne suivante disponible ;
- la colonne est réorganisée automatiquement ;
- aucun statut durable `indisponible` n'est enregistré.

## 24.3 Si le musicien absent est lié

Si le musicien absent est lié à d'autres musiciens :

- l'application demande confirmation ;
- si confirmé, elle le délie ;
- elle le déplace ensuite comme un musicien non lié.

## 24.4 Si le remplaçant est lié

Si le remplaçant proposé est lié à d'autres musiciens :

- l'application demande confirmation ;
- si confirmé, elle le délie ;
- elle le déplace ensuite comme un musicien non lié.

En V0, le délink est définitif.

---

## 25. Marquer comme parti

L'organisateur peut marquer un participant comme parti.

Effet :

- le participant reste visible dans les passages déjà joués ;
- il est retiré de tous les passages futurs ;
- il est supprimé des boucles futures ;
- tous ses instruments sont concernés ;
- ses liens futurs avec d'autres musiciens sont supprimés ;
- les autres musiciens liés restent actifs.

Le wording retenu est :

> Marquer comme parti

---

## 26. États métier

## 26.1 État participant

Un participant peut être :

- actif ;
- parti.

## 26.2 État passage / case

Une case peut être :

- à venir ;
- jouée ;
- trou volontaire.

États supprimés :

- locké ;
- indisponible temporairement.

---

## 27. Historique

L'application conserve l'historique minimal des passages joués.

L'historique sert à :

- savoir quels musiciens ont déjà joué ;
- compter les plateaux joués ;
- ne pas perdre les passages déjà effectués lorsqu'un musicien part ;
- permettre l'annulation en cas d'erreur ;
- calculer les musiciens qui n'ont pas encore joué leur instrument une première fois.

---

## 28. Persistance et offline

Pendant une jam, la source de vérité principale est le stockage local de l'appareil.

À chaque action, l'application tente aussi une persistance backend.

Si la persistance backend échoue :

- l'action reste conservée localement ;
- l'application considère le local comme source de vérité ;
- elle réessaie régulièrement de synchroniser avec le backend.

## 28.1 Multi-appareil V0

En V0, l'usage multi-appareil concurrent est bloqué.

Une jam ne doit pas être modifiée simultanément depuis plusieurs appareils.

Objectif : éviter les conflits pendant une soirée live.

---

## 29. Données principales

## 29.1 Jam

- id
- nom
- date indicative
- instruments
- ordre des instruments
- participants
- passages joués
- métadonnées de synchronisation

## 29.2 Instrument

- id
- nom
- ordre
- type : défaut / personnalisé

## 29.3 Participant

- id
- nom unique dans la jam
- état : actif / parti
- participations instrumentales

## 29.4 Participation instrumentale

- id
- participant_id
- instrument_id
- précision texte optionnelle, notamment pour `Autres`
- ordre de référence dans la colonne

## 29.5 Case / occurrence de tableau

- id
- instrument_id
- participant_id optionnel
- type : participant / trou
- état : à venir / jouée
- ligne affichée
- groupe_link_id optionnel

## 29.6 Groupe lié

- id
- membres
- peut contenir :
  - participations instrumentales ;
  - trous volontaires.

---

## 30. Règles importantes à respecter

1. Une colonne correspond à un instrument.
2. Les colonnes sont indépendantes par défaut.
3. Une ligne représente un plateau en préparation ou joué.
4. Par défaut, il n'y a pas de trou automatique.
5. Les trous doivent être créés volontairement.
6. Les trous ne font pas partie des boucles.
7. Le drag est uniquement vertical.
8. Le drag horizontal n'existe pas et n'existera pas.
9. Le check `a joué` est visible uniquement pour les prochains musiciens qui vont jouer.
10. Un participant ayant joué un instrument une fois n'est plus compté comme n'ayant pas joué cet instrument.
11. Un musicien parti reste dans l'historique, mais disparaît du futur.
12. Les liens alignent les musiciens sur la même ligne.
13. En V0, les liens font remonter les plus en retard vers le plus avancé.
14. `N'est pas disponible` sert uniquement au remplacement rapide, sans statut durable.
15. Le local est source de vérité pendant la jam en cas de perte réseau.
16. En V0, il n'y a pas d'authentification organisateur.
17. En V1, les jams seront rattachées à un compte organisateur.

---

## 31. Décisions complémentaires appliquées

Les points qui restaient ouverts sont tranchés avec les recommandations retenues par défaut.

## 31.1 Ajout manuel d'une case vide sans link

Décision V0 : l'ajout se fait depuis le drawer d'appel.

Process :

1. l'organisateur ouvre le drawer d'appel d'un plateau ;
2. il choisit l'instrument à laisser vide ;
3. il clique sur `Jouer sans cet instrument` ;
4. l'application crée une case `Sans <instrument>` sur la ligne ;
5. le musicien qui aurait dû occuper cette place est déplacé à la prochaine ligne suivante disponible ;
6. la colonne se recalcule sans créer de trou automatique supplémentaire.

Règles :

- le trou manuel ne fait pas partie des boucles ;
- il n'est pas lié à un participant ;
- il peut être supprimé tant que la ligne n'est pas jouée ;
- il est conservé dans l'historique si le plateau est joué.

## 31.2 Suppression d'un trou

Un trou non joué peut être supprimé depuis son menu `...`.

Effet :

- le trou disparaît ;
- la colonne concernée se recalcule ;
- les musiciens suivants remontent pour combler la place ;
- si le trou était lié, il est d'abord retiré de son groupe lié.

Un trou déjà joué n'est pas supprimable directement. Pour le retirer de l'historique, il faut annuler le passage concerné.

## 31.3 Annulation d'un plateau joué

Quand une case jouée est annulée, l'application propose :

- annuler seulement ce musicien / cette case ;
- annuler tout le plateau.

Si l'organisateur annule seulement une case :

- la case garde sa position ;
- elle redevient `à venir` ;
- le reste du plateau reste joué.

Si l'organisateur annule tout le plateau :

- toutes les cases de la ligne redeviennent `à venir` ;
- les trous de la ligne redeviennent modifiables ;
- le calcul des passages futurs est mis à jour.

## 31.4 Synchronisation backend

Décision V0 : le local est source de vérité pendant la jam.

Chaque action utilisateur est enregistrée dans une file locale d'actions.

Pour chaque action :

1. l'action est appliquée immédiatement localement ;
2. l'interface se met à jour immédiatement ;
3. l'application tente de persister l'action côté backend ;
4. si l'appel backend échoue, l'action reste dans une file de retry ;
5. l'application retente régulièrement la synchronisation.

Affichage recommandé :

- aucune alerte bloquante pendant la jam ;
- petit indicateur discret si des actions restent à synchroniser ;
- message clair si l'utilisateur tente de quitter avec des actions non synchronisées.

## 31.5 Conflit multi-appareil

En V0, l'usage multi-appareil concurrent est bloqué.

Une jam ne doit être modifiable que depuis un seul appareil à la fois.

Si une jam est déjà ouverte en mode édition sur un appareil, un second appareil doit être empêché de la modifier ou placé en lecture seule.

## 31.6 Authentification

En V0, il n'y a pas d'authentification organisateur.

L'accueil affiche toutes les jams du service.

En V1 :

- l'organisateur peut créer un compte ;
- les jams sont rattachées à son compte ;
- l'organisateur voit uniquement ses propres jams.

## 31.7 QR code V1

À détailler dans une spec V1 séparée.

Intentions connues :

- inscription participant via QR code ;
- page participant dédiée ;
- saisie du nom ;
- choix de l'instrument parmi ceux configurés par l'organisateur ;
- possibilité de choisir avec qui le participant souhaite jouer.

---

## 32. Synthèse V0

La V0 est une interface organisateur mobile/tablette qui permet de gérer une jam via un tableau par instruments.

Les règles centrales sont :

- une colonne = un instrument ;
- une ligne = un plateau ;
- les colonnes avancent indépendamment ;
- les musiciens sont ajoutés à la suite de leur colonne ;
- les boucles réaffichent les musiciens disponibles après leur première rotation ;
- le check `a joué` est visible seulement pour les prochains musiciens jouables ;
- le plateau peut être marqué joué depuis le tableau ou le drawer d'appel ;
- les liens permettent de faire passer plusieurs cases sur la même ligne ;
- `Veux jouer sans` crée des trous liés ;
- le drawer d'appel permet aussi de créer un trou manuel non lié ;
- `N'est pas disponible` sert à trouver un remplaçant sans créer d'état durable ;
- `Marquer comme parti` retire le musicien des passages futurs ;
- les passages joués restent dans l'historique ;
- le local est source de vérité pendant la jam ;
- l'usage multi-appareil concurrent est bloqué en V0.
