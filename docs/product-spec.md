# Spec produit — Gestion de jam session pour organisateurs

## 1. Vision produit

Le produit est une application mobile/tablette destinée aux organisateurs de jam sessions dans des bars.

L'objectif est de remplacer la liste papier ou les notes improvisées par un outil simple permettant :

- d'inscrire les musiciens rapidement ;
- de gérer l'ordre de passage par instrument ;
- de former des plateaux cohérents ;
- de suivre qui a déjà joué ;
- de gérer les cas réels d'une jam : musiciens partis, musiciens absents au moment de l'appel, formations réduites, musiciens qui veulent jouer ensemble, musiciens multi-instruments.

Le produit doit rester utilisable pendant une soirée bruyante, rapide, avec peu de disponibilité mentale pour l'organisateur.

---

## 2. Plateformes

### V0

- Interface mobile-first.
- Compatible tablette en responsive.
- Même logique UX sur mobile et tablette.
- Pas d'interface desktop dédiée.

### Responsive tablette

La tablette utilise les mêmes écrans et les mêmes actions, mais avec plus d'espace :

- colonnes plus larges ;
- drawers plus confortables ;
- tableau horizontalement moins compressé.

---

## 3. Authentification et accès

### V0

- Pas d'authentification organisateur.
- L'écran d'accueil affiche toutes les jams du service.
- Les jams sont triées par date indicative.
- Un bouton permet de créer une nouvelle jam.

### V1

- L'organisateur peut créer un compte.
- Une fois connecté, il voit uniquement ses jams.
- L'inscription participant par QR code est prévue en V1, pas en V0.

---

## 4. Écran liste des jams

### Objectif

Permettre à l'organisateur d'ouvrir une jam existante ou d'en créer une nouvelle.

### Contenu

Chaque jam affiche :

- nom ;
- date indicative ;
- nombre de musiciens uniques ;
- nombre de plateaux joués ;
- date de dernière modification en information secondaire si utile.

### Tri

Les jams sont triées par date indicative.

### Empty state

Si aucune jam n'existe :

> Aucune jam créée pour l'instant.

Action principale :

> Créer une jam

---

## 5. Création / édition d'une jam

Le drawer de création et le drawer d'édition sont le même écran.

En mode édition, on affiche en plus les informations de suivi.

### Champs communs création / édition

- nom de la jam ;
- date indicative ;
- instruments disponibles ;
- ordre des instruments ;
- ajout d'un instrument personnalisé.

### Instruments activés par défaut

Ordre par défaut :

1. chant
2. guitare
3. basse
4. batterie
5. piano
6. autres

### Ajout d'un instrument personnalisé

L'organisateur peut ajouter un instrument en lui donnant un nom libre.

Un instrument ajouté est disponible uniquement dans la jam en cours.

### Réorganisation des instruments

L'organisateur peut réordonner les instruments.

Cet ordre pilote :

- l'ordre des colonnes dans le tableau ;
- l'ordre des instruments dans le drawer participant ;
- l'ordre d'affichage dans le drawer d'appel.

### Informations de suivi affichées en édition

- nombre de musiciens uniques ;
- nombre de participations instrumentales ;
- nombre de plateaux joués ;
- nombre de musiciens n'ayant pas encore joué au moins un de leurs instruments.

Définition : un musicien est compté comme n'ayant pas encore joué un instrument si au moins une de ses participations instrumentales actives n'a jamais été passée en `joué`.

Exemple :

- Nicolas a joué batterie une fois : il est considéré comme ayant joué la batterie.
- S'il rejoue ensuite en boucle, cela ne le remet pas dans les musiciens n'ayant pas joué.
- Si Nicolas a aussi chant et n'a jamais joué chant, il reste compté pour chant.

---

## 6. Structure du tableau

La jam se gère via un tableau.

- Chaque colonne correspond à un instrument.
- Chaque ligne correspond à un plateau potentiel.
- Chaque cellule contient une carte musicien, une carte trou volontaire, ou une cellule d'insertion entre deux cartes.
- Les colonnes sont indépendantes par défaut.
- Il n'y a jamais de drag and drop horizontal, ni en V0 ni plus tard.
- Le drag and drop est uniquement vertical dans une colonne.

### Colonne gauche d'actions de plateau

Chaque ligne contient à gauche deux boutons directs :

1. ouvrir le drawer d'appel ;
2. marquer le plateau joué.

Il n'existe pas d'état “ligne sélectionnée” en V0.

Les actions de ligne agissent directement sur la ligne concernée.

---

## 7. Principe de base : réorder automatique par colonne

Chaque colonne est une file d'attente indépendante.

Quand un participant est ajouté à un instrument, il est placé à la suite du dernier musicien de cette colonne, avant les répétitions de boucle.

Exemple guitare :

```text
Nicolas
Paul
Emma
```

Si Julie est ajoutée :

```text
Nicolas
Paul
Emma
Julie
```

### Aucune cellule vide par défaut

Par défaut, le système comble toujours les colonnes.

Les trous n'existent que s'ils sont ajoutés explicitement par l'organisateur.

---

## 8. Boucles automatiques

Quand on arrive à la fin des musiciens disponibles d'une colonne, l'app réaffiche les musiciens dans leur ordre d'arrivée de référence.

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

Si un musicien 6 arrive avant que le musicien 1 rejoue, il est ajouté avant la boucle suivante :

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

### Affichage des boucles

L'app affiche toujours assez de lignes futures pour voir trois lignes pleines composées uniquement de musiciens ayant déjà bouclé.

### Ordre de boucle

Les boucles se basent sur l'ordre d'arrivée de référence, pas forcément sur les déplacements manuels ponctuels de la première rotation.

---

## 9. Participants

### Création d'un participant

L'organisateur peut ajouter un participant depuis le drawer participant.

Champs :

- nom ;
- un ou plusieurs instruments ;
- détail libre si instrument = autres ;
- section “faire passer en même temps” si plusieurs instruments sont sélectionnés.

### Nom unique obligatoire

Deux musiciens ne peuvent pas avoir exactement le même nom dans une jam.

Si le nom existe déjà, l'app affiche une erreur et empêche la validation.

### Instrument “autres”

La colonne “autres” est une colonne fourre-tout.

Quand “autres” est sélectionné, un champ libre permet d'indiquer l'instrument réel.

Exemple :

```text
Léa — saxophone
Marc — trompette
```

### Édition d'un participant

Chaque carte participant donne accès à l'édition via le menu `⋯`.

L'édition permet de modifier :

- nom ;
- instruments ;
- détail de l'instrument “autres” ;
- liens entre instruments du même participant.

Si un participant déjà joué est modifié, l'historique joué reste conservé.

---

## 10. Participant multi-instruments

Un participant peut avoir plusieurs instruments.

Exemple : Nicolas fait chant + guitare.

Il apparaît dans plusieurs colonnes, avec le même nom.

```text
Chant      Guitare
Nicolas    Nicolas
```

### Faire passer en même temps

Dans le drawer création/édition participant, si plusieurs instruments sont sélectionnés, une section apparaît :

> Faire passer en même temps ?

Elle affiche les paires possibles entre instruments.

Exemple pour chant + guitare + batterie :

- chant + guitare ;
- chant + batterie ;
- guitare + batterie.

Les liens sont traités par paires.

Si plusieurs liens créent un groupe par transitivité, l'app affiche un aperçu du groupe final.

Exemple :

- chant + guitare coché ;
- guitare + batterie coché ;
- résultat : chant + guitare + batterie passent ensemble.

---

## 11. Links entre musiciens

L'organisateur peut lier plusieurs cartes pour les faire passer ensemble sur la même ligne.

Un groupe lié peut contenir :

- plusieurs instruments du même participant ;
- plusieurs participants différents ;
- un ou plusieurs trous volontaires ;
- maximum une carte par instrument.

### Création / modification d'un link

Process :

1. l'organisateur clique sur l'icône link d'une carte ;
2. le tableau passe en mode link ;
3. la carte source est mise en avant ;
4. les cartes déjà liées sont mises en avant ;
5. l'organisateur sélectionne ou désélectionne les cartes à lier ;
6. il valide avec un bouton sticky en bas ;
7. les cartes liées sont alignées.

Le même mode sert à lier et délier.

### Alignement V0

En V0, les cartes liées s'alignent en remontant les cartes les plus en retard vers la carte la plus avancée.

Exemple :

- Nicolas guitare ligne 3 ;
- Jérémy batterie ligne 5.

Après link :

- Jérémy remonte ligne 3 ;
- les batteurs précédemment en lignes 3 et 4 sont poussés vers le bas ;
- aucun trou n'est créé.

### Alignement V1

En V1, l'organisateur pourra choisir la stratégie :

- remonter vers le plus avancé ;
- descendre vers le plus en retard ;
- choisir manuellement une ligne cible.

---

## 12. Drag and drop vertical

Le drag and drop est uniquement vertical dans une colonne.

Il n'y a pas d'affordance visible dédiée.

Interaction :

- long press sur une carte ;
- drag vertical dans la colonne ;
- relâcher pour repositionner.

Pendant le drag :

- les autres cartes non jouées se décalent ;
- les cartes jouées ne bougent pas ;
- les groupes liés se déplacent ensemble ;
- les colonnes concernées poussent les autres cartes ;
- les actions impossibles sont refusées avec un message clair.

---

## 13. Check “a joué”

Le bouton check permet de marquer une carte comme jouée.

Il est visible uniquement sur les prochains musiciens jouables de chaque colonne.

Quand une carte passe en joué :

- elle devient grisée ;
- elle est figée ;
- elle n'est plus draggable ;
- elle devient historique ;
- elle ne bouge plus lors des recalculs.

### Annulation

Sur une carte jouée, l'organisateur peut ouvrir le menu et choisir :

> Annuler le passage

Une confirmation est affichée.

Si confirmé :

- la carte redevient non jouée ;
- elle garde sa position ;
- elle redevient déplaçable si applicable.

Si le passage faisait partie d'un plateau entièrement joué, l'app demande :

- annuler seulement ce musicien ;
- annuler tout le plateau.

---

## 14. Plateau joué

Chaque ligne a un bouton direct “plateau joué” dans la colonne gauche.

Le même bouton est disponible dans le drawer d'appel.

Effet :

- toutes les cartes musicien de la ligne passent en joué ;
- les trous volontaires de la ligne passent en historique ;
- la ligne ne remonte pas ;
- la position de la ligne reste stable ;
- les futures lignes sont recalculées si nécessaire.

Il n'y a pas de logique de remontée des lignes jouées.

---

## 15. Drawer d'appel

Le drawer d'appel sert à appeler clairement les musiciens du plateau.

Il est accessible via le bouton d'appel dans la colonne gauche de chaque ligne.

### Format

- full screen sur mobile ;
- drawer large sur tablette ;
- ordre des instruments identique au tableau ;
- bouton “plateau joué” sticky en bas.

### Contenu

Pour chaque instrument :

```text
Chant
Sarah

Guitare
Nicolas

Basse
Tom

Batterie
Jérémy
```

Pour un trou :

```text
Batterie
Sans batterie
```

Pour “autres” :

```text
Autre
Léa — saxophone
```

### Actions par musicien

- “A joué” ;
- “N'est pas disponible”.

### Action globale

- “Plateau joué”.

Après “Plateau joué”, le drawer se ferme automatiquement.

---

## 16. N'est pas disponible

Depuis le drawer d'appel, l'organisateur peut indiquer qu'un musicien n'est pas disponible.

Cette action ne crée pas de statut durable.

Elle sert uniquement à choisir rapidement un remplaçant.

### Remplaçants proposés

L'app affiche les prochains musiciens de la même colonne.

Chaque remplaçant affiche :

- nom ;
- s'il est lié ou non ;
- avec qui il est lié ;
- s'il rejoue déjà en boucle.

Les musiciens marqués comme partis sont exclus.

### Choix d'un remplaçant non lié

- le remplaçant prend la place du musicien indisponible ;
- le musicien indisponible est déplacé à la prochaine ligne suivante disponible.

### Si le musicien indisponible est lié

L'app demande confirmation.

Si confirmé :

- le musicien est délié ;
- il est déplacé seul à la prochaine ligne suivante disponible.

### Si le remplaçant est lié

L'app demande confirmation.

Si confirmé :

- le remplaçant est délié ;
- il prend la place ;
- le musicien indisponible est déplacé à la prochaine ligne suivante disponible.

Le délink est définitif en V0.

---

## 17. Trous volontaires

Un trou volontaire représente l'absence volontaire de musicien sur un instrument pour une ligne donnée.

Exemple : Nicolas veut jouer guitare-voix sans batterie.

Dans ce cas, la colonne batterie affiche :

```text
Sans batterie
```

### Propriétés

- Un trou ne fait pas partie des boucles.
- Un trou peut être linké avec un musicien ou un groupe.
- Un trou linké suit le groupe lié.
- Un trou peut être validé comme partie du plateau joué.
- Un trou joué reste dans l'historique.
- Un trou peut être supprimé tant que la ligne n'est pas jouée.

### Ajouter un trou via “veux jouer sans”

Depuis le menu `⋯` d'une carte participant :

1. l'organisateur clique sur “Veux jouer sans…” ;
2. un drawer affiche les autres instruments disponibles ;
3. il peut cocher un ou plusieurs instruments ;
4. à la validation, l'app crée un trou dans chaque colonne choisie ;
5. les trous sont linkés au participant ou au groupe du participant.

### Ajouter un trou entre deux cartes

Quand l'organisateur clique entre deux cartes dans une colonne, une modale s'ouvre avec deux choix :

- ajouter un trou ;
- ajouter un participant.

Si l'organisateur choisit “ajouter un trou” :

- un trou est ajouté à cet endroit dans la colonne ;
- les cartes suivantes sont poussées vers le bas ;
- le trou n'est pas linké par défaut.

Si l'organisateur choisit “ajouter un participant” :

- le drawer d'ajout participant s'ouvre ;
- l'instrument de la colonne est précoché ;
- après validation, le participant est inséré à cet endroit.

---

## 18. Marquer comme parti

Un participant peut être marqué comme parti depuis le menu `⋯`.

Effet :

- le participant est retiré des futurs passages ;
- ses passages déjà joués restent visibles dans l'historique ;
- ses liens futurs sont supprimés ;
- s'il a plusieurs instruments, toutes ses participations futures sont retirées ;
- il reste comptabilisé dans les musiciens uniques de la jam.

Wording retenu :

> Marquer comme parti

---

## 19. États métier

### Participant

- actif ;
- parti.

### Passage / carte

- à venir ;
- joué ;
- trou volontaire.

États explicitement supprimés :

- locké ;
- indisponible temporairement ;
- appelé / sur scène.

---

## 20. Synchronisation et offline

Pendant la jam :

- chaque action est sauvegardée localement ;
- chaque action déclenche aussi une persistance backend ;
- si la persistance backend échoue, le stockage local reste source de vérité ;
- l'app retente régulièrement la synchronisation backend.

### Multi-appareil V0

En V0, l'usage multi-appareil sur une même jam active est bloqué.

L'objectif est d'éviter les conflits pendant une jam live.

### États UI de sync

Un indicateur discret affiche :

- synchronisé ;
- sauvegarde locale ;
- synchronisation en attente ;
- hors ligne.

Aucun gros blocage ne doit gêner l'organisateur pendant la jam, sauf conflit d'ouverture multi-appareil.

---

## 21. V1 — QR code participant

En V1, l'organisateur peut permettre aux participants de s'inscrire depuis leur propre téléphone.

Principe :

- l'organisateur génère un QR code ;
- le participant le scanne ;
- il arrive sur une page d'inscription ;
- il renseigne son nom ;
- il choisit son ou ses instruments parmi ceux de la jam ;
- il peut choisir avec qui il souhaite jouer parmi les participants déjà inscrits.

À préciser plus tard :

- QR code unique par jam ou par participant ;
- validation organisateur nécessaire ou non ;
- édition par le participant ;
- gestion des doublons de nom côté participant.


---

## Blocage d'édition simultanée V0

En V0, une même jam ne doit pas être éditée simultanément depuis deux appareils ou deux sessions, afin d'éviter toute résolution de conflit complexe.

Comportement attendu :

- à l'ouverture du tableau d'une jam, l'app tente de prendre un verrou d'édition ;
- si le verrou est accordé, l'organisateur peut éditer normalement ;
- si le verrou est déjà détenu par une autre session, l'écran est bloquant et affiche : “Cette jam est déjà ouverte en édition sur un autre appareil.” puis “Réessaie plus tard.” ;
- à la sortie de la page, l'app tente de libérer le verrou ;
- si une session disparaît sans libérer le verrou, le backend peut l'expirer automatiquement après un délai V0 raisonnable.

Cette V0 n'ajoute pas de temps réel et ne résout pas les conflits multi-appareils.

## Rounds de participation

Un round est le n-ième passage d'une participation précise, pas un tour global de jam. Exemple : Nicolas/Guitare/round 1 et Nicolas/Guitare/round 2 sont deux occurrences distinctes. Les liens, trous volontaires et statuts joués s'appliquent à l'occurrence (`RoundSlot`) et ne se propagent pas automatiquement aux rounds suivants.
