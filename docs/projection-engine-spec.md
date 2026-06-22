# Projection Engine Spec — Confiture.live

## 1. Objectif

Le moteur de projection est le cœur de Confiture.live.

Il doit reconstruire de manière déterministe l’état complet d’une jam à partir de :

1. un `eventLog` ordonné ;
2. éventuellement un `snapshot` valide ;
3. les transactions non annulées ;
4. la configuration courante de la jam.

Principe non négociable :

```txt
snapshot + events actifs → projection déterministe → tableau affiché
```

La projection est une donnée calculée. Elle ne doit jamais devenir la source de vérité principale. La source de vérité reste l’historique des transactions et des events.

---

## 2. Fichiers de référence

Ce fichier doit être lu avec :

- `product-spec.updated.md` ;
- `technical-stack.updated.md` ;
- `confiture_event_actions_spec.md` ;
- `sync_strategy.md` ;
- `data_model.md` ;
- `visual_spec_table.md` ;
- `visual_spec_table_cards.md` ;
- `event-payloads-reference.md` ;
- `order-resolution-hierarchy-spec.md`;
- `order-resolution-golden-fixtures.md`.

En cas de conflit, l’ordre de priorité est :

1. `event-payloads-reference.md` pour les payloads ;
2. `order-resolution-hierarchy-spec.md` pour la hiérarchie d’ordre, la résolution des contraintes, les contrats JSDoc et la table event → context ;
3. ce fichier pour les règles générales de projection ;
4. `confiture_event_actions_spec.md` pour les règles produit d’action ;
5. les fichiers visuels pour le rendu UI.

---

## 3. Règles générales

### 3.1 Le moteur doit être pur

Le moteur ne doit pas dépendre de React, Zustand, Dexie, MUI, du backend ou du DOM.

Il doit être implémenté comme un module pur :

```js
projectJamState({ snapshot, transactions, events }) => projection
```

Entrée identique = sortie identique.

Aucun `Date.now()`, `Math.random()`, appel réseau ou lecture de stockage local ne doit exister dans le moteur.

---

### 3.2 Les events sont appliqués dans l’ordre strict

Ordre d’application :

```txt
serverSequenceNumber croissant si disponible
sinon clientSequenceNumber croissant
sinon createdAt + eventId uniquement pour fallback debug, jamais pour la logique normale
```

En usage normal, chaque event doit avoir :

```txt
transactionId
clientSequenceNumber
serverSequenceNumber après sync
```

---

### 3.3 Undo linéaire uniquement

L’undo est représenté par un event `transaction_reverted`.

Règle V0 : undo linéaire strict.

Pour annuler la transaction 4, les transactions 5, 6 et 7 doivent déjà avoir été annulées.

La projection ignore les events des transactions annulées.

Il ne doit pas y avoir d’undo arbitraire d’une transaction ancienne si des transactions ultérieures sont encore actives.

---

### 3.4 La projection peut produire des warnings internes

Le moteur doit retourner une liste `projectionWarnings` pour les cas incohérents mais non bloquants.

Exemples :

- event ciblant une entity inexistante ;
- link avec target manquante ;
- conflict devenu inutile après suppression ;
- appearance supprimée puis déplacée par un event ultérieur ignoré ;
- resolver incapable de satisfaire une intention à cause d’un `played` ou `locked`.

Les warnings issus du resolver doivent suivre le format standard défini dans `docs/order-resolution-hierarchy-spec.md`, section `4.3 Format standard des projectionWarnings`.

Format minimal attendu :

```js
{
  type: "link_unresolvable",
  severity: "warning",
  reason: "linked_cards_fixed_on_different_rows",
  transactionId: "transaction_xxx",
  cardIds: ["appearance_a", "appearance_b"],
  message: "Impossible d’aligner ce link : plusieurs cards fixes sont sur des lignes différentes."
}
```

Ces warnings sont destinés au debug/admin, pas à l’UI organisateur sauf cas explicitement prévu.

---

### 3.5 Résolution d’ordre après chaque transaction

La projection doit appliquer les transactions dans l’ordre, puis relancer le moteur de résolution d’ordre après chaque transaction active.

Flux obligatoire :

```txt
state initial
→ appliquer events transaction 1
→ resolveOrderAfterTransaction(state, context transaction 1)
→ appliquer events transaction 2
→ resolveOrderAfterTransaction(state, context transaction 2)
→ état final
```

Le resolver doit être déterministe, pur et rejouable depuis zéro. Il ne doit pas dépendre de l’ordre DOM, de React, de Zustand, de Dexie ou d’un cache UI.

Le resolver officiel est spécifié dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

Les sections `4.1` à `4.29` de cette spec sont normatives pour la projection : targetRow des links, ordre exact des passes, limites d’arrêt, colonnes hidden, holes, skip, validations UI et invariants de tests.

---

### 3.6 Les déplacements induits sont des résultats de projection

Une action peut induire des déplacements en cascade.

Exemple :

```txt
A est déplacé.
A est linké à C.
A conflict avec B.
```

La transaction peut seulement exprimer l’intention principale (`A` déplacé). Le resolver produit ensuite de manière déterministe :

```txt
A reste anchor.
C suit A.
B est repoussé si possible.
```

Ces déplacements induits sont des champs calculés de projection. Ils peuvent être stockés dans un snapshot, mais ne sont pas la source de vérité principale.

---

### 3.7 Champs dérivés d’ordre

La projection peut calculer et conserver des champs dérivés comme :

```js
{
  resolvedRow: 4,
  visualIndex: 3,
  cardIndexInColumn: 1,
  previousResolvedRow: 4,
  resolvedOrderKey: "debug-only",
  positionKey: "legacy-fallback-only"
}
```

Ces champs doivent être recalculables depuis l’event log. Ils servent à stabiliser l’ordre pendant le replay, notamment pour empêcher une card `played` ou `locked` de bouger lorsqu’une nouvelle card est ajoutée.

Règles :

```txt
- `resolvedRow` est calculé par le resolver et peut être stocké dans la projection/snapshot comme cache dérivable.
- `resolvedRow` ne doit pas être persisté dans les events comme vérité finale.
- `visualIndex` est calculé après résolution pour l’affichage global compact.
- `positionKey`, `positionInRound`, `manualOrderHint`, `orderScore` et assimilés sont legacy/fallback, jamais des contraintes finales.
```


---

### 3.8 Contrat d’intégration du resolver

Le moteur de projection est responsable de préparer l’entrée du resolver et de consommer sa sortie. Le resolver ne lit pas les entities globales par lui-même.

Pipeline normatif par transaction active :

```txt
1. appliquer les events bruts sur les entities projetées ;
2. construire les cards candidates ;
3. construire links/conflicts actifs ;
4. construire `transactionContext` depuis les events de la transaction ;
5. transmettre le `previousLayout` issu de la transaction active précédente ;
6. appeler `resolveOrderAfterTransaction(input)` ;
7. stocker le `layoutByCardId` retourné comme layout courant ;
8. construire les colonnes affichables via `buildColumns()` ;
9. passer à la transaction suivante.
```

Signature d’appel attendue :

```js
const result = resolveOrderAfterTransaction({
  cards,
  links,
  conflicts,
  hiddenColumnIds,
  previousLayout,
  transactionContext,
  config
})
```

Sortie attendue :

```js
{
  layoutByCardId,
  orderedCardIdsByColumnId,
  visibleResolvedRows,
  projectionWarnings
}
```

Règles :

```txt
- `resolvedRow` est un résultat calculé, jamais une vérité d’event.
- `previousLayout` vient toujours de la transaction active précédente pendant le replay.
- Les anciens champs `position`, `positionInRound`, `manualOrderHint`, `orderScore`, `positionKey` peuvent seulement servir de fallback d’entrée.
- `buildColumns()` consomme `layoutByCardId`, mais ne recalcule jamais les contraintes.
- L’UI affiche les plateaux via `visibleResolvedRows` / `visualIndex` global, jamais via le rang local dans chaque colonne.
```

Le mapping event → `transactionContext`, le contrat d’entrée/sortie, la convention d’IDs déterministes, les schémas JSDoc, le contrat buildColumns et la DoD sont définis dans `docs/order-resolution-hierarchy-spec.md`, sections `4.16` à `4.29`. Les expected exacts des fixtures sont dans `docs/order-resolution-golden-fixtures.md`.

---


### 3.9 Verrous finaux d’intégration resolver

Le branchement projection → resolver doit appliquer les clarifications finales de `docs/order-resolution-hierarchy-spec.md`, section 4.28.

Règles obligatoires :

```txt
- appliquer tous les events d’une même transaction dans `eventIndexInTransaction` croissant avant d’appeler le resolver ;
- appeler le resolver une seule fois par transaction complète ;
- convertir `visualIndex` UI de `plateau_played` en `playedResolvedRow` depuis le layout courant ;
- créer les holes `played_empty_slot` avec `targetResolvedRow` obligatoire avant `plateau_played` ;
- construire `lock` depuis le `resolvedRow` courant de la card, sans inventer de row si elle manque ;
- traiter les bornes `before/after` manquantes d’un move avec warning `missing_target`, sans changer la colonne ;
- trier explicitement cards, links, conflicts et targets avant toute résolution ;
- ne jamais supprimer silencieusement une card visible active du layout partiel de sortie.
```

Si une contrainte locale est insoluble, la projection doit marquer uniquement cette contrainte comme non résolue pour la résolution courante et continuer les autres réparations possibles. Seuls `resolver_cycle_detected`, `resolver_max_passes_reached` ou une collision finale insoluble arrêtent la boucle itérative, jamais le replay complet.


## 4. Entités projetées

### 4.1 `Participant`

Personne réelle.

```js
{
  participantId: "participant_...",
  name: "Nicolas",
  status: "active" | "left" | "removed",
  createdAtEventId,
  removedAtEventId: null
}
```

Règles :

- `active` par défaut ;
- `left` retire les appearances futures mais garde l’historique joué ;
- `removed` n’est autorisé que si le participant n’a jamais joué.

---

### 4.2 `Participation`

Inscription d’un participant à un instrument.

```js
{
  participationId: "participation_...",
  participantId: "participant_...",
  instrumentId: "instrument_...",
  customInstrumentLabel: null,
  baseOrderKey: "...",
  status: "active" | "removed",
  startAppearanceIndex: 1
}
```

Règles :

- une participation ne représente pas un passage ;
- une participation peut générer plusieurs appearances ;
- le changement d’instrument direct est interdit ;
- changer d’instrument = `participation_removed` + `participation_added`.

---

### 4.3 `Appearance`

Occurrence concrète d’une participation dans un round.

```js
{
  appearanceId: "appearance_...",
  participationId: "participation_...",
  participantId: "participant_...",
  instrumentId: "instrument_...",
  appearanceIndex: 1,
  status: "active" | "removed",
  played: false,
  locked: false,
  materialized: true | false,
  positionKey: "..."
}
```

Règles :

- `appearanceIndex` commence à 1 ;
- round front = appearanceIndex ;
- les appearances sont calculées par défaut ;
- elles sont matérialisées dès qu’une action les cible ;
- ne jamais renuméroter les `appearanceIndex` matérialisés ;
- une appearance supprimée crée un trou logique dans la séquence, mais ne renumérote rien.

---

### 4.4 `Hole`

Occurrence de tableau sans musicien.

```js
{
  holeId: "hole_...",
  instrumentId: "instrument_...",
  appearanceIndex: 1,
  played: false,
  locked: false,
  status: "active" | "removed",
  positionKey: "...",
  reason: "manual" | "play_without" | "call_drawer_without_musician"
}
```

Règles :

- un hole est équivalent à une appearance sans musicien ;
- un hole peut être locké ;
- un hole joué ne peut plus bouger ;
- un hole ne génère jamais de loop future ;
- un hole peut être linké ;
- supprimer un hole ne supprime jamais l’appearance musicien linkée ;
- supprimer un hole supprime ou rend inactifs les links qui ciblent ce hole.

---

### 4.5 `Link`

Contrainte d’alignement entre targets.

```js
{
  linkId: "link_...",
  targets: [
    { type: "appearance", id: "appearance_..." },
    { type: "hole", id: "hole_..." }
  ],
  // pas d’anchor : le link est un groupe non orienté
}
```

Règles :

- un link force les targets à être sur le même plateau ;
- une target maximum par instrument ;
- les links peuvent cibler une appearance ou un hole ;
- aucun drawer de link en V0 ;
- le link est créé/modifié via le mode link du tableau ;
- si un link contredit un conflict, le conflict gagne et le link est refusé.

---

### 4.6 `Conflict`

Contrainte d’incompatibilité.

```js
{
  conflictId: "conflict_...",
  scope: "participation" | "appearance",
  targetIds: ["participation_...", "participation_..."],
  reason: "instrument_constraint" | "manual"
}
```

Règles :

- `scope: participation` = contrainte générale ;
- `scope: appearance` = contrainte ponctuelle ;
- les conflicts V0 ne ciblent pas les holes ;
- `instrument_constraint` est généré automatiquement ;
- `manual` vient du mode conflict du tableau ;
- pas de `conflict_updated` en V0 : retirer puis recréer.

---

### 4.7 `Plateau`

Un plateau est une ligne déduite du tableau.

```js
{
  visualIndex: 0,
  resolvedRow: 1,
  cells: [
    { instrumentId, targetType: "appearance", targetId: "appearance_..." },
    { instrumentId, targetType: "hole", targetId: "hole_..." }
  ],
  played: false
}
```

Le plateau n’est pas la source de vérité. Il est déduit de l’alignement des colonnes.

---

## 5. Structure de projection attendue

```js
{
  jam: {
    jamId,
    name,
    indicativeDate,
    linkReorderStrategy,
    latestAppliedSequenceNumber
  },
  instruments: {
    byId: {},
    orderedIds: []
  },
  participants: {
    byId: {},
    orderedIds: []
  },
  participations: {
    byId: {},
    byInstrumentId: {}
  },
  appearances: {
    byId: {},
    byParticipationId: {}
  },
  holes: {
    byId: {},
    byInstrumentId: {}
  },
  links: {
    byId: {},
    byTargetKey: {}
  },
  conflicts: {
    byId: {}
  },
  table: {
    layoutByCardId: {
      "appearance_...": {
        cardId: "appearance_...",
        columnId: "instrument_...",
        resolvedRow: 2,
        visualIndex: 2,
        cardIndexInColumn: 0
      }
    },
    orderedCardIdsByColumnId: {
      "instrument_...": ["appearance_...", "hole_..."]
    },
    visibleResolvedRows: [1, 2, 5],
    columns: [
      {
        instrumentId,
        visibleRoundCount,
        targets: [
          { type: "appearance", id: "appearance_...", resolvedRow: 2, visualIndex: 2 },
          { type: "hole", id: "hole_...", resolvedRow: 5, visualIndex: 3 }
        ]
      }
    ],
    plateaus: []
  },
  syncMeta: {},
  projectionWarnings: []
}
```

---

## 6. Génération des rounds et appearances

### 6.1 Rounds visibles

Chaque instrument possède un `visibleRoundCount`.

Par défaut :

```txt
visibleRoundCount = 1
```

Quand l’organisateur clique sur “Afficher le round suivant” dans une colonne :

```txt
visibleRoundCount += 1
```

Masquer un round n’est pas prévu en V0.

---

### 6.2 Appearance calculée par défaut

Pour chaque participation active d’un instrument visible, la projection peut générer une appearance calculée pour chaque round visible.

Exemple :

```txt
Participation Nicolas / Guitare
visibleRoundCount guitare = 2
→ appearance Nicolas guitare round 1
→ appearance Nicolas guitare round 2
```

Ces appearances peuvent être virtuelles tant qu’aucune action ne les cible.

---

### 6.3 Appearance matérialisée

Une appearance devient matérialisée si elle est ciblée par :

- `appearance_materialized` ;
- `appearance_moved_between` ;
- `appearance_locked` ;
- `appearance_unlocked` ;
- `appearance_skipped` ;
- `appearance_removed` ;
- `link_created` ;
- `conflict_created` scope appearance ;
- `plateau_played` ;
- `plateau_unplayed`.

Une appearance matérialisée doit conserver son `appearanceId` et son `appearanceIndex`.

---

### 6.4 Ajout standard d’une participation après reveal de plusieurs rounds

En V0, l’ajout d’une participation est toujours standard : pas d’ajout entre deux cards.

```txt
La participation démarre au round 1.
Pour chaque round déjà visible de l’instrument, créer/positionner une appearance à la fin de ce round.
Les rounds non visibles restent calculés plus tard.
```

Exemple :

```txt
Round 1 et round 2 sont visibles en guitare.
Julie est ajoutée à la guitare.
→ Julie guitare round 1 est ajoutée en fin de round 1.
→ Julie guitare round 2 est ajoutée en fin de round 2.
→ Julie guitare round 3 sera générée plus tard si round 3 est affiché.
```

Exemple d’ordre attendu :

```txt
Avant : Noé, Iris, Tom, Noé', Iris', Tom'
Ajout de Julie
Après : Noé, Iris, Tom, Julie, Noé', Iris', Tom', Julie'
```

---

### 6.5 Ajout entre deux cards

Hors V0.

Décision : l’ajout entre deux cards est déplacé en V1. La V0 ne doit pas avoir :

- de zone d’insertion entre cards ;
- d’action UI “Ajouter un participant ici” ;
- d’action UI “Ajouter un trou ici” ;
- de création de participation avec `insertionMode = between_targets` ;
- de participation démarrant au round 2+ via gap.

La base de données de V0 n’est pas en production : il n’y a pas besoin de conserver de code legacy pour relire d’anciens events `between_targets`.

---

### 6.6 Rounds visibles et ordre final

Les rounds servent à générer et identifier les appearances visibles, mais ils ne sont plus une contrainte d’ordre du tableau.

Règles :

- round 1 reste visible par défaut ;
- les rounds suivants sont révélés colonne par colonne ;
- révéler un round rend calculables/visibles les appearances correspondantes ;
- ajouter une participation alors que plusieurs rounds sont visibles crée toujours une appearance pour chaque round visible de l’instrument ;
- après génération des appearances, l’ordre final est confié au solver défini dans `docs/order-resolution-hierarchy-spec.md` ;
- le solver peut mélanger des appearances de rounds différents si cela permet de satisfaire links, conflicts, played, locked ou l’intention utilisateur.

À ne plus faire :

```txt
Trier systématiquement par appearanceIndex ASC puis positionInRound ASC.
Forcer tout le round 1 avant tout le round 2.
Refuser un ordre uniquement parce qu’une round 2 passe avant une round 1.
```

Le fallback stable peut encore utiliser `baseOrderKey` ou l’id quand aucune contrainte ne départage deux cards, mais le round ne doit pas être utilisé comme priorité de résolution.

---

## 7. Construction des colonnes

Pour chaque instrument visible :

1. récupérer les participations actives ;
2. exclure les participants `left` pour les futures appearances non jouées ;
3. générer les appearances visibles nécessaires ;
4. appliquer les suppressions d’appearances ;
5. insérer les holes actifs ;
6. appliquer les events bruts de déplacement/lock/play/skip ;
7. construire les cards visibles ;
8. appeler le solver global de réorder ;
9. récupérer l’ordre résolu pour cette colonne ;
10. produire la liste finale de targets de la colonne.

---

## 8. Ordre et positionnement

### 8.1 Pas d’index comme vérité durable

Ne jamais utiliser un index brut comme vérité principale pour les déplacements.

Préférer :

```js
previousTarget
nextTarget
positionKey
```

L’index est un résultat de projection, pas une donnée durable fiable.

---

### 8.2 Hiérarchie d’ordre officielle

La hiérarchie d’ordre complète est définie dans :

```txt
docs/order-resolution-hierarchy-spec.md
```

Le resolver n’applique plus un tri hiérarchique `round-first`. Il applique un solver de contraintes discrètes.

Résumé :

```txt
Contraintes dures :
- removed / left / hidden filtrés avant affichage
- played immobile
- locked immobile
- une seule card par colonne et par row résolue
- links alignés si possible
- conflicts séparés si possible
- card toujours dans sa colonne instrument
- `resolvedRow` comme vérité logique des plateaux
- `visualIndex` global comme vérité d’affichage compact

Contraintes soft :
- respecter l’intention de la dernière action
- minimiser le nombre de cards déplacées
- minimiser la distance de déplacement
- préserver l’ordre relatif courant quand aucune contrainte ne force un changement
- fallback stable par ordre de création puis id
```

Règles clés :

- `played` et `locked` sont des murs ;
- l’anchor de la dernière action est conservée autant que possible, mais ne bat jamais `played` ou `locked` ;
- les links sont transformés en groupes et alignés comme des blocs logiques ;
- la `targetRow` des links suit l’ordre canonique : fixed row si possible, priorité de propagation, puis stratégie `move_to_first` / `move_to_last` / `average_position` ;
- les conflicts sont bidirectionnels et doivent séparer les cards concernées ;
- une card déplacée ou poussée transmet sa priorité à ses links ;
- si une card poussée est linkée à une autre card, cette autre card gagne une priorité indirecte dans sa colonne ;
- la propagation continue jusqu’à disparition des violations, warning d’impossibilité, limite de passes ou cycle détecté ;
- les colonnes hidden ne participent pas au resolver visible ;
- les holes sont des cards normales pour ordre, lock, played et links explicites ;
- `appearance_skipped` repousse seulement l’appearance ciblée après délink ponctuel ;
- les rounds ne sont pas une contrainte d’ordre et peuvent être mélangés ;
- supprimer un link ou conflict ne restaure pas un ancien ordre : le resolver part de l’ordre courant et répare seulement ce qui reste nécessaire ;
- le plateau affiché est déduit du `visualIndex` global produit par le solver, pas du rang local d’une card dans sa colonne ;
- deux cards qui partagent le même `resolvedRow` doivent être affichées sur le même `visualIndex` global.

### 8.3 Recalcul global après modification d’ordre

Toute transaction pouvant modifier l’ordre ou les contraintes doit appeler le resolver après application de ses events.

À minima :

- ajout/retrait participation ;
- drag appearance/hole ;
- création/suppression link ;
- création/suppression conflict ;
- lock/unlock ;
- skip/remplacement depuis drawer d’appel ;
- hole ajouté/supprimé ;
- plateau played/unplayed ;
- round revealed ;
- participant left ;
- instrument hidden/shown.

La suppression d’un link ou d’un conflict ne doit pas provoquer un retour magique à un ancien ordre. Le resolver part de l’ordre résolu courant et ne bouge que ce qui est nécessaire.

Le resolver doit respecter les limites canoniques : `MAX_PASSES = 50`, `MAX_REPAIRS_PER_PASS = cards visibles * 4`, détection de `layoutHash` répété, et warnings `resolver_max_passes_reached` / `resolver_cycle_detected`.

La projection finale doit exposer pour chaque card au minimum :

```txt
resolvedRow     // logique, stable pour contraintes
visualIndex     // affichage compact global
cardIndexInColumn // rang local uniquement si utile au rendu
```

Le front ne doit pas reconstruire les plateaux avec “première/deuxième/troisième card de chaque colonne”. Il doit utiliser les `visualIndex` globaux fournis par la projection.

---

### 8.4 Effet de `left`

Quand un participant devient `left` :

- ses appearances déjà played restent visibles ;
- ses appearances futures sont retirées de la projection active ;
- aucune nouvelle appearance future n’est générée pour ses participations ;
- si des appearances futures étaient lockées, l’UI doit demander confirmation avant l’action ;
- une fois confirmé, `left` gagne sur le lock pour les futures appearances non jouées.

---

## 9. Links

Un link est un groupe non orienté de targets. Il n’a pas d’anchor et doit contenir au moins deux targets actives. Créer un link avec une target déjà linkée fusionne les groupes concernés ; retirer une target conserve le groupe restant si au moins deux targets restent, sinon le link est supprimé.


### 9.1 Création

Un link est créé via mode link du tableau.

Input logique :

```js
link_created {
  linkId,
  targets,
  reorderStrategy
}
```

La stratégie `reorderStrategy` est copiée depuis la config de jam au moment de l’action.

---

### 9.2 Stratégies de réorganisation

La jam possède une setting :

```txt
linkReorderStrategy:
- move_to_first
- move_to_last
- average_position
```

Défaut :

```txt
move_to_first
```

#### `move_to_first`

Toutes les targets non figées sont alignées sur la ligne la plus haute des targets du link.

#### `move_to_last`

Toutes les targets non figées sont alignées sur la ligne la plus basse des targets du link.

#### `average_position`

Calcul :

```txt
position cible = moyenne des positions actuelles des targets, arrondie vers la position la plus haute en cas d’égalité
```

Exemple :

```txt
positions 2 et 5 → moyenne 3.5 → cible 3
positions 2, 5, 6 → moyenne 4.33 → cible 4
```

Raison : privilégier légèrement la stabilité vers le haut et éviter de trop retarder les musiciens.

---

### 9.3 Contraintes de link

Un link est refusé avant transaction seulement si l’impossibilité est structurelle et détectable sans lancer le solver complet :

- deux targets visibles sont dans le même instrument ;
- un conflict direct existe déjà entre deux targets du link ;
- une target n’existe plus dans la projection active ;
- l’UI sait déjà que deux targets fixed du groupe sont sur des `resolvedRows` différents et que le link ne peut pas être aligné.

Le simple fait qu’une target soit `played` ou `locked` ne suffit pas à refuser le link. Si une target fixed peut servir de `targetRow` et que les autres targets sont mobiles, le link est valide. Si l’alignement devient impossible pendant le replay, le resolver garde les fixed à leur place et produit un `projectionWarning` canonique.

Un drag manuel dans une zone contenant un link n’est pas refusé pour cette seule raison. Si le drag déplace une autre card devant une target linkée, cette target linkée peut changer de plateau et les autres targets du link doivent suivre.

En cas de refus par conflict, l’UI doit afficher une snackbar explicative.

---

### 9.4 Déplacement manuel d’une target linkée

Si une card linkée est déplacée manuellement :

- l’action est autorisée si la card n’est ni `played` ni `locked` ;
- le groupe linké doit se déplacer ensemble dans l’ordre résolu final ;
- si le déplacement du groupe est impossible à cause d’une card `played` ou `locked`, le resolver garde les pins et produit un warning déterministe ;
- aucun déplacement partiel durable du groupe linké n’est autorisé dans la projection finale.

Si une card non-linkée est déplacée avant/après une target linkée :

- l’action est autorisée si la card déplacée n’est ni `played` ni `locked` ;
- le resolver garde le déplacement manuel demandé ;
- la target linkée décalée devient la référence de son groupe pour cette transaction ;
- les autres targets du link suivent cette target décalée.

Exception : `appearance_skipped` depuis le drawer d’appel délinke puis déplace seulement l’appearance indisponible.

---

### 9.5 Suppression de link

`link_removed` relance le resolver, mais ne doit pas provoquer un retour magique à un ancien ordre.

Les cards restent là où elles sont si aucune contrainte active ne les oblige à bouger.

Une future action pourra les réorganiser.

---

## 10. Conflicts

Les conflicts sont non orientés. Le sens de création ne doit pas influencer la résolution du tableau ; seule la dernière action utilisateur, notamment un drag manuel, peut devenir l’intention prioritaire. `anchorTargetId` peut rester présent dans certains payloads legacy ou de trace, mais le resolver ne doit pas s’en servir pour orienter le conflit.


### 10.1 Scope participation

Un conflict scope `participation` signifie que les appearances issues de deux participations ne doivent pas se retrouver sur le même plateau, pour toute la soirée.

Le resolver doit étendre ce conflict à toutes les appearances actives des participations ciblées : appearances déjà visibles, appearances matérialisées plus tard par `instrument_round_visibility_changed`, et appearances ajoutées par une nouvelle participation si elle est déjà concernée par un conflict de participation.

Conséquence : si `A` et `C` ont un conflict `scope: participation`, alors `A'` et `C'` doivent être séparés dès que le round suivant est révélé. Cette propagation est une conséquence de projection déterministe ; elle ne nécessite pas un nouvel event `conflict_created` pour chaque round.

Usage typique :

```txt
Nicolas guitare / Nicolas basse
```

Raison :

```txt
instrument_constraint
```

---

### 10.2 Scope appearance

Un conflict scope `appearance` concerne uniquement des passages précis.

Usage :

```txt
Nicolas guitare round 2 ne doit pas jouer avec Sarah chant round 1.
```

Raison :

```txt
manual
```

---

### 10.3 Création de conflict depuis le mode conflict

À la validation, l’UI demande :

```txt
Ce conflit concerne :
- seulement ce passage
- toute la soirée
```

Projection :

- seulement ce passage → `scope: appearance` ;
- toute la soirée → `scope: participation`.

---

### 10.4 Résolution d’un conflict nouvellement créé

Si les targets en conflict sont déjà sur le même plateau :

1. ne jamais bouger `played` ;
2. ne jamais bouger `locked` ;
3. garder l’anchor si possible ;
4. déplacer l’autre target vers le slot valide le plus proche dans sa colonne, en essayant d’abord les slots suivants puis les slots précédents si nécessaire ;
5. si impossible, refuser l’action.

---

### 10.5 Suppression de conflict

`conflict_removed` relance le resolver, mais ne doit pas provoquer un retour magique à un ancien ordre.

Les cards restent là où elles sont si aucune contrainte active ne les oblige à bouger.

Aucun `conflict_updated` en V0.

Modifier un conflict = supprimer puis recréer.

---

## 11. Appearance skipped

`appearance_skipped` remplace la logique “temporarily away”. Ce n’est pas un état durable.

Déclencheur unique : drawer d’appel, quand le musicien appelé est introuvable.

Règles canoniques de projection :

1. le skip cible une appearance précise ;
2. si l’appearance est linkée, supprimer/désactiver le link concerné pour cette appearance avant déplacement ;
3. le reste de l’ancien groupe linké reste actif et doit être réaligné si au moins deux targets restent ;
4. repousser uniquement l’appearance skippée au prochain slot valide de sa colonne ;
5. ne pas modifier les appearances futures de la participation ;
6. ne pas marquer le participant comme `left` ;
7. ne jamais déplacer une card played ou locked ;
8. si aucun slot valide n’existe, produire un warning stable.

Si un remplaçant est choisi :

- le remplaçant prend le `resolvedRow` de l’appearance skippée si possible ;
- l’appearance skippée est repoussée seule ;
- si le remplaçant était linké, l’UI doit confirmer le délink avant validation ;
- le resolver répare ensuite collisions, links restants et conflicts.

Si “Plateau sans [instrument manquant]” est choisi :

- un hole est créé à la place ;
- l’appearance skippée est repoussée seule ;
- le hole peut être played/locked comme une card normale ;
- aucun event dédié `play_without_created` n’est nécessaire.

---

## 12. Suppressions

### 12.1 `participant_removed`

Autorisé uniquement si le participant n’a jamais joué.

Si le participant a déjà joué, l’UI doit refuser et suggérer :

```txt
Marquer comme parti
```

Effet autorisé :

- retire le participant de la projection active ;
- retire ses participations non jouées ;
- retire ses appearances futures ;
- les links/conflicts associés sont ignorés ou retirés de la projection.

---

### 12.2 `appearance_removed`

Toujours demander confirmation avant suppression.

Si l’appearance a un link, le dialog doit le préciser.

Effet :

- supprime uniquement cette occurrence ;
- ne supprime pas la participation ;
- ne supprime pas le participant ;
- ne renumérote jamais les appearances matérialisées suivantes ;
- supprime/ignore les links qui ciblaient cette appearance.

---

### 12.3 `hole_removed`

Toujours demander confirmation.

Si le hole a un link, le dialog doit le préciser.

Effet :

- supprime uniquement le hole ;
- ne supprime aucune appearance musicien ;
- supprime/ignore les links qui ciblaient ce hole.

---

### 12.4 `instrument_visibility_changed`

Masquer un instrument ne supprime pas les events historiques.

Effet :

- la colonne n’est plus affichée dans le tableau ;
- l’instrument n’apparaît plus dans le drawer d’appel ;
- l’instrument reste dans l’historique ;
- ses participations/appearances ne sont pas physiquement supprimées ;
- les events restent rejouables ;
- les cards de cette colonne ne sont pas incluses dans `buildVisibleCards` ;
- les links/conflicts impliquant cette colonne sont ignorés par le resolver visible ;
- une colonne hidden ne force jamais une card visible à bouger ;
- l’UI doit afficher un warning si l’instrument a des links actifs, mais l’action reste autorisée après confirmation ;
- montrer à nouveau l’instrument relance le resolver avec les cards redevenues visibles.

---

## 13. Holes et jouer sans

Un hole est une card ordonnable normale pour le resolver.

Règles canoniques :

- un hole occupe un vrai `resolvedRow` dans sa colonne ;
- un hole peut être poussé comme une appearance mobile ;
- un hole played est fixed ;
- un hole locked est fixed ;
- un hole peut être membre d’un link group seulement s’il a été créé par un flux explicite `jouer sans` ou drawer d’appel ;
- un hole ne participe jamais aux conflicts automatiques `instrument_constraint` liés au même participant ;
- un hole ne génère jamais d’appearance ou de hole futur ;
- supprimer un hole retire uniquement le hole de la projection active et désactive/ignore les links qui le ciblent.

### 13.1 Hole manuel

En V0, un hole manuel n’est pas ajouté entre deux cards. Les holes sont créés par les flux `jouer sans` ou drawer d’appel.

Il occupe une position réelle et ne se répète pas dans les rounds futurs.

### 13.2 Jouer sans

Il n’y a pas d’event `play_without_created` ni `play_without_removed` en V0.

Jouer sans = transaction composée de :

```txt
hole_added
link_created
```

Exemple :

```txt
Nicolas guitare veut jouer sans batterie
→ hole ajouté dans batterie
→ link entre Nicolas guitare et le hole batterie
```

Le hole créé par ce flux peut participer au link group explicite et suit les mêmes règles de collision, lock, played et normalisation que les appearances.

---

## 14. Plateau played / unplayed

### 14.1 `plateau_played`

Effet :

- toutes les targets du plateau deviennent played ;
- appearances et holes joués deviennent figés ;
- aucune target jouée ne peut être déplacée ;
- les cards restent visibles et grisées ;
- la liste ne remonte pas automatiquement.

`played` vaut lock fonctionnel.

---

### 14.2 `plateau_unplayed`

Reco V0 : autorisé seulement sur le dernier plateau joué.

Effet :

- retire `played` des targets du plateau ;
- ne change pas leur position ;
- les cards redeviennent déplaçables si non lockées.

---

## 15. Validation de projection minimale

Le moteur doit pouvoir exposer des helpers purs :

```js
canCreateLink(projection, targets)
canCreateConflict(projection, targets, scope)
canMoveTarget(projection, target, destination)
canRemoveAppearance(projection, appearanceId)
canMarkParticipantLeft(projection, participantId)
canHideInstrument(projection, instrumentId)
```

Ces helpers doivent être utilisés par l’UI avant de créer les events.

---

## 16. Sortie UI attendue

La projection finale doit permettre au front d’afficher directement :

- les colonnes par instrument ;
- les cards visibles ;
- les rounds visibles ;
- les plateaux déduits ;
- les targets played ;
- les targets locked ;
- les states linkés ;
- les conflicts visibles en mode conflict ;
- les actions autorisées/interdites par card ;
- les remplaçants proposés dans le drawer d’appel.

---

## 17. Non objectifs V0

Ne pas implémenter dans le moteur V0 :

- multi-client merge ;
- temps réel collaboratif ;
- notes ;
- drawer de link ;
- drawer de conflict ;
- `plateau_composition_forced` ;
- suppression physique d’historique ;
- renumérotation des appearances ;
- édition arbitraire d’un event ancien.


## Addendum V0 — contraintes inter-colonnes et résolution post-action

Cette section renforce la règle de résolution d’ordre définie dans `order-resolution-hierarchy-spec.md`.

- Les `links` et les `conflicts` sont uniquement **inter-colonnes** en V0. Ils ne peuvent pas être créés entre deux cards du même instrument.
- Un `conflict` est une contrainte **bidirectionnelle** : le sens `A → C` ou `C → A` ne change pas l’interdiction de cohabitation. Le sens de création ne doit pas orienter la résolution ; seuls un drag manuel ou une autre dernière action utilisateur peuvent fournir une intention prioritaire.
- À chaque transaction, le resolver doit vérifier les conflicts actifs dans les deux sens, quelle que soit la colonne touchée par l’action.
- Une card ayant un link ou un conflict reste draggable tant qu’elle n’est ni `played` ni `locked`.
- Un drag qui déplace une card non-linkée dans une zone contenant une target linkée est autorisé : le manual reorder est conservé, puis le groupe linké suit la target linkée décalée.
- Après un drag, le resolver applique les conséquences : les cards linkées suivent la card déplacée ou la target linkée décalée si possible ; les conflicts qui deviennent actifs sur la nouvelle ligne déplacent la card au coût le plus faible vers le slot valide le plus proche.
- Si une réparation vers le bas n’est pas possible, le resolver peut chercher un slot valide au-dessus.
- Si une card poussée est elle-même linkée, sa priorité se propage à son groupe linké.
- Aucune résolution induite ne peut déplacer une card `played` ou `locked`.
- Le round d’une appearance est une information métier, jamais une contrainte bloquante de tri.


### Redo linéaire

La projection doit interpréter `transaction_redone` comme une réactivation linéaire d’une transaction undo.

Pipeline :

1. `transaction_reverted` retire uniquement la dernière transaction active ciblée ;
2. cette transaction devient redoable ;
3. `transaction_redone` réactive uniquement la dernière transaction redoable ciblée ;
4. toute nouvelle action métier après un undo invalide la pile redo ;
5. les events undo/redo restent dans l’historique mais ne sont pas appliqués comme events métier.

Le replay de l’event log reste déterministe : l’état final dépend uniquement des transactions actives après résolution undo/redo linéaire.
