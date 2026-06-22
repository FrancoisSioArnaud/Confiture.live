# Confiture.live — Spécification V0 des actions, events et conséquences sur les listes

## Objectif

Cette spécification cadre la refonte de l’algorithme de listes de Confiture.live autour d’une logique **event-sourcing**.

La source de vérité n’est pas l’état visuel courant du tableau. La source de vérité est une suite ordonnée d’events :

```txt
eventLog = suite ordonnée de JamEvent
```

À partir de cet `eventLog`, le client et le serveur doivent pouvoir reconstruire de manière déterministe :

- les participants ;
- leurs participations par instrument ;
- les appearances calculées ou matérialisées ;
- les holes ;
- les links ;
- les conflicts ;
- les locks ;
- les rounds visibles ;
- les plateaux joués ;
- l’ordre passé, présent et futur des passages ;
- les undo ;
- les snapshots éventuels.

Objectifs :

- fonctionnement local-first ;
- resynchronisation serveur robuste ;
- undo fiable ;
- historique complet ;
- debug facilité ;
- projection déterministe côté client et côté serveur.



## Principe de projection après chaque action

Chaque action organisateur produit une transaction. La transaction contient les events qui décrivent l’intention utilisateur.

Après application des events d’une transaction, le moteur doit relancer la résolution d’ordre :

```txt
transaction appliquée
→ resolveOrderAfterTransaction(state, context)
→ tableau résolu déterministe
```

Le resolver est défini dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

Règle non négociable : le même eventLog rejoué depuis zéro doit produire le même tableau final.

La dernière action utilisateur peut fournir une `anchor` :

- drag manuel → card déplacée ;
- ajout participation → nouvelle appearance ou groupe de nouvelles appearances visibles ;
- action drawer d’appel → décision d’appel ;
- played/locked → card désormais figée ;
- link créé → pas d’anchor directionnelle, utiliser la stratégie de link ;
- conflict créé → pas d’anchor directionnelle, résoudre avec coût minimal ;
- link/conflict supprimé → pas de retour magique, préserver l’ordre courant sauf contrainte restante.

Le resolver conserve cette anchor autant que possible, puis répare le tableau avec le solver de contraintes défini dans `docs/order-resolution-hierarchy-spec.md`.

Résumé :

```txt
Contraintes dures : played immobile, locked immobile, une seule card par colonne/row, links alignés si possible, conflicts séparés si possible.
Contraintes soft : intention de la dernière action, minimisation des déplacements, stabilité de l’ordre courant, fallback stable.
Round : metadata d’appearance, jamais contrainte d’ordre.
```

Les déplacements induits par un link, un conflict ou une card poussée peuvent être des résultats de projection déterministes : ils ne nécessitent pas forcément des events supplémentaires tant que le replay reproduit exactement le même ordre.

Un drag n’est pas refusé uniquement parce qu’il touche une card linkée ou conflictuelle. Si la card déplacée n’est ni `played` ni `locked`, la transaction est créée, puis le resolver réajuste le tableau : groupe linké qui suit, conflicts séparés, et pins `played`/`locked` conservés.

---

# 1. Lexique métier

## 1.1 Participant

Personne réelle inscrite à la jam.

```js
{
  participantId: "participant_nicolas",
  name: "Nicolas",
  presenceStatus: "available"
}
```

Un participant peut avoir plusieurs participations.

Statuts persistants V0 :

```txt
available
left
```

Important : `temporarily_away` n’est pas un état durable stocké sur le participant. Le cas “on ne trouve pas le musicien au moment de l’appel” est géré par l’action ponctuelle `appearance_skipped`.

---

## 1.2 Participation

Inscription d’un participant sur un instrument.

```js
{
  participationId: "participation_nicolas_guitar",
  participantId: "participant_nicolas",
  instrumentId: "guitar",
  baseOrderKey: "..."
}
```

Exemple :

```txt
Nicolas chant
Nicolas guitare
Nicolas basse
```

Chaque ligne est une participation différente.

La participation ne représente pas un passage précis. Elle représente le fait qu’un participant est inscrit sur un instrument.

---

## 1.3 Appearance

Occurrence concrète d’une participation dans un round.

```js
{
  appearanceId: "appearance_nicolas_guitar_1",
  participationId: "participation_nicolas_guitar",
  participantId: "participant_nicolas",
  instrumentId: "guitar",
  appearanceIndex: 1
}
```

Exemple :

```txt
Participation = Nicolas est inscrit en guitare
Appearance 1 = premier passage guitare de Nicolas
Appearance 2 = deuxième passage guitare de Nicolas
Appearance 3 = troisième passage guitare de Nicolas
```

Règle importante : les `appearanceIndex` matérialisés ne sont jamais renumérotés.

Si `appearance 2` est supprimée, `appearance 3` reste `appearance 3`. La projection peut afficher les éléments suivants plus haut visuellement, mais l’identité logique ne change pas.

---

## 1.4 Hole

Un `hole` est l’équivalent d’une appearance sans musicien.

```js
{
  holeId: "hole_drums_123",
  instrumentId: "drums",
  appearanceIndex: 1,
  orderKey: "..."
}
```

Règles :

- un hole occupe une vraie position dans une colonne ;
- un hole peut être joué ;
- un hole peut être locké ;
- un hole joué ne peut pas bouger ;
- un hole locké ne peut pas bouger ;
- un hole ne génère pas automatiquement de hole équivalent dans les rounds suivants ;
- supprimer un hole ne supprime jamais une appearance de musicien ;
- si le hole est linké, le dialog de confirmation doit le signaler ;
- supprimer un hole supprime ou ignore automatiquement les links qui ciblent ce hole.

---

## 1.5 Round

Nom UI utilisé pour désigner les appearances de même index.

```txt
Round 1 = appearanceIndex 1
Round 2 = appearanceIndex 2
Round 3 = appearanceIndex 3
```

Le round est principalement calculé par la projection.

Compromis validé :

```txt
Les appearances futures sont calculées par défaut.
Elles sont matérialisées dès qu’une action spécifique les cible.
```

Actions qui matérialisent une appearance :

- link ;
- conflict ponctuel ;
- lock ;
- played ;
- reorder manuel ;
- skip depuis drawer d’appel ;
- suppression d’une appearance future ;
- création d’un hole/link de type “jouer sans”.

---

## 1.6 Plateau

Un plateau correspond à une ligne horizontale du tableau, composée d’au plus une card par colonne visible.

Exemple :

```txt
Plateau 4
- Chant : Léa appearance 1
- Guitare : Nicolas appearance 2
- Basse : hole
- Batterie : Sarah appearance 1
```

Un plateau peut être marqué joué via le drawer d’appel ou le bouton dédié.

Un plateau joué fige les appearances/holes qu’il contient.

---

## 1.7 Link

Contrainte indiquant que plusieurs targets doivent jouer ensemble sur le même plateau.

En V0, un link peut cibler :

- une appearance ;
- un hole.

Payload recommandé :

```js
{
  linkId: "link_123",
  targets: [
    { targetType: "appearance", targetId: "appearance_nicolas_guitar_1" },
    { targetType: "hole", targetId: "hole_drums_123" }
  ]
}
```

Un link est une contrainte relationnelle. Il ne fige pas toute la composition du plateau.

Il n’y a pas de drawer de link en V0. Toute création/suppression de link se fait via le **mode link du tableau**.

---

## 1.8 Conflict

Les conflicts sont non orientés : créer A-C ou C-A définit la même interdiction de cohabitation. Le sens de création ne doit pas influencer le reorder. La priorité vient de la dernière action utilisateur, notamment la card déplacée manuellement.


Contrainte indiquant que deux targets ne peuvent pas être placées sur le même plateau.

Scopes V0 :

```txt
scope: "participation" = contrainte générale entre deux participations
scope: "appearance" = contrainte ponctuelle entre deux appearances
```

Raisons V0 autorisées :

```txt
instrument_constraint
manual
```

Un conflict ne cible pas de hole en V0.

### Conflict sur participation

Utilisé pour les contraintes structurelles.

Exemple : Nicolas guitare et Nicolas basse ne peuvent pas être sur le même plateau.

```js
{
  conflictId: "conflict_123",
  scope: "participation",
  targetIds: [
    "participation_nicolas_guitar",
    "participation_nicolas_bass"
  ],
  reason: "instrument_constraint"
}
```

### Conflict sur appearance

Utilisé pour une contrainte ponctuelle.

Exemple : Nicolas guitare round 1 ne doit pas jouer avec Sarah batterie round 1, mais les rounds suivants restent libres.

```js
{
  conflictId: "conflict_456",
  scope: "appearance",
  targetIds: [
    "appearance_nicolas_guitar_1",
    "appearance_sarah_drums_1"
  ],
  reason: "manual"
}
```

Il n’y a pas de drawer de conflict en V0. Toute création/suppression de conflict manuel se fait via le **mode conflict du tableau**.

---

## 1.9 Lock

Verrouillage strict d’une appearance ou d’un hole.

Règles :

- une card lockée ne peut pas être déplacée automatiquement ;
- une card lockée ne peut pas être déplacée manuellement ;
- une card lockée ne peut pas être déplacée par un link ;
- une card lockée ne peut pas être déplacée par un conflict ;
- une card lockée ne peut pas être déplacée par recalcul ;
- pour la déplacer, il faut d’abord unlock.

Différence :

```txt
played = historique figé
locked = futur figé
```

Une card jouée est immobile même si `locked=false`.

---

## 1.10 Stratégie de réorganisation des links

La jam possède une setting qui définit comment réorganiser les cards lors de la création d’un link.

Nom recommandé :

```txt
linkReorderStrategy
```

Valeurs V0 :

```txt
move_to_first
move_to_last
average_position
```

Valeur par défaut :

```txt
move_to_first
```

Définition :

```txt
move_to_first
= les targets sélectionnées sont alignées sur la position la plus haute / la plus tôt possible parmi les targets.

move_to_last
= les targets sélectionnées sont alignées sur la position la plus basse / la plus tardive parmi les targets.

average_position
= l’algo calcule la moyenne des positions actuelles des targets, arrondit vers la position la plus proche, et aligne les targets autour de cette position si possible.
```

Tie-breaker pour `average_position` :

```txt
En cas d’égalité, choisir la position la plus tôt / la plus haute.
```

La création ou modification de cette setting doit être historisée par event.

---

# 2. Structure standard d’un event

Tous les events doivent suivre cette base.

```js
{
  eventId: "event_123",
  jamId: "jam_123",
  transactionId: "transaction_456",
  type: "participation_added",
  payload: {},
  clientSequenceNumber: 14,
  serverSequenceNumber: 102,
  createdAt: "2026-06-14T15:00:00.000Z",
  createdBy: "organizer",
  clientId: "device_abc",
  schemaVersion: 1
}
```

## 2.1 `eventId`

Identifiant unique et stable de l’event.

## 2.2 `transactionId`

Une action UI peut produire plusieurs events.

Exemple inscription multi-instruments :

```txt
transaction_123
- participant_created
- participation_added chant
- participation_added guitare
- participation_added basse
- conflict_created chant/basse
- conflict_created guitare/basse
- link_created chant/guitare si demandé
```

L’undo cible une transaction complète, pas un event isolé.

## 2.3 Séquence

L’ordre des events est strict.

Côté client local-first :

```txt
clientSequenceNumber
```

Côté serveur après sync :

```txt
serverSequenceNumber
```

La projection doit toujours rejouer les events selon la séquence validée.

---

# 3. Snapshots

Le snapshot est une optimisation, pas la source de vérité.

```js
{
  jamId: "jam_123",
  snapshotVersion: 3,
  lastServerSequenceNumber: 100,
  state: {}
}
```

Au reload :

```txt
1. Charger le dernier snapshot valide.
2. Rejouer les events après lastServerSequenceNumber.
3. Reconstruire la projection.
```

---

# 4. Liste V0 des events autorisés

```txt
jam_created
jam_updated
jam_link_reorder_strategy_changed

instrument_added
instrument_updated
instrument_visibility_changed
instruments_reordered

participant_created
participant_updated
participant_removed
participant_marked_left

participation_added
participation_removed

appearance_materialized
appearance_moved_between
appearance_locked
appearance_unlocked
appearance_skipped
appearance_removed

link_created
link_removed

conflict_created
conflict_removed

hole_added
hole_removed
hole_moved_between
hole_locked
hole_unlocked

instrument_round_visibility_changed

plateau_played
plateau_unplayed

transaction_reverted
```

Events explicitement exclus de la V0 :

```txt
link_updated
conflict_updated
participation_updated
participation_note_updated
appearance_note_updated
play_without_created
play_without_removed
event_reverted
plateau_composition_forced
```

Règles :

- pas de notes dans l’app ;
- modifier un link = `link_removed` + `link_created` ;
- modifier un conflict = `conflict_removed` + `conflict_created` ;
- play without = `hole_added` + `link_created` ;
- undo = `transaction_reverted` ;
- pas d’undo d’event isolé en V0.

---

# 5. Règles globales de projection

## 5.1 Priorités d’immobilité

Le resolver n’utilise plus une pile de priorité de tri. Il applique des contraintes dures, puis choisit la réparation au coût le plus faible.

Contraintes dures :

```txt
- left / hidden / removed filtrés avant affichage
- played immobile
- locked immobile
- une seule card par colonne et par row résolue
- links alignés si possible
- conflicts séparés si possible
- card toujours dans sa colonne instrument
```

Contraintes soft :

```txt
- conserver l’intention de la dernière action
- minimiser le nombre de cards déplacées
- minimiser la distance de déplacement
- préserver l’ordre courant quand aucune contrainte ne force un changement
- fallback stable par ordre de création puis id
```

Conséquences :

- une card jouée ne bouge jamais ;
- une card lockée ne bouge jamais ;
- un participant `left` ne génère plus d’appearances futures ;
- un instrument hidden n’apparaît plus dans le tableau ni dans le drawer d’appel ;
- un link contradictoire avec un conflict est refusé ;
- les rounds peuvent être mélangés si le solver en a besoin ;
- si une action est refusée, afficher une snackbar explicative.

Snackbar recommandée pour link refusé :

```txt
Impossible de créer ce link : ces passages ont un conflit.
```

---

## 5.2 Règle de matérialisation des appearances

Par défaut, les appearances futures sont calculées.

Une appearance devient matérialisée dès qu’une action doit la cibler précisément.

Exemple :

```txt
Round 3 n’est pas encore affiché.
Nicolas guitare 3 peut être calculé mais n’a pas besoin d’être matérialisé.
Si l’organisateur locke Nicolas guitare 3, alors appearance_nicolas_guitar_3 est matérialisée.
```

ID recommandé pour les appearances calculables :

```txt
appearanceId = deterministic(participationId + appearanceIndex)
```

Cela permet de cibler une future appearance sans dépendre d’un ordre de création fragile.

---

## 5.3 Participation ajoutée après reveal de rounds

Règle validée : si un round 2, 3, etc. est déjà visible quand une participation est ajoutée, la projection doit ajouter une appearance de cette participation à la fin de chaque round déjà visible de l’instrument concerné.

Chaque instrument est indépendant : les appearances du round 2 se collent immédiatement à la suite du round 1 de la même colonne, sans laisser de trous artificiels pour s’aligner avec les autres colonnes.

Exemple :

```txt
La colonne guitare affiche Round 1 et Round 2.
État avant : Noé, Iris, Tom, Noé', Iris', Tom'
L’organisateur ajoute Paul guitare.

Conséquence :
- Paul guitare appearance 1 est ajoutée à la fin du Round 1.
- Paul guitare appearance 2 est ajoutée à la fin du Round 2.
- Résultat : Noé, Iris, Tom, Paul, Noé', Iris', Tom', Paul'.
```

Si le Round 3 est affiché plus tard :

```txt
Paul guitare appearance 3 sera générée à la fin du Round 3 selon le même ordre de participation.
```

Important : cela ne nécessite pas forcément un event `appearance_materialized` pour chaque round visible. La projection peut générer ces appearances de manière déterministe à partir de :

```txt
participation_added
visibleRoundCount de l’instrument
baseOrderKey / roundOrderKey de la participation
```

Si une de ces appearances reçoit ensuite une action spécifique, elle est matérialisée.

---

## 5.4 Suppression et remontée visuelle

Quand une appearance future, un hole, une participation ou un participant disparaît de la projection active :

```txt
Les cards suivantes peuvent remonter visuellement pour combler le vide.
Mais les appearanceIndex matérialisés ne sont jamais renumérotés.
```

Exemple :

```txt
Nicolas guitare appearance 2 est supprimée.
Nicolas guitare appearance 3 reste appearance 3.
Mais elle peut apparaître visuellement plus tôt si la colonne se referme.
```

---

## 5.5 Suppression d’un link

Quand un link est supprimé :

```txt
L’obligation de jouer ensemble disparaît.
La liste n’est pas réorganisée immédiatement.
Les cards restent là où elles sont.
Les prochaines actions ou recalculs pourront ensuite les traiter comme indépendantes.
```

---

## 5.6 Undo linéaire

L’undo est linéaire.

Si les transactions actives sont :

```txt
1, 2, 3, 4, 5, 6, 7
```

Pour undo la transaction 4, il faut d’abord undo :

```txt
7, puis 6, puis 5
```

Il n’y a donc jamais d’action ultérieure active dépendant d’une transaction plus ancienne undo.

Event :

```js
{
  type: "transaction_reverted",
  payload: {
    targetTransactionId: "transaction_7"
  }
}
```

La transaction ciblée n’est pas supprimée de l’eventLog. Elle est ignorée par la projection.

---

# 6. Events détaillés

## 6.1 `jam_created`

### Où dans l’UI

Page création de jam.

### Payload

```js
{
  name: "Jam du jeudi",
  date: "2026-06-14",
  linkReorderStrategy: "move_to_first"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés. Lors d’un drag, la card déplacée transmet sa priorité aux targets mobiles de son link ; ces targets peuvent pousser les cards mobiles de leurs propres colonnes pour rejoindre le plateau cible. Si une target déplacée par propagation pousse une autre card linkée, cette card poussée hérite de la priorité et propage à son tour son propre link. La résolution continue jusqu’à stabilisation, sans jamais déplacer du played ou du locked.


- initialise la jam ;
- initialise la config ;
- aucune appearance n’existe encore ;
- aucun impact vertical.

---

## 6.2 `jam_updated`

### Où dans l’UI

Modale/page édition de jam.

### Payload

```js
{
  name: "Jam du jeudi soir",
  date: "2026-06-14"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- modifie uniquement les métadonnées ;
- aucun impact d’ordre ;
- aucun recalcul vertical.

---

## 6.3 `jam_link_reorder_strategy_changed`

### Où dans l’UI

Config de la jam, dans la modale/page édition de jam.

### Payload

```js
{
  previousStrategy: "move_to_first",
  nextStrategy: "average_position"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- ne réorganise pas immédiatement les links existants ;
- s’applique uniquement aux futures créations de links ;
- doit être historisé dans l’eventLog ;
- l’undo restaure la stratégie précédente via projection.

---

## 6.4 `instrument_added`

### Où dans l’UI

Modale/page création ou édition de jam.

### Payload

```js
{
  instrumentId: "saxophone",
  label: "Saxophone",
  orderKey: "...",
  visible: true
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- ajoute une colonne vide ;
- aucun impact sur les autres colonnes ;
- aucun impact sur les plateaux joués.

---

## 6.5 `instrument_updated`

### Où dans l’UI

Modale/page édition de jam.

### Payload

```js
{
  instrumentId: "guitar",
  label: "Guitare électrique"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- modifie le libellé ;
- ne change pas l’ordre vertical ;
- ne modifie pas les participations ;
- recommandé avant une suppression d’instrument.

---

## 6.6 `instrument_visibility_changed`

### Où dans l’UI

Modale/page édition de jam, bouton “Supprimer” sur un instrument.

L’UI doit d’abord suggérer de renommer l’instrument.

Si l’organisateur confirme la suppression, on ne hard-delete pas l’instrument : on le rend invisible.

### Payload

```js
{
  instrumentId: "saxophone",
  visible: false
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- la colonne devient invisible dans le tableau ;
- l’instrument disparaît du drawer d’appel ;
- les appearances jouées restent dans l’historique ;
- les participations ne sont pas supprimées de l’historique ;
- les appearances futures de cet instrument ne sont plus affichées ni appelées ;
- les links/conflicts qui ciblent des appearances de cet instrument ne doivent plus forcer la liste visible ;
- si l’instrument redevient visible dans une version future, l’historique permettra de reconstruire ses données.

### Snackbar / Dialog

Dialog recommandé :

```txt
Supprimer cet instrument ?
Il sera masqué du tableau et du drawer d’appel. Les passages déjà joués resteront dans l’historique.
```

---

## 6.7 `instruments_reordered`

### Où dans l’UI

Modale/page édition de jam.

### Payload

```js
{
  orderedInstrumentIds: ["vocals", "guitar", "bass", "drums"]
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- change uniquement l’ordre horizontal des colonnes ;
- ne change jamais l’ordre vertical des appearances ;
- ne change pas les links/conflicts/locks.

---

## 6.8 `participant_created`

### Où dans l’UI

Drawer ajout participant.

### Payload

```js
{
  participantId: "participant_nicolas",
  name: "Nicolas"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- crée la personne ;
- aucun impact direct sur l’ordre ;
- l’impact vient des `participation_added` de la même transaction.

---

## 6.9 `participant_updated`

### Où dans l’UI

Drawer édition participant.

### Payload

```js
{
  participantId: "participant_nicolas",
  name: "Nico"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- modifie le nom affiché ;
- aucun impact d’ordre.

---

## 6.10 `participant_removed`

### Où dans l’UI

Drawer édition participant ou menu trois points d’une card.

Disponible uniquement si le participant n’a jamais joué.

Si le participant a déjà joué, l’option “Supprimer” ne doit pas être proposée. L’UI doit suggérer “Marquer comme parti”.

### Payload

```js
{
  participantId: "participant_nicolas"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire le participant de la projection active ;
- retire ses participations futures ;
- retire ses appearances futures ;
- supprime/ignore les links qui ciblent ses appearances ;
- supprime/ignore les conflicts qui ciblent ses participations ou appearances ;
- refuse l’action si au moins une de ses appearances est `played`.

### Dialog

Confirmation obligatoire :

```txt
Supprimer ce participant ?
Il sera retiré de la jam. Cette action peut être annulée avec Undo.
```

---

## 6.11 `participant_marked_left`

### Où dans l’UI

Menu trois points d’une card : “Musicien parti”.

### Payload

```js
{
  participantId: "participant_nicolas"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- passe le participant en `left` ;
- supprime toutes ses appearances futures de la projection active ;
- empêche la génération de nouvelles appearances pour les rounds suivants ;
- conserve ses appearances jouées dans l’historique ;
- si des appearances futures étaient lockées, afficher une confirmation ;
- `left` gagne sur `locked` pour les appearances futures non jouées.

### Dialog

```txt
Marquer ce musicien comme parti ?
Ses prochains passages seront retirés, mais ses passages déjà joués resteront dans l’historique.
```

Si appearances futures lockées :

```txt
Ce musicien a des passages verrouillés à venir. Ils seront retirés si vous le marquez comme parti.
```

---

## 6.12 `participation_added`

### Où dans l’UI

- drawer ajout participant ;
- drawer édition participant, ajout d’un instrument.

L’ajout de participant entre deux cards est hors V0 et déplacé en V1.

### Payload V0

```js
{
  participationId: "participation_nicolas_guitar",
  participantId: "participant_nicolas",
  instrumentId: "guitar",
  insertionMode: "end_of_visible_rounds",
  startAppearanceIndex: 1,
  afterTarget: null,
  beforeTarget: null,
  baseOrderKey: "order_..."
}
```

Modes autorisés en V0 :

```txt
end_of_visible_rounds
```

Modes exclus de la V0 :

```txt
between_targets
```

La base de données n’étant pas en production, il n’est pas nécessaire de conserver de compatibilité legacy pour `between_targets`.

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- crée une participation ;
- crée ou rend calculable `appearanceIndex 1` ;
- ajoute l’appearance 1 à la fin du round 1 ;
- si plusieurs rounds sont visibles, génère aussi les appearances correspondantes à la fin de chaque round visible ;
- les rounds futurs non visibles seront générés plus tard selon le même `baseOrderKey` / `roundOrderKey`.

### Cas standard

```txt
Ajouter participant via CTA principal
→ appearance 1 à la fin du round 1
→ si round 2 visible, appearance 2 à la fin du round 2
→ si round 3 visible, appearance 3 à la fin du round 3
```

### Ajout après reveal du round 2

```txt
Round 1 et Round 2 sont visibles.
Paul rejoint la colonne guitare.
Avant : Noé, Iris, Tom, Noé', Iris', Tom'

Résultat :
- Paul guitare appearance 1 est à la fin du Round 1.
- Paul guitare appearance 2 est à la fin du Round 2.
- Ordre : Noé, Iris, Tom, Paul, Noé', Iris', Tom', Paul'.
- Paul guitare appearance 3 sera générée à la fin du Round 3 quand Round 3 sera révélé.
```

---

## 6.13 `participation_removed`

### Où dans l’UI

Drawer édition participant ou menu trois points d’une card : “Retirer cet instrument”.

### Payload

```js
{
  participationId: "participation_nicolas_guitar"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire les appearances futures de cette participation ;
- empêche la génération d’appearances futures pour cette participation ;
- conserve les appearances jouées dans l’historique ;
- supprime/ignore les links et conflicts liés aux appearances futures retirées ;
- ne supprime pas le participant.

### Dialog

Confirmation obligatoire si appearances futures, locks ou links :

```txt
Retirer cet instrument ?
Les prochains passages sur cet instrument seront retirés.
```

Si links :

```txt
Ce passage est lié à d’autres cards. Les links associés seront retirés.
```

---

## 6.14 `appearance_materialized`

### Où dans l’UI

Pas d’entrée UI directe. Event interne généré quand une action doit cibler une appearance calculée.

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_2",
  participationId: "participation_nicolas_guitar",
  appearanceIndex: 2
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- donne une identité stable à une appearance ;
- ne modifie pas l’ordre par elle-même ;
- l’action qui l’a déclenchée peut modifier l’ordre.

---

## 6.15 `appearance_moved_between`

### Où dans l’UI

Drag vertical dans une colonne.

Pas de drag horizontal.

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_1",
  instrumentId: "guitar",
  previousTargetId: "appearance_sarah_guitar_1",
  nextTargetId: "appearance_mehdi_guitar_1"
}
```

`previousTargetId` et `nextTargetId` peuvent cibler une appearance ou un hole de la même colonne.

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- déplace l’appearance dans sa colonne ;
- ne change pas son `appearanceIndex` ;
- refuse le drop si l’appearance est jouée ;
- refuse le drop si l’appearance est lockée ;
- accepte le drop d’une card conflictuelle si elle n’est ni jouée ni lockée ;
- accepte le drop d’une card linkée si elle n’est ni jouée ni lockée ;
- après le drop, le resolver réorganise les cards linkées/conflictuelles ;
- produit un warning déterministe seulement si le resolver ne peut pas réparer le link/conflict sans déplacer du played ou du locked.

### Cas card linkée

Si l’appearance déplacée appartient à un link :

```txt
Le groupe linké doit être déplacé ensemble.
```

Si déplacer le groupe linké est impossible à cause d’une card jouée, lockée ou d’un conflict, l’action est refusée avec snackbar.

---

## 6.16 `appearance_locked`

### Où dans l’UI

Icône lock/unlock sur la card.

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_2"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- fige l’appearance à sa position actuelle ;
- interdit les déplacements automatiques ;
- interdit les déplacements manuels ;
- autorise les déplacements induits par link/conflict quand ils sont produits par le resolver et qu’ils ne déplacent pas de played/locked ;
- n’impacte pas les autres cards.

---

## 6.17 `appearance_unlocked`

### Où dans l’UI

Icône lock/unlock sur la card.

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_2"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire le verrou ;
- ne déclenche pas de recalcul immédiat ;
- la card reste à sa position actuelle jusqu’à une prochaine action.

---

## 6.18 `appearance_skipped`

### Où dans l’UI

Drawer d’appel d’un plateau, quand l’organisateur ne trouve pas un musicien appelé.

Libellé UI possible :

```txt
Introuvable pour l’instant
Passer ce passage
```

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_1",
  reason: "temporarily_away"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- action ponctuelle ;
- ne stocke pas un état durable `temporarily_away` ;
- repousse l’appearance d’un plateau / slot dans sa colonne ;
- l’appearance suivante de la même colonne remonte pour remplir la place ;
- le participant reste `available` ;
- l’appearance pourra être appelée plus tard ;
- si l’appearance appartient à un link, le link est supprimé avant le report ;
- seule l’appearance skippée est repoussée ;
- les autres cards anciennement linkées restent à leur position ;
- si l’appearance skippée ne peut pas être repoussée à cause de played/locked/conflict, l’action est refusée avec snackbar.

---

## 6.19 `appearance_removed`

### Où dans l’UI

Menu trois points d’une card future : “Supprimer ce passage”.

### Payload

```js
{
  appearanceId: "appearance_nicolas_guitar_2"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- supprime uniquement cette occurrence ;
- ne supprime pas le participant ;
- ne supprime pas la participation ;
- ne renumérote jamais les appearances matérialisées suivantes ;
- supprime/ignore les links qui ciblent cette appearance ;
- supprime/ignore les conflicts ponctuels qui ciblent cette appearance ;
- refuse l’action si l’appearance est jouée.

### Dialog

Confirmation obligatoire.

Sans link :

```txt
Supprimer ce passage ?
Le musicien restera inscrit, mais ce passage sera retiré.
```

Avec link :

```txt
Supprimer ce passage ?
Ce passage est lié à d’autres cards. Les links associés seront retirés.
```

---

## 6.20 `link_created`

### Où dans l’UI

Mode link du tableau.

Déroulé :

```txt
1. L’organisateur clique sur le bouton link d’une card.
2. Le tableau passe en mode link.
3. La card d’origine est sélectionnée automatiquement.
4. L’organisateur sélectionne d’autres cards dans d’autres colonnes.
5. L’organisateur valide.
6. Le link est créé.
7. La liste est réorganisée selon linkReorderStrategy.
```

Il n’y a pas de drawer de link.

### Payload

```js
{
  linkId: "link_123",
  reorderStrategy: "move_to_first",
  targets: [
    { type: "appearance", id: "appearance_nicolas_guitar_1" },
    { type: "appearance", id: "appearance_sarah_drums_1" }
  ]
}
```

`reorderStrategy` doit être copié depuis la config courante de la jam au moment de la création, pour que le replay reste déterministe même si la setting change plus tard.

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- force les targets à être sur le même plateau ;
- peut déplacer des cards non jouées et non lockées ;
- respecte la stratégie `linkReorderStrategy` ;
- ne peut jamais violer un conflict ;
- ne peut jamais déplacer une card jouée ;
- ne peut jamais déplacer une card lockée ;
- refuse l’action si les targets sont incompatibles.

### Stratégies

#### `move_to_first`

```txt
Trouver la position la plus haute parmi les targets.
Aligner les autres targets sur cette position si possible.
```

#### `move_to_last`

```txt
Trouver la position la plus basse parmi les targets.
Aligner les autres targets sur cette position si possible.
```

#### `average_position`

```txt
Calculer la moyenne des positions des targets.
Choisir la position entière la plus proche.
En cas d’égalité, choisir la position la plus haute.
Aligner les targets autour de cette position si possible.
```

### Refus et snackbar

Refuser si :

- deux targets sont dans la même colonne ;
- une target est jouée et devrait bouger ;
- une target est lockée et devrait bouger ;
- les targets ont un conflict ;
- l’alignement forcerait un conflict avec une autre card ;
- l’alignement nécessiterait de déplacer une card jouée ou lockée.

Snackbar :

```txt
Impossible de créer ce link : la réorganisation violerait une contrainte.
```

Si conflict direct :

```txt
Impossible de créer ce link : ces passages ont un conflit.
```

---

## 6.21 `link_removed`

### Où dans l’UI

Mode link du tableau depuis une card déjà linkée.

Déroulé recommandé :

```txt
1. L’organisateur clique sur le bouton link d’une card linkée.
2. Le tableau passe en mode link.
3. Les cards actuellement linkées apparaissent sélectionnées.
4. L’organisateur reclique sur une card liée pour la désélectionner.
5. Il valide.
6. Le ou les links concernés sont supprimés.
```

Si le link contient seulement deux targets, désélectionner une target supprime le link entier.

### Payload

```js
{
  linkId: "link_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- supprime l’obligation de jouer ensemble ;
- ne réorganise pas immédiatement la liste ;
- les cards restent là où elles sont ;
- les prochaines actions ou recalculs pourront les traiter comme indépendantes.

---

## 6.22 `conflict_created`

### Où dans l’UI

Mode conflict du tableau.

Déroulé :

```txt
1. L’organisateur active le mode conflict depuis une card.
2. Le tableau change visuellement pour indiquer le mode conflict.
3. La card d’origine est sélectionnée automatiquement.
4. L’organisateur sélectionne les cards qui ne peuvent pas jouer avec elle.
5. L’organisateur valide.
6. L’UI demande si le conflit concerne seulement ce passage ou la soirée en général.
7. Les conflicts sont créés.
8. La liste est réorganisée si nécessaire.
```

Choix de scope :

```txt
Seulement ce passage → scope: appearance
En général → scope: participation
```

### Payload appearance

```js
{
  conflictId: "conflict_appearance_123",
  scope: "appearance",
  targetIds: [
    "appearance_nicolas_guitar_1",
    "appearance_sarah_drums_1"
  ],
  reason: "manual"
}
```

### Payload participation

```js
{
  conflictId: "conflict_participation_123",
  scope: "participation",
  targetIds: [
    "participation_nicolas_guitar",
    "participation_sarah_drums"
  ],
  reason: "manual"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- empêche les targets d’être sur le même plateau ;
- `scope: appearance` s’applique uniquement aux appearances ciblées ;
- `scope: participation` s’applique à toute la soirée : toutes les appearances actuelles et futures des participations ciblées héritent du conflict ;
- après un reveal de round, les nouvelles appearances matérialisées doivent être réévaluées par le resolver ;
- exemple : un conflict participation `A-C` doit aussi séparer `A'` et `C'` dès que le round suivant est affiché ;
- si les targets sont déjà sur le même plateau, le solver doit les séparer ;
- le sens de création du conflict ne décide pas quelle card doit bouger ;
- le solver déplace la card ou le groupe dont le coût de déplacement est le plus faible ;
- le resolver peut chercher un slot valide en dessous ou au-dessus ;
- si une target est jouée ou lockée, elle ne bouge jamais ;
- si aucune target mobile ne peut résoudre le conflict, l’action est refusée ou produit un warning en replay.

Critères de réparation :

```txt
1. Ne jamais bouger played.
2. Ne jamais bouger locked.
3. Éviter de déplacer l’anchor de la dernière action.
4. Évaluer le coût complet si une card déplacée appartient à un link.
5. Choisir le slot valide le plus proche.
6. Ne jamais utiliser le round comme priorité d’ordre.
```

Si aucun slot valide n’existe :

```txt
Refuser l’action et afficher une snackbar, ou produire un projectionWarning déterministe si l’event est déjà dans l’historique.
```

Snackbar :

```txt
Impossible de créer ce conflit : aucun déplacement valide n’est possible.
```

---

## 6.23 `conflict_removed`

### Où dans l’UI

Mode conflict du tableau depuis une card ayant déjà un conflict.

Déroulé :

```txt
1. L’organisateur active le mode conflict depuis une card.
2. Les cards déjà en conflict avec elle sont indiquées visuellement.
3. L’organisateur reclique sur une card en conflict pour supprimer ce conflict.
4. Il valide.
5. Le conflict est supprimé.
```

Il n’y a pas d’édition directe d’un conflict. Pour modifier un conflict, il faut le supprimer puis en créer un nouveau.

### Payload

```js
{
  conflictId: "conflict_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire la contrainte ;
- ne réorganise pas immédiatement la liste ;
- les cards restent là où elles sont ;
- les prochains recalculs/actions ne tiendront plus compte de ce conflict.

---

## 6.24 `hole_added`

### Où dans l’UI

- action “Jouer sans…” depuis une card ;
- drawer d’appel “Plateau sans [instrument manquant]”.

L’ajout manuel de hole entre deux cards est hors V0.

### Payload hole manuel

```js
{
  holeId: "hole_bass_123",
  instrumentId: "bass",
  appearanceIndex: 1,
  previousTargetId: "appearance_tom_bass_1",
  nextTargetId: "appearance_max_bass_1",
  reason: "manual",
  targetResolvedRow: null
}
```

### Payload “jouer sans”

Pour “Nicolas guitare veut jouer sans batterie” :

```txt
transaction_x
- hole_added dans colonne batterie
- link_created entre appearance_nicolas_guitar_1 et hole_battery_x
```

Il n’y a pas d’event `play_without_created`.

Pour `reason: played_empty_slot`, `targetResolvedRow` est obligatoire. Il correspond au `playedResolvedRow` du plateau joué et le hole est inclus dans `plateau_played.targets` dans la même transaction.

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- ajoute un hole dans une colonne ;
- le hole occupe une vraie position ;
- il peut être joué ;
- il peut être locké ;
- il peut être linké ;
- il ne génère pas de hole dans les rounds suivants ;
- il ne représente pas une participation.

---

## 6.25 `hole_removed`

### Où dans l’UI

Menu trois points d’un hole : “Supprimer ce trou”.

### Payload

```js
{
  holeId: "hole_bass_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- supprime uniquement le hole ;
- ne supprime jamais une appearance de musicien ;
- supprime/ignore les links qui ciblent ce hole ;
- refuse l’action si le hole est joué ;
- la colonne se referme autour du trou.

### Dialog

Confirmation obligatoire.

Sans link :

```txt
Supprimer ce trou ?
```

Avec link :

```txt
Supprimer ce trou ?
Ce trou est lié à une autre card. Le link associé sera retiré.
```

---

## 6.26 `hole_moved_between`

### Où dans l’UI

Drag vertical d’un hole dans sa colonne.

### Payload

```js
{
  holeId: "hole_bass_123",
  instrumentId: "bass",
  previousTargetId: "appearance_tom_bass_1",
  nextTargetId: "appearance_max_bass_1"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- déplace le hole dans sa colonne ;
- refuse si le hole est joué ;
- refuse si le hole est locké ;
- refuse si le hole est linké et que son déplacement casserait le link ;
- en V0, un hole ne peut être déplacé qu’à l’intérieur du même round visible.

---

## 6.27 `hole_locked`

### Où dans l’UI

Icône lock/unlock sur le hole.

### Payload

```js
{
  holeId: "hole_bass_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- fige le hole ;
- interdit déplacement manuel ;
- interdit déplacement automatique ;
- ne modifie pas les autres cards.

---

## 6.28 `hole_unlocked`

### Où dans l’UI

Icône lock/unlock sur le hole.

### Payload

```js
{
  holeId: "hole_bass_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire le verrou ;
- ne déclenche pas de recalcul immédiat.

---

## 6.29 `instrument_round_visibility_changed`

### Où dans l’UI

Bouton en bas d’une colonne : “Afficher le round suivant”.

### Payload

```js
{
  instrumentId: "guitar",
  visibleRoundCount: 2
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- change uniquement les rounds visibles de cette colonne ;
- ne change pas l’ordre métier ;
- rend visibles les appearances calculables du nouveau round ;
- ne matérialise pas forcément toutes les appearances ;
- les participations déjà existantes apparaissent selon leur `baseOrderKey` ;
- les participations ajoutées après reveal suivront la règle de génération pour tous les rounds visibles.

V0 :

```txt
Afficher le round suivant : oui.
Masquer un round : non.
```

---

## 6.30 `plateau_played`

### Où dans l’UI

- bouton “Plateau joué” ;
- drawer d’appel.

### Payload

```js
{
  plateauId: "plateau_4",
  visualIndex: 4,
  playedResolvedRow: 4,
  targets: [
    { targetType: "appearance", targetId: "appearance_lea_vocals_1" },
    { targetType: "appearance", targetId: "appearance_nicolas_guitar_1" },
    { targetType: "hole", targetId: "hole_bass_123" }
  ]
}
```

### Conséquences sur la liste

`visualIndex` est l’intention UI. `playedResolvedRow` est la row logique calculée depuis le layout courant avant application de `plateau_played`.

- marque les appearances/holes du plateau comme joués ;
- les cards deviennent grisées ;
- elles restent visibles ;
- elles ne peuvent plus bouger ;
- elles ne sont plus candidates pour les prochains plateaux ;
- ne déplace pas automatiquement les cards ;
- si une colonne visible est vide sur ce `playedResolvedRow` au moment du marquage joué, le frontend crée d’abord un `hole_added` avec `reason: played_empty_slot` et `targetResolvedRow = playedResolvedRow`, puis inclut ce hole dans `plateau_played.targets`. Ce trou joué fige la ligne vide et empêche toute participation ajoutée plus tard sur cet instrument de se placer sur un plateau déjà joué.

Si une appearance du plateau vient d’être skipped, elle ne peut pas être marquée jouée sur ce plateau.

---

## 6.31 `plateau_unplayed`

### Où dans l’UI

Action secondaire sur le dernier plateau joué.

### Payload

```js
{
  plateauId: "plateau_4"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- retire l’état played des cards du plateau ;
- les cards redeviennent candidates selon leur position actuelle ;
- ne change pas l’ordre visuel ;
- V0 : autorisé uniquement sur le dernier plateau joué.

---

## 6.32 `transaction_reverted`

### Où dans l’UI

Bouton Undo global.

### Payload

```js
{
  targetTransactionId: "transaction_123"
}
```

### Conséquences sur la liste

Un link est non orienté : il ne contient pas d’anchor et son sens de création ne doit pas modifier la résolution. Un link actif contient toujours au moins deux targets. Si une target est retirée d’un groupe de trois ou plus, le groupe restant continue d’exister. Si moins de deux targets restent, le link est supprimé. Créer un link avec une card déjà linkée fusionne les groupes concernés.


- ajoute un event d’undo ;
- ne supprime jamais l’historique ;
- la projection ignore les events de la transaction ciblée ;
- la liste est reconstruite comme si cette transaction n’avait pas eu d’effet ;
- undo uniquement linéaire : seule la dernière transaction active peut être undo.

---

# 7. Modes UI spéciaux

## 7.1 Mode link

Déclencheur : bouton link sur une card.

État visuel :

- tableau teinté en mode link ;
- card d’origine sélectionnée ;
- cards sélectionnables dans les autres colonnes ;
- cards non sélectionnables visuellement disabled ;
- bouton validation visible ;
- bouton annulation visible.

Règles :

- sélectionner seulement des cards d’autres colonnes ;
- autoriser appearance + hole ;
- interdire targets en conflict ;
- interdire targets jouées si elles devraient bouger ;
- interdire targets lockées si elles devraient bouger ;
- validation produit `link_created` ou `link_removed` selon le contexte.

---

## 7.2 Mode conflict

Déclencheur : menu/action conflict sur une card.

État visuel :

- tableau teinté en mode conflict ;
- card d’origine sélectionnée ;
- cards déjà en conflict indiquées ;
- cards sélectionnables dans les autres colonnes ;
- bouton validation visible ;
- bouton annulation visible.

À la validation :

```txt
Demander :
- Ce passage seulement ?
- En général ?
```

Mapping :

```txt
Ce passage seulement → scope appearance
En général → scope participation
```

Règles :

- pas de conflict sur hole en V0 ;
- pas de `conflict_updated` ;
- modifier = supprimer puis recréer ;
- suppression de conflict ne réorganise pas immédiatement.

---

## 7.3 Drawer d’appel

Actions principales :

- marquer plateau joué ;
- indiquer qu’un musicien est introuvable pour l’instant.

“Musicien introuvable” produit :

```txt
appearance_skipped
```

Ne produit pas un état durable `temporarily_away`.

---

# 8. Règles d’algorithme pour links

## 8.1 Inputs

- targets sélectionnées ;
- positions actuelles ;
- `linkReorderStrategy` copiée dans l’event ;
- locks ;
- played ;
- conflicts ;
- hidden instruments ;
- links existants.

## 8.2 Résolution

Pseudo-règle :

```txt
1. Vérifier que les targets sont dans des colonnes différentes.
2. Vérifier qu’aucun conflict direct n’existe entre les targets.
3. Fusionner les targets via le groupe linké.
4. Calculer une row cible selon strategy, sauf si une target fixed impose déjà une row.
5. Tester le déplacement des targets non alignées.
6. Pousser les cards mobiles qui occupent les slots cibles.
7. Propager la priorité si une card poussée appartient à un autre link.
8. Refuser/warning si cela exige de déplacer played/locked ou crée un conflict insoluble.
9. Continuer jusqu’à stabilité.
```

## 8.3 Position cible

```txt
move_to_first → min(position des targets)
move_to_last → max(position des targets)
average_position → round(mean(position des targets)), tie vers le haut
```

## 8.4 En cas d’échec

Ne pas créer de link partiel.

Afficher snackbar.

---

# 9. Règles d’algorithme pour conflicts

## 9.1 Conflict automatique

À l’inscription multi-instruments d’un même participant :

- créer des conflicts `instrument_constraint` entre les participations incompatibles ;
- si deux participations sont explicitement linkées sur une appearance précise, ne pas créer de conflict pour cette paire d’appearances ;
- garder les conflicts avec les autres instruments.

Raison :

```txt
instrument_constraint
```

## 9.2 Conflict manuel

Créé via mode conflict.

Raison :

```txt
manual
```

Scope selon choix UI :

```txt
appearance ou participation
```

## 9.3 Résolution d’un conflict qui touche deux cards déjà alignées

La résolution est faite par le resolver global après application de la transaction.

```txt
1. Ne jamais bouger played.
2. Ne jamais bouger locked.
3. Garder l’intention de la dernière action si possible.
4. Déplacer l’autre target vers le slot valide le plus proche, en essayant d’abord les slots suivants puis les slots précédents si aucun slot suivant n’est disponible.
5. Respecter les links actifs si cela ne viole pas le conflict.
6. Refuser si aucun ordre valide n’existe.
```

Slot valide :

- pas joué ;
- pas locké ;
- pas conflict ;
- link respecté ;
- instrument visible ;
- round visible ou calculable.

---

# 10. Règles “jouer sans”

Il n’y a pas d’events `play_without_created` ou `play_without_removed` en V0.

“Jouer sans batterie” est modélisé comme :

```txt
hole_added dans la colonne batterie
link_created entre l’appearance du musicien et ce hole
```

Conséquences :

- le hole est un hole normal ;
- il peut être locké ;
- il peut être joué ;
- il peut être supprimé avec confirmation ;
- supprimer le hole retire le link associé ;
- supprimer le link laisse le hole en place ;
- supprimer le hole ne supprime jamais l’appearance du musicien.

---

# 11. Règles de confirmation

Confirmation obligatoire pour :

- supprimer un participant ;
- marquer un participant comme parti ;
- retirer une participation ;
- supprimer une appearance ;
- supprimer un hole ;
- masquer/supprimer un instrument ;
- action qui retire des links ;
- action qui concerne une card lockée future.

Si l’élément supprimé possède un link, le dialog doit le préciser explicitement.

---

# 12. Règles de snackbar

Snackbar obligatoire quand une action est refusée pour contrainte.

Cas minimum :

```txt
Link refusé à cause d’un conflict.
Link refusé car une card lockée devrait bouger.
Link refusé car une card jouée devrait bouger.
Conflict impossible car aucun déplacement valide.
Drag refusé car card lockée.
Drag refusé car card jouée.
Suppression refusée car card jouée.
Suppression participant refusée car il a déjà joué.
```

Exemple pour participant joué :

```txt
Ce participant a déjà joué. Vous pouvez le marquer comme parti.
```

---

# 13. Ce qui n’existe pas en V0

```txt
Pas de drawer link.
Pas de drawer conflict.
Pas de notes.
Pas de participation_note.
Pas de appearance_note.
Pas de play_without event dédié.
Pas de link_updated.
Pas de conflict_updated.
Pas de participation_updated générique.
Pas de event_reverted isolé.
Pas de plateau_composition_forced.
Pas de suppression hard-delete d’instrument.
Pas de masquage de round.
Pas de conflict sur hole.
```

---

# 14. Feedback organisateur par action

Objectif : chaque action doit être compréhensible sans surcharger l’interface.

Types de feedback :

```txt
silent = aucun message, le changement visuel suffit
snackbar = message court quelques secondes
dialog = confirmation ou choix nécessaire avant action
animation = déplacement ou changement visuel dans le tableau
```

Règle générale :

```txt
- Les actions destructives ou ambiguës demandent un dialog.
- Les actions refusées affichent une snackbar explicative.
- Les actions qui déplacent des cards doivent être animées.
- Les actions simples et visibles peuvent être silent.
```

Durée recommandée pour les animations de déplacement :

```txt
800ms à 1000ms
```

## 14.1 Feedbacks recommandés

| Action | Feedback avant action | Feedback après action | Animation tableau | Raison |
|---|---:|---:|---:|---|
| `jam_created` | silent | silent | non | La création est implicite : l’organisateur arrive directement sur la page de la jam. |
| `jam_updated` | silent | snackbar | non | L’organisateur doit savoir que la config est enregistrée. |
| `jam_link_reorder_strategy_changed` | silent | snackbar | non | La setting ne réorganise pas immédiatement la liste. |
| `instrument_added` | silent | silent ou snackbar | oui légère apparition colonne | La colonne vide apparaît directement. |
| `instrument_updated` | silent | silent | non | Changement de libellé visible immédiatement. |
| `instrument_visibility_changed` | dialog obligatoire | snackbar | oui disparition colonne | Action structurante ; warning si links actifs ; confirmation autorisée. |
| `instruments_reordered` | silent | silent | oui déplacement colonnes | Le déplacement visuel suffit. |
| `participant_created` | silent | silent | oui apparition cards | L’apparition des cards dans les colonnes suffit ; pas de snackbar. |
| `participant_updated` | silent | silent, sauf snackbar si ajout d’un instrument | non ou apparition cards si instrument ajouté | Changement de nom visible ; ajout d’instrument = feedback explicite + nouvelles cards visibles. |
| `participant_removed` | dialog obligatoire | snackbar | oui retrait cards | Destructif ; seulement si participant jamais joué. |
| `participant_marked_left` | dialog obligatoire | snackbar | oui retrait futures appearances | Important : retire les passages futurs. |
| `participation_added` | silent | snackbar si ajout d’instrument à un participant existant ou si plusieurs rounds impactés | oui apparition cards | Ajout initial visible sans snackbar ; ajout d’instrument après coup doit être confirmé. |
| `participation_removed` | dialog si futures appearances/links/locks | snackbar | oui retrait cards | Retire des passages futurs. |
| `appearance_materialized` | silent | silent | non | Interne, pas visible comme action. |
| `appearance_moved_between` | silent | snackbar seulement si groupe linké déplacé | oui déplacement cards | Drag manuel visible ; snackbar si effets indirects. |
| `appearance_locked` | silent | silent | oui micro-changement icône/card | L’icône lock suffit. |
| `appearance_unlocked` | silent | silent | oui micro-changement icône/card | L’icône unlock suffit. |
| `appearance_skipped` | dialog ou bouton explicite dans drawer d’appel | snackbar | oui report card | L’organisateur doit comprendre que le link éventuel est retiré et que la card est repoussée. |
| `appearance_removed` | dialog obligatoire | snackbar | oui retrait card | Suppression ciblée ; dialog précise si link. |
| `link_created` | validation mode link | snackbar si déplacement | oui déplacement cards | Le mode link montre l’action ; snackbar explique la réorganisation. |
| `link_removed` | validation mode link | snackbar | non ou animation badge | La liste ne bouge pas ; feedback nécessaire. |
| `conflict_created` | dialog scope obligatoire | snackbar si déplacement | oui si séparation cards | Le choix appearance/participation doit être explicite. |
| `conflict_removed` | validation mode conflict | snackbar | non ou animation badge | La liste ne bouge pas ; feedback nécessaire. |
| `hole_added` | silent | silent ou snackbar si via jouer sans | oui apparition hole | Ajout visible ; snackbar utile pour play without. |
| `hole_removed` | dialog obligatoire | snackbar | oui retrait hole | Suppression ; dialog précise si link. |
| `hole_moved_between` | silent | snackbar si hole linké déplacé | oui déplacement hole | Drag visible ; snackbar si effet indirect. |
| `hole_locked` | silent | silent | oui micro-changement icône/card | Icône suffisante. |
| `hole_unlocked` | silent | silent | oui micro-changement icône/card | Icône suffisante. |
| `instrument_round_visibility_changed` | silent | silent | oui apparition round | Le round apparaît directement. |
| `plateau_played` | silent ou validation drawer | snackbar optionnelle | oui grisé cards | Le changement visuel suffit souvent. |
| `plateau_unplayed` | dialog si dernier plateau joué | snackbar | oui retour état normal | Action sensible sur historique récent. |
| `transaction_reverted` | silent pour dernier undo | snackbar | oui selon effets | L’undo doit être visible et confirmé. |

Règles de feedback complémentaires :

```txt
- Création de jam : pas de snackbar, car la navigation vers la page jam confirme déjà l’action.
- Création initiale de participant : pas de snackbar, car les cards apparaissent directement dans le tableau.
- Modification simple de participant, par exemple changement de nom : silent.
- Ajout d’un instrument à un participant existant : snackbar obligatoire + apparition animée des nouvelles appearances.
```

## 14.2 Messages snackbar recommandés

### Link créé sans déplacement

```txt
Link créé.
```

### Link créé avec déplacement

```txt
Certains passages ont été déplacés pour respecter le link.
```

### Link refusé par conflict

```txt
Impossible de créer ce link : ces passages ont un conflit.
```

### Link refusé par lock

```txt
Impossible de créer ce link : un passage verrouillé devrait bouger.
```

### Link refusé par played

```txt
Impossible de créer ce link : un passage déjà joué devrait bouger.
```

### Link supprimé

```txt
Link supprimé.
```

### Conflict créé sans déplacement

```txt
Conflit ajouté.
```

### Conflict créé avec déplacement

```txt
Un passage a été déplacé pour respecter le conflit.
```

### Conflict refusé

```txt
Impossible de créer ce conflit : aucun déplacement valide n’est possible.
```

### Conflict supprimé

```txt
Conflit supprimé.
```

### Appearance skipped

```txt
Passage repoussé au slot suivant.
```

### Appearance skipped avec link retiré

```txt
Le link a été retiré et le passage a été repoussé.
```

### Participant marqué parti

```txt
Musicien marqué comme parti. Ses prochains passages ont été retirés.
```

### Suppression participant refusée

```txt
Ce participant a déjà joué. Vous pouvez le marquer comme parti.
```

### Instrument masqué

```txt
Instrument masqué du tableau et du drawer d’appel.
```

### Appearance supprimée

```txt
Passage supprimé.
```

### Hole supprimé

```txt
Trou supprimé.
```

### Undo

```txt
Dernière action annulée.
```

## 14.3 Dialogs recommandés

### Masquer un instrument sans link actif

```txt
Masquer cet instrument ?

Il disparaîtra du tableau et du drawer d’appel. Les passages déjà joués resteront dans l’historique.

[Annuler] [Masquer]
```

### Masquer un instrument avec links actifs

```txt
Masquer cet instrument ?

Cet instrument contient des passages liés à d’autres cards. Les links concernés ne seront plus pris en compte dans le tableau visible. Les passages déjà joués resteront dans l’historique.

[Annuler] [Masquer quand même]
```

### Supprimer une appearance sans link

```txt
Supprimer ce passage ?

Le musicien restera inscrit, mais ce passage sera retiré.

[Annuler] [Supprimer]
```

### Supprimer une appearance avec link

```txt
Supprimer ce passage ?

Ce passage est lié à d’autres cards. Les links associés seront retirés. Le musicien restera inscrit.

[Annuler] [Supprimer]
```

### Supprimer un hole sans link

```txt
Supprimer ce trou ?

[Annuler] [Supprimer]
```

### Supprimer un hole avec link

```txt
Supprimer ce trou ?

Ce trou est lié à une autre card. Le link associé sera retiré.

[Annuler] [Supprimer]
```

### Marquer un participant comme parti

```txt
Marquer ce musicien comme parti ?

Ses prochains passages seront retirés. Ses passages déjà joués resteront dans l’historique.

[Annuler] [Marquer comme parti]
```

### Marquer un participant comme parti avec futures appearances lockées

```txt
Marquer ce musicien comme parti ?

Ce musicien a des passages verrouillés à venir. Ils seront retirés si vous le marquez comme parti.

[Annuler] [Marquer comme parti]
```

### Supprimer un participant jamais joué

```txt
Supprimer ce participant ?

Il sera retiré de la jam. Cette action peut être annulée avec Undo.

[Annuler] [Supprimer]
```

### Retirer une participation

```txt
Retirer cet instrument ?

Les prochains passages du musicien sur cet instrument seront retirés.

[Annuler] [Retirer]
```

### Choix du scope conflict

```txt
Ce conflit s’applique à quoi ?

Seulement ce passage : ces deux cards ne joueront pas ensemble maintenant.
En général : ces deux participations ne joueront jamais ensemble ce soir.

[Annuler] [Seulement ce passage] [En général]
```

## 14.4 Animations recommandées

### Déplacement de cards

À utiliser pour :

- `link_created` si la stratégie déplace des targets ;
- `conflict_created` si une target est déplacée ;
- `appearance_moved_between` ;
- `hole_moved_between` ;
- `appearance_skipped` ;
- `participant_marked_left` si des futures appearances disparaissent ;
- `participation_removed` ;
- `appearance_removed` ;
- `hole_removed` ;
- `transaction_reverted` si la projection change plusieurs positions.

Règles :

```txt
- Durée cible : 800ms à 1000ms.
- Les cards ne doivent pas se téléporter.
- Les cards jouées restent visuellement stables.
- Les cards lockées ne bougent pas.
- Si plusieurs cards bougent, animer tous les déplacements dans une même transition.
```

### Changement de mode tableau

À utiliser pour :

- mode link ;
- mode conflict.

Règles :

```txt
- Teinte de fond différente selon le mode.
- Cards sélectionnables mises en évidence.
- Cards non sélectionnables désactivées visuellement.
- Card d’ouverture visible comme élément de sélection UI, sans effet métier d’anchor.
- Boutons Valider / Annuler fixes et accessibles.
```

# 15. Points validés suite aux questions

## 15.1 Ajout participant via gap dans un round supérieur

Décision mise à jour : hors V0, déplacé en V1.

Règle V0 : aucun ajout participant via gap entre cards. Toute nouvelle participation démarre au round 1 et reçoit une appearance à la fin de chaque round déjà visible de son instrument.

## 15.2 `appearance_skipped` sur une card linkée

Validé : ne pas repousser le groupe linké.

Règle : supprimer/désactiver le link concerné, puis repousser uniquement l’appearance skippée.

## 15.3 Instrument hidden et links existants

Validé : afficher un warning spécifique si l’instrument masqué a des links actifs, mais autoriser la confirmation.

# 16. Points encore à confirmer

## Q1 — Average position

Reco inscrite dans cette spec :

```txt
average_position choisit la position entière la plus proche de la moyenne, tie vers le haut.
```

À confirmer : est-ce que tu préfères tie vers le bas / plus tard pour éviter de trop remonter les gens ?


## Addendum V0 — contraintes inter-colonnes et résolution post-action

Cette section renforce la règle de résolution d’ordre définie dans `order-resolution-hierarchy-spec.md`.

- Les `links` et les `conflicts` sont uniquement **inter-colonnes** en V0. Ils ne peuvent pas être créés entre deux cards du même instrument.
- Un `conflict` est une contrainte **bidirectionnelle** : le sens `A → C` ou `C → A` ne change pas l’interdiction de cohabitation. Le sens de création ne doit pas orienter la résolution ; seuls un drag manuel ou une autre dernière action utilisateur peuvent fournir une intention prioritaire.
- À chaque transaction, le resolver doit vérifier les conflicts actifs dans les deux sens, quelle que soit la colonne touchée par l’action.
- Une card ayant un link ou un conflict reste draggable tant qu’elle n’est ni `played` ni `locked`.
- Après un drag, le resolver applique les conséquences : les cards linkées suivent la card déplacée si possible ; les conflicts qui deviennent actifs sur la nouvelle ligne déplacent la card ou le groupe au coût valide le plus faible selon `RESOLUTION_COST`.
- Si la réparation la moins coûteuse ne peut pas descendre, le resolver peut chercher un slot valide au-dessus afin de résoudre immédiatement le conflict sans attendre l’ajout d’une autre participation.
- Aucune résolution induite ne peut déplacer une card `played` ou `locked`.


## Règles de correction validées — resolver et UI cards

- Lors d’un déplacement manuel qui active un conflict, la card déplacée devient l’anchor de la résolution : si A et C sont en conflict et que l’organisateur déplace A sur la ligne de C, C doit être déplacé si C est mobile.
- Les conflicts automatiques `reason: instrument_constraint` entre deux participations d’un même participant suivent exactement le même flow de résolution que les conflicts manuels : contrainte inter-colonnes, bidirectionnelle, résolue par le moteur d’ordre.
- Marquer un plateau joué doit figer toutes les colonnes visibles sur cette ligne. Les instruments sans card reçoivent un hole joué `played_empty_slot` avant `plateau_played`.
- Dans le menu secondaire d’une card appearance, l’UI affiche une seule action participant : `Supprimer participant` si le participant n’a jamais joué, sinon `Musicien parti`.
- Les appearances explicitement matérialisées par une création de link multi-instruments doivent hériter du `participantId` de leur participation afin d’afficher le vrai nom du musicien, jamais le fallback “Musicien”.


## Addendum — redo V0

Le redo est représenté par un event dédié `transaction_redone`.

Règles :

- `undo` = `transaction_reverted` ;
- `redo` = `transaction_redone` ;
- le redo cible une transaction complète précédemment annulée ;
- le redo est linéaire : seule la dernière transaction redoable peut être rétablie ;
- si une nouvelle action métier est enregistrée après un undo, la pile redo est invalidée ;
- le redo ne duplique pas les events métier : la projection réactive la transaction cible au moment du replay ;
- l’event log conserve l’historique complet des undo/redo.

Payload :

```js
{
  targetTransactionId: "transaction_x",
  targetClientSequenceNumber: 12,
  reason: "organizer_redo"
}
```

## Addendum — link manuel contre conflit actif

Quand l’organisateur crée manuellement un link entre deux cards qui ont déjà un conflict actif, l’UI ne doit pas refuser silencieusement.

Comportement V0 :

1. afficher un dialog explicite ;
2. proposer `Désactiver le conflit et créer le link` ;
3. si confirmé, enregistrer dans la même transaction les `conflict_removed` nécessaires puis `link_created` ;
4. si annulé, ne rien modifier.

Le conflict reste prioritaire dans le resolver tant qu’il existe. Le link manuel devient possible uniquement parce que l’utilisateur accepte explicitement de supprimer le conflict contradictoire.

## Addendum — doublon de nom participant à l’ajout

Si un organisateur saisit le nom d’un participant déjà existant dans le drawer d’ajout, l’UI doit proposer d’ajouter les instruments sélectionnés au participant existant au lieu de créer un doublon.

Exemple :

- `Léo` existe déjà à la guitare ;
- l’organisateur saisit `Léo` avec `Basse` ;
- l’UI propose `Ajouter Basse à Léo`.

Si l’organisateur veut deux participants distincts, il doit changer le nom. La création d’un participant distinct avec le même nom reste refusée.

## Mise à jour — suppression de link via mode link

La suppression d’un link manuel se fait via le mode link du tableau.

Comportement attendu :

- ouvrir le mode link depuis une card déjà liée pré-sélectionne toutes les targets du groupe link actif ;
- désélectionner les autres cards et valider crée une transaction contenant `link_removed` ;
- si la sélection finale contient moins de deux cards après fusion/réduction du groupe, aucun `link_created` n’est émis ;
- le bouton `Valider` doit rester actif lorsqu’un link existant peut être supprimé ;
- une suppression de link ne doit pas provoquer de retour magique de l’ordre courant ;
- si une target est retirée d’un link de trois targets ou plus, le builder émet `link_removed` pour l’ancien groupe puis `link_created` pour le groupe restant ;
- si un nouveau link touche une target déjà linkée, tous les groupes touchés sont fusionnés en un seul link actif.
