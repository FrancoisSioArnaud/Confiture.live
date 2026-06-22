# Event Payloads Reference — Confiture.live

## 1. Objectif

Ce fichier définit les payloads des events V0.

Il doit permettre à Codex d’implémenter :

- les events côté frontend ;
- la validation légère côté backend ;
- l’enregistrement dans `JamEvent` ;
- le replay déterministe par le moteur de projection ;
- l’undo par transaction.

La source de vérité est l’eventLog.

---


## Convention canonique des IDs resolver

Pour le resolver V0, les appearances doivent utiliser un id déterministe :

```txt
appearanceId = appearance_${participationId}_${appearanceIndex}
```

`appearance_{uuid}` est interdit pour les appearances calculées ou futures. Les holes, links, conflicts, transactions et events peuvent rester en `{type}_{uuid}`.

Noms d’events canoniques côté resolver : `participant_marked_left`, `instrument_visibility_changed`, `instrument_round_visibility_changed`, `plateau_played`, `plateau_unplayed`. Les anciens alias comme `participant_marked_left`, `instrument_round_visibility_changed` et `plateauIndex` sont uniquement des concepts legacy/migration, jamais des sources de vérité du resolver.

## 2. Enveloppe de transaction

Une action UI peut produire plusieurs events. Ces events sont regroupés dans une transaction.

```js
{
  transactionId: "transaction_01H...",
  jamId: "jam_01H...",
  clientId: "client_01H...",
  clientSequenceNumber: 42,
  serverSequenceNumberStart: null,
  createdAt: "2026-06-14T19:00:00.000Z",
  schemaVersion: 1,
  source: "organizer_ui",
  label: "Ajouter Nicolas",
  events: []
}
```

Règles :

- `transactionId` est généré côté client ;
- `clientSequenceNumber` est strictement croissant par jam et client actif ;
- le serveur attribue les `serverSequenceNumber` ;
- une transaction doit être idempotente ;
- le backend doit ignorer proprement une transaction déjà reçue.

---


## 2.1 Résolution d’ordre après transaction

Les payloads d’events décrivent l’intention utilisateur, pas nécessairement tous les déplacements induits.

Après chaque transaction appliquée, le moteur doit appeler :

```js
resolveOrderAfterTransaction(state, context)
```

Le context doit permettre de dériver l’anchor :

| Event | Anchor dérivable |
|---|---|
| `appearance_moved_between` | `payload.appearanceId` |
| `hole_moved_between` | `payload.holeId` |
| `link_created` | pas d’anchor ; le link est non orienté |
| `conflict_created` | champ legacy/trace seulement ; ne doit pas orienter la résolution |
| `participation_added` | nouvelle appearance de la participation |
| `hole_added` | `payload.holeId` |
| `appearance_skipped` | `payload.appearanceId` + replacement |
| `plateau_played` | `payload.targets` |
| lock/unlock | target lockée/unlockée |

Même payload + même eventLog + même configuration = même ordre final.

## 3. Enveloppe d’event

```js
{
  eventId: "event_01H...",
  transactionId: "transaction_01H...",
  jamId: "jam_01H...",
  type: "participant_created",
  payload: {},
  createdAt: "2026-06-14T19:00:00.000Z",
  clientId: "client_01H...",
  clientSequenceNumber: 42,
  eventIndexInTransaction: 0,
  serverSequenceNumber: null,
  schemaVersion: 1
}
```

Règles :

- `eventIndexInTransaction` fixe l’ordre interne d’une transaction ;
- aucun payload ne doit contenir des labels dupliqués inutilement ;
- préférer les IDs stables ;
- les noms humains ne doivent être stockés que dans les events qui créent ou modifient directement ces noms.

---

## 4. Format des IDs

IDs générés côté client.

Recommandation : préfixe lisible + ULID/UUID.

Exemples :

```txt
jam_...
instrument_...
participant_...
participation_...
appearance_...
hole_...
link_...
conflict_...
transaction_...
event_...
client_...
snapshot_...
```

---

## 5. Events jam

### 5.1 `jam_created`

UI : création de jam.

Feedback : silent, car l’utilisateur arrive directement sur la page jam.

```js
{
  type: "jam_created",
  payload: {
    jamId: "jam_...",
    name: "Jam du mercredi",
    indicativeDate: "2026-06-17",
    linkReorderStrategy: "move_to_first"
  }
}
```

Effet : initialise la jam.

---

### 5.2 `jam_updated`

UI : modale configuration jam.

Feedback : snackbar.

```js
{
  type: "jam_updated",
  payload: {
    name: "Jam du jeudi",
    indicativeDate: "2026-06-18"
  }
}
```

Effet : modifie les métadonnées. Aucun impact sur l’ordre du tableau.

---

### 5.3 `jam_link_reorder_strategy_changed`

UI : modale configuration jam.

Feedback : snackbar.

```js
{
  type: "jam_link_reorder_strategy_changed",
  payload: {
    previousStrategy: "move_to_first",
    nextStrategy: "average_position"
  }
}
```

Valeurs autorisées :

```txt
move_to_first
move_to_last
average_position
```

Effet : change la stratégie utilisée pour les futurs `link_created`. Ne recalcule pas les links existants.

---

## 6. Events instruments

### 6.1 `instrument_added`

UI : création/édition jam.

Feedback : silent ou snackbar légère selon contexte.

```js
{
  type: "instrument_added",
  payload: {
    instrumentId: "instrument_...",
    label: "Saxophone",
    orderKey: "a3",
    visible: true,
    isDefault: false
  }
}
```

Effet : ajoute une colonne vide visible.

---

### 6.2 `instrument_updated`

UI : modale configuration jam.

Feedback : silent.

```js
{
  type: "instrument_updated",
  payload: {
    instrumentId: "instrument_...",
    label: "Sax"
  }
}
```

Effet : renomme l’instrument. Aucun impact d’ordre.

---

### 6.3 `instruments_reordered`

UI : modale configuration jam.

Feedback : silent + animation horizontale éventuelle.

```js
{
  type: "instruments_reordered",
  payload: {
    orderedInstrumentIds: [
      "instrument_vocals",
      "instrument_guitar",
      "instrument_bass",
      "instrument_drums"
    ]
  }
}
```

Effet : change l’ordre horizontal des colonnes, pas l’ordre vertical des cards.

---

### 6.4 `instrument_visibility_changed`

UI : modale configuration jam.

Feedback : dialog obligatoire si l’instrument contient des participations/appearances/links, puis snackbar.

```js
{
  type: "instrument_visibility_changed",
  payload: {
    instrumentId: "instrument_...",
    visible: false,
    confirmedDespiteActiveLinks: true
  }
}
```

Effet : masque la colonne et retire l’instrument du drawer d’appel. Ne supprime pas l’historique.

---

### 6.5 `instrument_round_visibility_changed`

UI : bouton “Afficher le round suivant” en bas de colonne.

Feedback : silent + animation d’apparition.

```js
{
  type: "instrument_round_visibility_changed",
  payload: {
    instrumentId: "instrument_guitar",
    visibleRoundCount: 2
  }
}
```

Effet : affiche un round supplémentaire pour cet instrument. Ne change pas la vérité métier.

---

## 7. Events participants

### 7.1 `participant_created`

UI : drawer participant, création.

Feedback : silent, l’apparition des cards suffit.

```js
{
  type: "participant_created",
  payload: {
    participantId: "participant_...",
    name: "Nicolas"
  }
}
```

Effet : crée une personne. Aucun impact direct sur les colonnes sans `participation_added`.

---

### 7.2 `participant_updated`

UI : drawer participant.

Feedback : silent pour changement de nom. Snackbar si la modification inclut ajout d’instrument via transaction complète.

```js
{
  type: "participant_updated",
  payload: {
    participantId: "participant_...",
    name: "Nico"
  }
}
```

Effet : change le nom affiché. Aucun impact d’ordre.

---

### 7.3 `participant_removed`

UI : menu trois-points d’une card, uniquement si le participant n’a jamais joué.

Feedback : dialog obligatoire + snackbar.

```js
{
  type: "participant_removed",
  payload: {
    participantId: "participant_..."
  }
}
```

Effet : retire participant, participations et appearances futures. Interdit si au moins une appearance du participant est played. Dans ce cas, suggérer “Marquer comme parti”.

---

### 7.4 `participant_marked_left`

UI : menu trois-points d’une card → “Musicien parti”.

Feedback : dialog obligatoire + snackbar.

```js
{
  type: "participant_marked_left",
  payload: {
    participantId: "participant_...",
    confirmedDespiteFutureLockedAppearances: true
  }
}
```

Effet : retire toutes les appearances futures du participant, garde l’historique joué.

---

## 8. Events participations

### 8.1 `participation_added`

UI : drawer participant, ou drawer édition participant pour ajout d’un instrument.

L’insertion entre deux cards est hors V0 et déplacée en V1.

Feedback : silent si nouveau participant ; snackbar si ajout d’un instrument à participant existant ou si plusieurs rounds impactés.

```js
{
  type: "participation_added",
  payload: {
    participationId: "participation_...",
    participantId: "participant_...",
    instrumentId: "instrument_guitar",
    customInstrumentLabel: null,
    insertionMode: "end_of_visible_rounds",
    startAppearanceIndex: 1,
    afterTarget: null,
    beforeTarget: null,
    baseOrderKey: "order_..."
  }
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

Effet : crée une participation et les appearances nécessaires à partir du round 1. Si plusieurs rounds sont déjà visibles, la nouvelle participation reçoit une appearance à la fin de chaque round visible.

---

### 8.2 `participation_removed`

UI : drawer participant, retrait d’un instrument.

Feedback : dialog si appearances/links/locks existent, puis snackbar.

```js
{
  type: "participation_removed",
  payload: {
    participationId: "participation_...",
    confirmedDespiteLinksOrLocks: true
  }
}
```

Effet : retire cette inscription instrumentale. Ne supprime pas le participant.

---

## 9. Events appearances

### 9.1 `appearance_materialized`

UI : interne, produit par une action ciblant une appearance calculée.

Feedback : silent.

```js
{
  type: "appearance_materialized",
  payload: {
    appearanceId: "appearance_...",
    participationId: "participation_...",
    instrumentId: "instrument_guitar",
    appearanceIndex: 2,
    positionKey: "pos_..."
  }
}
```

Effet : donne une identité stable à une appearance.

---

### 9.2 `appearance_moved_between`

UI : drag vertical dans une colonne.

Feedback : silent si simple ; snackbar si groupe linké déplacé. Animation obligatoire.

```js
{
  type: "appearance_moved_between",
  payload: {
    appearanceId: "appearance_...",
    instrumentId: "instrument_guitar",
    afterTarget: { type: "appearance", id: "appearance_a" },
    beforeTarget: { type: "appearance", id: "appearance_b" },
    movedLinkedGroup: false
  }
}
```

Effet : exprime l’intention de déplacer l’appearance. Le resolver global déplace aussi le groupe linké ou les cards conflictuelles si nécessaire. Si l’appearance déplacée n’est pas linkée mais décale une target linkée via `beforeTarget` ou `afterTarget`, le resolver conserve le déplacement et réaligne le groupe autour de la target linkée décalée.

---

### 9.3 `appearance_locked`

UI : icône lock sur card.

Feedback : silent + changement visuel.

```js
{
  type: "appearance_locked",
  payload: {
    appearanceId: "appearance_..."
  }
}
```

Effet : verrouille strictement l’appearance.

---

### 9.4 `appearance_unlocked`

UI : icône unlock sur card.

Feedback : silent + changement visuel.

```js
{
  type: "appearance_unlocked",
  payload: {
    appearanceId: "appearance_..."
  }
}
```

Effet : retire le verrou. Ne déclenche pas de recalcul immédiat.

---

### 9.5 `appearance_skipped`

UI : drawer d’appel, musicien introuvable.

Feedback : snackbar + animation de report/remplacement.

```js
{
  type: "appearance_skipped",
  payload: {
    appearanceId: "appearance_...",
    instrumentId: "instrument_guitar",
    originalPlateauIndex: 3,
    replacement: {
      mode: "appearance",
      appearanceId: "appearance_replacement_..."
    },
    createdHoleId: null,
    removedLinkIds: ["link_..."],
    confirmedDelink: true
  }
}
```

Modes replacement :

```txt
appearance
hole
none
```

Si “Plateau sans [instrument manquant]” :

```js
replacement: { mode: "hole", holeId: "hole_..." }
```

Effet : delink si besoin, repousse uniquement l’appearance skippée, remplace son slot par un remplaçant ou un hole.

---

### 9.6 `appearance_removed`

UI : menu trois-points → “Supprimer ce passage”.

Feedback : dialog obligatoire + snackbar. Dialog mentionne si l’appearance a un link.

```js
{
  type: "appearance_removed",
  payload: {
    appearanceId: "appearance_...",
    confirmedDespiteLink: true
  }
}
```

Effet : supprime uniquement cette occurrence.

---

## 10. Events holes

### 10.1 `hole_added`

UI V0 : jouer sans, drawer d’appel “Plateau sans [instrument manquant]”. L’insertion entre cards est hors V0.

Feedback : silent ou snackbar selon contexte.

```js
{
  type: "hole_added",
  payload: {
    holeId: "hole_...",
    instrumentId: "instrument_drums",
    appearanceIndex: 1,
    reason: "manual",
    afterTarget: { type: "appearance", id: "appearance_a" },
    beforeTarget: { type: "appearance", id: "appearance_b" },
    positionKey: "pos_...",
    targetResolvedRow: null
  }
}
```

Reasons :

```txt
manual
play_without
call_drawer_without_musician
played_empty_slot
```

Règles `targetResolvedRow` :

```txt
- `targetResolvedRow` est normalement null/absent pour `manual`, `play_without` et `call_drawer_without_musician` ; ces holes sont placés par l’intention relative puis par le resolver.
- `targetResolvedRow` est obligatoire pour `reason: played_empty_slot` ; il correspond au `playedResolvedRow` du plateau joué.
- Un hole `played_empty_slot` est inclus dans `plateau_played.targets` dans la même transaction et devient immédiatement fixed/played.
```

---

### 10.2 `hole_removed`

UI : menu trois-points d’un hole.

Feedback : dialog obligatoire + snackbar. Dialog mentionne si le hole a un link.

```js
{
  type: "hole_removed",
  payload: {
    holeId: "hole_...",
    confirmedDespiteLink: true
  }
}
```

Effet : supprime uniquement le hole.

---

### 10.3 `hole_moved_between`

UI : drag vertical d’un hole.

Feedback : silent ou snackbar si hole linké. Animation obligatoire.

```js
{
  type: "hole_moved_between",
  payload: {
    holeId: "hole_...",
    instrumentId: "instrument_drums",
    afterTarget: { type: "appearance", id: "appearance_a" },
    beforeTarget: { type: "appearance", id: "appearance_b" },
    movedLinkedGroup: false
  }
}
```

Effet : exprime l’intention de déplacer le hole si non played et non locked. Le resolver global déplace aussi le groupe linké ou les cards conflictuelles si nécessaire. Si le hole déplacé décale une target linkée via `beforeTarget` ou `afterTarget`, le resolver conserve le déplacement et réaligne le groupe autour de la target linkée décalée.

---

### 10.4 `hole_locked`

```js
{
  type: "hole_locked",
  payload: {
    holeId: "hole_..."
  }
}
```

---

### 10.5 `hole_unlocked`

```js
{
  type: "hole_unlocked",
  payload: {
    holeId: "hole_..."
  }
}
```

---

## 11. Events links

### 11.1 `link_created`

UI : bouton link sur card → mode link tableau → validation.

Feedback : snackbar si déplacement + animation.

```js
{
  type: "link_created",
  payload: {
    linkId: "link_...",
    targets: [
      { type: "appearance", id: "appearance_..." },
      { type: "hole", id: "hole_..." }
    ],
    reorderStrategy: "move_to_first"
  }
}
```

Effet : crée une contrainte de link non orientée. Le resolver global aligne les targets selon la stratégie sans violer played, locked ou conflict. Le payload ne contient pas d’anchor : créer le link depuis n’importe quelle target doit produire le même groupe. Un link actif doit toujours contenir au moins deux targets. Les drags ultérieurs restent autorisés autour d’une target linkée : si une autre card décale cette target, le groupe linké suit la target décalée plutôt que d’annuler le déplacement manuel.

---

### 11.2 `link_removed`

UI : mode link tableau depuis une card déjà linkée.

Feedback : snackbar.

```js
{
  type: "link_removed",
  payload: {
    linkId: "link_..."
  }
}
```

Effet : supprime la contrainte. Ne réorganise pas immédiatement.

---

## 12. Events conflicts

### 12.1 `conflict_created`

UI : mode conflict tableau.

Feedback : dialog de scope + snackbar. Animation si déplacement.

```js
{
  type: "conflict_created",
  payload: {
    conflictId: "conflict_...",
    scope: "participation",
    targetIds: ["participation_a", "participation_b"],
    reason: "instrument_constraint"
  }
}
```

Effet `scope: participation` : le conflict s’applique à toutes les appearances actuelles et futures des participations ciblées. Quand un round suivant est révélé, le resolver doit réévaluer ce conflict et séparer les nouvelles appearances si elles tombent sur le même plateau. Aucun nouvel event n’est nécessaire pour propager le conflict au round suivant.

Pour conflict appearance :

```js
{
  type: "conflict_created",
  payload: {
    conflictId: "conflict_...",
    scope: "appearance",
    targetIds: ["appearance_a", "appearance_b"],
    reason: "manual"
  }
}
```

---

### 12.2 `conflict_removed`

UI : mode conflict tableau, désélection d’un conflict existant, validation.

Feedback : snackbar.

```js
{
  type: "conflict_removed",
  payload: {
    conflictId: "conflict_..."
  }
}
```

Effet : retire la contrainte. Le resolver est relancé mais préserve l’ordre courant si aucune contrainte active n’oblige à bouger.

---

## 13. Events plateau

### 13.1 `plateau_played`

UI : bouton plateau joué, ou drawer d’appel.

Feedback : silent ou snackbar optionnelle. Cards grisées.

```js
{
  type: "plateau_played",
  payload: {
    visualIndex: 3,
    playedResolvedRow: 4,
    targets: [
      { type: "appearance", id: "appearance_..." },
      { type: "hole", id: "hole_..." }
    ],
    playedAt: "2026-06-14T21:00:00.000Z"
  }
}
```

Effet : targets immobiles et jouées. `visualIndex` est l’intention UI ; `playedResolvedRow` est la row logique calculée depuis le layout courant au moment de l’action. Avant de créer `plateau_played`, le frontend doit ajouter un `hole_added` `reason: played_empty_slot` avec `targetResolvedRow = playedResolvedRow` dans chaque colonne visible qui n’a aucune card sur cette row. Le `plateau_played.targets` doit inclure ces holes. Ainsi, un instrument vide au moment où le plateau est joué conserve une trace jouée et aucune nouvelle participation future ne peut venir occuper rétroactivement cette ligne.

---

### 13.2 `plateau_unplayed`

UI : action secondaire, dernier plateau joué uniquement en V0.

Feedback : dialog si nécessaire + snackbar.

```js
{
  type: "plateau_unplayed",
  payload: {
    visualIndex: 3,
    playedResolvedRow: 4,
    targets: [
      { type: "appearance", id: "appearance_..." },
      { type: "hole", id: "hole_..." }
    ]
  }
}
```

---

## 14. Undo

### 14.1 `transaction_reverted`

UI : bouton undo global.

Feedback : snackbar + animation des changements.

```js
{
  type: "transaction_reverted",
  payload: {
    targetTransactionId: "transaction_...",
    targetClientSequenceNumber: 41,
    reason: "organizer_undo"
  }
}
```

Règles :

- undo linéaire strict ;
- pas d’undo arbitraire ;
- l’historique est conservé ;
- la projection ignore les events de la transaction ciblée.

---

## 15. Events explicitement exclus V0

Ne pas créer ces events :

```txt
link_updated
conflict_updated
participation_updated
appearance_note_updated
participation_note_updated
play_without_created
play_without_removed
plateau_composition_forced
event_reverted arbitraire
```

---

## 16. Transactions types recommandées

### Nouveau participant multi-instruments

```txt
participant_created
participation_added chant
participation_added guitare
conflict_created chant/guitare si non linkés
link_created si l’organisateur choisit de les faire ensemble
```

### Ajouter un instrument à un participant existant

```txt
participation_added
conflict_created avec les participations incompatibles existantes
éventuels link_created si demandé
```

### Jouer sans batterie

```txt
hole_added reason: play_without
link_created appearance + hole
```

### Musicien introuvable avec remplaçant

```txt
éventuel link_removed si skipped était linké
éventuel link_removed si remplaçant était linké et confirmation
appearance_skipped
appearance_moved_between pour le remplaçant si nécessaire
```

### Musicien introuvable, Plateau sans [instrument manquant]

```txt
hole_added reason: call_drawer_without_musician
éventuel link_removed pour l’appearance skippée
appearance_skipped
```


## Addendum V0 — contraintes inter-colonnes et résolution post-action

Cette section renforce la règle de résolution d’ordre définie dans `order-resolution-hierarchy-spec.md`.

- Les `links` et les `conflicts` sont uniquement **inter-colonnes** en V0. Ils ne peuvent pas être créés entre deux cards du même instrument.
- Un `conflict` est une contrainte **bidirectionnelle** : le sens `A → C` ou `C → A` ne change pas l’interdiction de cohabitation et ne définit pas d’anchor de résolution.
- À chaque transaction, le resolver doit vérifier les conflicts actifs dans les deux sens, quelle que soit la colonne touchée par l’action.
- Une card ayant un link ou un conflict reste draggable tant qu’elle n’est ni `played` ni `locked`.
- Après un drag, le resolver applique les conséquences : les cards linkées suivent la card déplacée si possible ; les conflicts qui deviennent actifs sur la nouvelle ligne déplacent la card ou le groupe au coût valide le plus faible selon `RESOLUTION_COST`.
- Si la réparation la moins coûteuse ne peut pas descendre, le resolver peut chercher un slot valide au-dessus afin de résoudre immédiatement le conflict sans attendre l’ajout d’une autre participation.
- Aucune résolution induite ne peut déplacer une card `played` ou `locked`.


### Addendum `transaction_redone`

`transaction_redone` rétablit linéairement une transaction précédemment annulée par `transaction_reverted`.

```js
{
  type: "transaction_redone",
  payload: {
    targetTransactionId: "transaction_x",
    targetClientSequenceNumber: 12,
    reason: "organizer_redo"
  }
}
```

Le payload est volontairement symétrique à `transaction_reverted`, avec `reason: "organizer_redo"`.

Un `transaction_redone` non linéaire est ignoré par la projection et génère un warning déterministe.
