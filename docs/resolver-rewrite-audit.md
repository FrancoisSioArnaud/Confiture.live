# Audit de préparation — réécriture du resolver d’ordre

## Contexte et périmètre

Ce document audite l’implémentation actuelle du resolver sans modifier le comportement runtime. Il prépare la réécriture demandée par la spec canonique `docs/order-resolution-hierarchy-spec.md` et les fixtures golden `docs/order-resolution-golden-fixtures.md`.

Constat principal : le chemin actuel reste un resolver historique basé sur `positionInRound`, `roundOrder`, `orderScore`, `resolvedPlateauIndex` et `resolvedColumnOrder`. La réécriture devra remplacer ce chemin par un solver pur à base de `resolvedRow`, `visualIndex`, `cardIndexInColumn`, `previousLayout` et `transactionContext`.

## 1. Fonctions actuelles du resolver à supprimer ou remplacer

### Exports publics du resolver

Ces fonctions sont aujourd’hui importables depuis `orderResolution.js` et appartiennent au chemin historique. Elles devront être remplacées ou fortement réécrites pour respecter le contrat `resolveOrderAfterTransaction(input)` de la spec :

| Fonction | Statut pour la réécriture | Raison |
|---|---|---|
| `resolveOrderAfterTransaction(state, context = {})` | Remplacer | Signature et modèle de mutation actuels basés sur l’état global projeté. La spec attend une entrée structurée `cards`, `links`, `conflicts`, `hiddenColumnIds`, `previousLayout`, `transactionContext`, `config`. |
| `applyManualOrderHints(state)` | Supprimer/remplacer | Convertit `manualOrderHint` en `positionInRound` via `orderBetween`; la spec demande de convertir l’intention en `transactionContext` et de ne plus utiliser `manualOrderHint` comme vérité d’ordre. |
| `applyActiveLinks(state)` | Supprimer/remplacer | Passe de validation locale des links, sans union-find ni choix canonique de `targetRow`. |
| `applyActiveConflicts(state, { anchor })` | Supprimer/remplacer | Répare les conflicts par heuristique locale et anchor/non-anchor, au lieu du coût minimal et des passes canoniques. |
| `applyResolvedLinkAlignment(state, options)` | Supprimer/remplacer | Aligne via `resolvedPlateauIndex`/rang local avec propagation ad hoc; la spec demande une propagation par priorités numériques et `resolvedRow`. |
| `getCardsByInstrument(state)` | Remplacer | Utile comme helper, mais il lit directement `state.appearances`/`state.holes`; le nouveau resolver doit recevoir des cards candidates explicites. |
| `sortCardsByCurrentResolvedOrder(cards)` | Remplacer | Trie par `resolvedColumnOrder` puis fallback round/position; incompatible avec le modèle `resolvedRow`. |
| `freezePinnedCards(cards)` | Remplacer | Fige via `playedAtPlateauIndex`/`lockedAtPlateauIndex`; la spec vise `playedResolvedRow` et lock sur row courante. |
| `assignResolvedColumnOrder(cards)` | Remplacer | Produit `resolvedPlateauIndex`/`resolvedColumnOrder` en triant round-first; incompatible avec le mélange de rounds autorisé. |
| `extractTransactionAnchor(transaction)` | Remplacer/adapter | À intégrer dans un builder de `transactionContext` canonique, pas dans le solver mutateur. |
| `extractEventAnchor(event)` | Remplacer/adapter | Même raison que ci-dessus. |
| `targetKey(target)` | Conserver possible comme helper pur | Peut rester comme utilitaire de tri déterministe si son format est compatible avec la spec. |
| `cardTarget(typeOrCard, id)` | Conserver possible comme helper pur | Peut rester comme utilitaire d’identification, mais ne doit pas porter la logique d’ordre. |
| `isCardActive(card)` | Conserver possible comme helper pur | À déplacer éventuellement hors du resolver. |
| `isCardPlayed(card)` | Conserver possible comme helper pur | À aligner avec la nouvelle notion de fixed card. |
| `isCardLocked(card)` | Conserver possible comme helper pur | À aligner avec la nouvelle notion de fixed card. |
| `getInstrumentIdForCard(card)` | Conserver possible comme helper pur | Helper simple, pas problématique en soi. |

### Fonctions internes à remplacer

Les fonctions internes suivantes portent l’ancien algorithme ou ses tie-breakers et devront être supprimées/remplacées par des fonctions pures conformes aux sections normatives de la spec :

- `assignAllResolvedColumnOrders`
- `applyLinkConstraint`
- `applyConflictConstraint`
- `buildConflictTargetGroups`
- `conflictEntityPairs`
- `conflictTargetGroupsShareInstrument`
- `chooseConflictAnchor`
- `compareGridOrder`
- `entityMatchesTarget`
- `entityMatchesConflictTarget`
- `linkedOrder` (en plus, fonction morte/non appelée)
- `hasDuplicateInstrumentEntries`
- `hasDuplicateInstrumentEntities`
- `samePlateau`
- `getCardPlateauIndex`
- `moveConflictTargetAwayFromPlateau`
- `conflictCandidateIndexes`
- `moveItemToIndex`
- `pinnedCardsWouldMove`
- `columnOrderRespectsConflicts`
- `hasActiveConflictAtPlateau`
- `applyResolvedOrderToColumn`
- `setCardOrder`
- `alignLinkResolvedPlateaux`
- `linkedPriorityEntry`
- `linkedResolvedIndex`
- `createLinkPriorityContext`
- `moveCardToResolvedIndex`
- `getSortedCardsWithManualHints`
- `extractTransactionAnchorMode`
- `extractManualMoveContext`
- `participationAnchorTarget`
- `firstTarget`
- `buildResolvedOrderKey`
- `compareBaseColumnOrder`
- `comparePinnedCards`
- `pinPriority`
- `getPinnedPlateauIndex`
- `buildFrozenOrderKey`
- `buildManualOrderKey`

## 2. Champs d’ancien ordre encore utilisés

### Synthèse par champ

| Champ | Usages actuels constatés | Action attendue lors de la réécriture |
|---|---|---|
| `positionInRound` | Créé dans `applyEvent`, `rounds`, `holes`; lu par `ordering`, `orderResolution`, tests; modifié par `setCardOrder`. | Ne plus être vérité finale. Toléré seulement comme fallback d’entrée/legacy. |
| `roundOrder` | Créé avec `positionInRound`; fallback dans `getPositionInRound`; modifié par `setCardOrder`. | Même traitement que `positionInRound`. |
| `orderScore` | Créé dans `applyEvent`, `rounds`, `holes`; utilisé par certains builders/tests; modifié par `setCardOrder`. | À retirer du chemin critique d’ordre. |
| `resolvedPlateauIndex` | Produit par `assignResolvedColumnOrder`/`applyResolvedOrderToColumn`; lu pour links, conflicts, pins. | Remplacer par `resolvedRow`; `plateauIndex` ne doit pas être vérité resolver. |
| `resolvedColumnOrder` | Produit par le resolver; utilisé par `sortByColumnOrder` et `selectCardsForInstrument`. | Remplacer l’intégration UI par `visibleResolvedRows` + `cardIndexInColumn`/`visualIndex`. |
| `manualOrderHint` | Écrit par `applyEvent` lors des moves; lu par `applyManualOrderHints` et trié dans `getSortedCardsWithManualHints`; vérifié par tests. | Convertir en `transactionContext`; ne plus orienter directement le rendu. |
| `playedAtPlateauIndex` | Écrit/supprimé par `freezePinnedCards`; lu par `getPinnedPlateauIndex`; vérifié par tests. | Remplacer par `playedResolvedRow`/row fixe dérivée. |
| `lockedAtPlateauIndex` | Écrit/supprimé par `freezePinnedCards`; lu par `getPinnedPlateauIndex`; vérifié par tests. | Remplacer par lock sur `resolvedRow` courant. |

### Fichiers runtime concernés

- `frontend/src/features/projection/orderResolution.js` : concentre l’ancien resolver et écrit/lit tous les champs d’ordre historiques ci-dessus.
- `frontend/src/features/projection/ordering.js` : expose encore `getPositionInRound`, `getEntityOrder`, `orderBetween`, `sortByColumnOrder` avec fallback `positionInRound`/`roundOrder`/rang local.
- `frontend/src/features/projection/applyEvent.js` : initialise `positionInRound`, `roundOrder`, `orderScore` et écrit `manualOrderHint` pour les events `appearance_moved_between` / `hole_moved_between`.
- `frontend/src/features/projection/rounds.js` : matérialise les appearances calculées avec `positionInRound`, `roundOrder`, `orderScore`.
- `frontend/src/features/projection/holes.js` : crée les holes avec `positionInRound`, `roundOrder`, `orderScore`.
- `frontend/src/features/projection/selectors.js` : `selectCardsForInstrument` trie via `sortByColumnOrder`, donc dépend indirectement de `resolvedColumnOrder`, puis round/position fallback.
- `frontend/src/features/table/utils/buildLinkModeTransaction.js` : utilise `orderScore`/position keys pour un tri déterministe de targets dans un builder de transaction.

## 3. Tests existants qui vérifient l’ancienne logique et devront être réécrits

### Tests projection à réécrire prioritairement

- `frontend/src/features/projection/orderResolution.test.js`
  - `resolves purely and deterministically for the same state and transaction` : déterminisme utile, mais fixture basée sur `positionInRound`/`roundOrder`.
  - `replays the same event log twice to strictly identical columns` : à conserver conceptuellement, expected à basculer sur `resolvedRow`/`visualIndex`.
  - `runs post-transaction resolution without relying on UI-built columns` : intégration à conserver, assertions `orderScore` à remplacer.
  - `records manual move intent in applyEvent and resolves the final order after the transaction` : vérifie `manualOrderHint` et ordre actuel; à remplacer par `transactionContext`.
  - Tous les tests de pins `playedAtPlateauIndex` / `lockedAtPlateauIndex` : à réécrire avec `playedResolvedRow` / lock row.
  - Tests de links `move_to_first`, propagation, target pinned, priorité propagée : à réécrire contre les fixtures golden exactes et l’union-find.
  - Tests de conflicts anchor/non-anchor et bidirectionnels : à réécrire avec coût minimal et warnings standards.
  - `preserves round/base order as A, B, C, A', B', C' without constraints` : teste explicitement l’ancien round-first order, supprimé par la spec.
  - Tests `played_empty_slot` et holes : à conserver conceptuellement, mais adapter à `targetResolvedRow`/`playedResolvedRow`.

- `frontend/src/features/projection/projectJamState.test.js`
  - `reveals round 2 with round-first ordering in one column` : ancienne règle round-first.
  - `projects holes and play-without as hole_added plus link_created` : assertions `orderScore`.
  - `applies link reorder strategies unless a conflict suppresses the link` : assertions `orderScore`.
  - `applies each link reorder strategy deterministically` : assertions `positionInRound`.
  - `reapplies an active link when a contradictory conflict is removed` : comportement à réexprimer sans “retour magique”.
  - `keeps played and locked targets immobile when move events occur` : assertions `positionInRound`.

- `frontend/src/features/projection/projectionRules.test.js`
  - `handles round 2 reveal and a participant added after reveal with round-first order` : ancienne règle round-first.
  - `applies link strategies move_to_first, move_to_last, average_position, and supports hole targets` : assertions `positionInRound`.
  - `keeps conflicts active for appearance and participation scopes and does not move played or locked conflict targets` : assertions `orderScore`.

### Tests transaction builders / UI à auditer

Ces tests ne vérifient pas tous directement l’ordre final, mais ils encadrent les points d’intégration à préserver :

- `frontend/src/features/table/utils/buildCardActionTransaction.test.js`
  - Vérifie que les moves ne créent que l’event vertical ciblé. À conserver, mais s’assurer que le payload nourrit bien le nouveau `transactionContext`.
- `frontend/src/features/table/utils/buildLinkModeTransaction.test.js`
  - Vérifie création/suppression de links, contradictions, same-column. À conserver, mais surveiller l’usage de `orderScore` dans le builder runtime.
- `frontend/src/features/table/utils/buildConflictModeTransaction.test.js`
  - À conserver pour les validations pré-transaction et targetIds non orientés.
- `frontend/src/features/table/utils/buildCallDrawerTransaction.test.js`
  - À ré-auditer pour les notions de plateau/candidate; ne doit pas dépendre du rang local d’une colonne.
- `frontend/src/features/table/utils/buildTableActionTransaction.test.js`
  - À ré-auditer pour `plateau_played`, `hole_added reason: played_empty_slot`, `targetResolvedRow`.
- `frontend/src/features/table/utils/cardState.test.js`
  - À conserver pour le comportement drag/played/locked; vérifier les suppressed links/conflicts avec warnings standards.

## 4. Points d’intégration à préserver

### `projectJamState`

À préserver : le replay déterministe transaction par transaction, avec appel du resolver après chaque transaction active. Le point à changer sera la préparation de l’entrée canonique du resolver (`cards`, `links`, `conflicts`, `hiddenColumnIds`, `previousLayout`, `transactionContext`, `config`) et la consommation de sa sortie (`layoutByCardId`, warnings, layout courant).

### `buildColumns` / selectors

À préserver : `projectJamState` construit `state.columns` après projection. À changer : `buildColumns()` ne devra plus trier par `resolvedColumnOrder` puis fallback round/position. Il devra utiliser la sortie canonique : `visibleResolvedRows`, `visualIndex`, `cardIndexInColumn`, et conserver les cellules vides comme absence de card sur une row visible.

### `callDrawer`

À préserver : `buildCallDrawerSelectors` expose les replacement candidates par instrument. À auditer : les candidats et exclusions de conflict doivent se baser sur le plateau/row résolu canonique, pas sur le rang local de colonne.

### `JamTable`

À préserver : le tableau doit continuer à recevoir des colonnes et cards renderables. À changer/contrôler : tout calcul UI de plateau basé sur “n-ième card de chaque colonne” doit disparaître au profit de `visualIndex` global et `resolvedRow`.

### Transaction builders

À préserver : les builders doivent continuer à produire des events d’intention, sans pré-résoudre les déplacements induits.

Points précis :

- Move cards : garder un event ciblé (`appearance_moved_between` / `hole_moved_between`) avec bornes `afterTarget` / `beforeTarget`; le resolver dérive le push.
- Link mode : conserver la création/suppression de links, validations same-column/contradictions; ne pas utiliser `orderScore` comme vérité d’ordre.
- Conflict mode : conserver les targetIds non orientés et validations same-column.
- Table actions : préserver `plateau_played`, `plateau_unplayed`, holes joués pour slots vides, mais migrer les payloads vers les noms canoniques (`visualIndex`, `targetResolvedRow`/`playedResolvedRow` selon spec).
- Call drawer : préserver `appearance_skipped` et replacement move, mais le skip doit délinker ponctuellement uniquement la target et pousser seulement l’appearance ciblée.

## 5. Risques de régression

1. **Régression d’ordre visible** : la disparition du tri round-first et du fallback `positionInRound` changera de nombreux expected historiques.
2. **Confusion `resolvedRow` / `visualIndex`** : risque élevé si `buildColumns`, `JamTable` ou le call drawer continuent à raisonner en rang local de colonne.
3. **Pins played/locked** : migrer de `playedAtPlateauIndex`/`lockedAtPlateauIndex` vers `playedResolvedRow`/lock row peut déplacer accidentellement des cards historiques.
4. **Links indirects** : l’implémentation actuelle propage localement; la réécriture union-find + priorités peut changer les arbitrages, surtout sur multi-links et links supprimés.
5. **Conflicts** : l’actuel choix anchor/non-anchor devra être remplacé par coût minimal; risque de casser les tests et habitudes d’ordre.
6. **Warnings** : format actuel `{ code, message, details }` incompatible avec le format standard attendu (`type`, `severity`, `reason`, `transactionId`, `cardIds`, etc.). Les consommateurs debug/admin peuvent nécessiter adaptation.
7. **Hidden columns** : l’ancien pipeline trie toutes les cards actives par instrument; la spec impose que les colonnes hidden soient filtrées avant résolution visible et n’influencent pas les cards visibles.
8. **Holes et played empty slots** : les holes doivent être des cards normales pour ordre/lock/played/link explicite; les payloads de jeu sans instrument sont sensibles.
9. **Undo/replay** : la projection rejoue depuis zéro; tout cache de layout précédent doit rester dérivable et transmis explicitement comme `previousLayout`.
10. **Déterminisme JS** : tout parcours d’objet sans tri stable peut créer des divergences entre environnements; le nouveau solver doit trier explicitement toutes ses entrées.
11. **Cycles / limites** : l’ancien resolver borne quelques boucles à 20 passes sans `layoutHash`; la spec demande warnings `resolver_cycle_detected` / `resolver_max_passes_reached`.
12. **Snapshots legacy** : si des snapshots contiennent seulement les anciens champs, il faudra définir clairement leur rôle de fallback d’entrée, sans les laisser redevenir source de vérité.

## 6. Recommandation de séquencement

1. Ajouter des tests golden purs depuis `docs/order-resolution-golden-fixtures.md`, initialement en `skip` ou dans une branche de migration si nécessaire.
2. Introduire les types/helpers purs du nouveau resolver sans brancher le runtime.
3. Construire un adapter dans `projectJamState` pour produire l’input canonique et conserver `previousLayout` entre transactions.
4. Brancher le nouveau resolver derrière un remplacement atomique de `resolveOrderAfterTransaction`.
5. Migrer `buildColumns`, `callDrawer` et `JamTable` vers `resolvedRow`/`visualIndex`.
6. Réécrire les tests historiques listés ci-dessus autour des fixtures golden et invariants de `docs/testing-strategy.md`.

---

## Statut de migration — ancienne logique supprimée

La migration V2 a été branchée dans le pipeline de projection. L’ancienne logique `orderResolution.js` a été supprimée du code runtime et les tests qui appelaient directement `resolveOrderAfterTransaction(state, context)` ou qui attendaient les champs canoniques legacy (`resolvedPlateauIndex`, `resolvedColumnOrder`, `manualOrderHint`, ordre final round-first) ne doivent plus être conservés comme source de vérité.

Les champs `appearanceIndex`, `positionKey`, `baseOrderKey` et les anciens caches `positionInRound` / `roundOrder` / `orderScore` peuvent encore exister comme données d’import ou fallback de `baseOrder`, mais ils ne doivent pas décider l’ordre final après `resolveOrderAfterTransactionV2`.

## 7. Bilan final du refactor V2

Cette section remplace le constat initial historique par le statut final après branchement du resolver V2. La spec reste la source de vérité ; les écarts ci-dessous décrivent uniquement l’état du code migré.

### 7.1 Fichiers supprimés

- `frontend/src/features/projection/orderResolution.js` : ancien resolver mutable supprimé du runtime.
- `frontend/src/features/projection/orderResolution.test.js` : tests directs de l’ancien resolver supprimés car ils validaient les champs et arbitrages legacy.

### 7.2 Fichiers créés pour le resolver V2

- `frontend/src/features/projection/resolver/resolveOrderAfterTransactionV2.js`
- `frontend/src/features/projection/resolver/buildVisibleCards.js`
- `frontend/src/features/projection/resolver/buildLinkGroups.js`
- `frontend/src/features/projection/resolver/buildActiveConflicts.js`
- `frontend/src/features/projection/resolver/buildInitialLayout.js`
- `frontend/src/features/projection/resolver/applyTransactionIntent.js`
- `frontend/src/features/projection/resolver/runResolutionPass.js`
- `frontend/src/features/projection/resolver/normalizeVisualIndexes.js`
- `frontend/src/features/projection/resolver/compareResolverEntities.js`
- `frontend/src/features/projection/resolver/buildTransactionContext.js`
- `frontend/src/features/projection/resolver/validateTransactionBeforeApply.js`
- `frontend/src/features/projection/resolver/resolverTypes.js`
- `frontend/src/features/projection/resolver/resolverWarnings.js`
- `frontend/src/features/projection/resolver/resolverCosts.js`
- `frontend/src/features/projection/resolver/resolverPriorities.js`
- `frontend/src/features/projection/resolver/resolverIds.js`
- `frontend/src/features/projection/resolver/goldenFixtures.js`
- Tests associés : `buildTransactionContext.test.js`, `validateTransactionBeforeApply.test.js`, `goldenFixtures.test.js`, `resolveOrderAfterTransactionV2.test.js`, `resolverInvariants.test.js`, `resolverWarnings.test.js`, `resolverIds.test.js`, `resolverTypes.test.js`, `noLegacyResolver.test.js`.

### 7.3 Champs legacy encore présents comme fallback uniquement

Les champs suivants peuvent encore être produits ou lus pour importer/rejouer un état ancien, pour dériver un `baseOrder`, ou pour stabiliser la matérialisation initiale. Ils ne doivent pas décider l’ordre final après résolution V2 :

- `appearanceIndex` : identité métier du round d’une appearance et fallback stable, jamais contrainte finale.
- `positionKey` : fallback de création/import pour `baseOrder`.
- `baseOrderKey` : fallback de création/import pour `baseOrder`.
- `positionInRound` : cache legacy toléré en entrée, non source de vérité finale.
- `roundOrder` : cache legacy toléré en entrée, non source de vérité finale.
- `orderScore` : cache legacy toléré en entrée et dans certains builders pour tri déterministe de payload, non source de vérité finale du resolver.

Les champs suivants ne doivent plus être utilisés comme vérité canonique :

- `resolvedPlateauIndex` ;
- `resolvedColumnOrder` ;
- `manualOrderHint` ;
- `playedAtPlateauIndex` ;
- `lockedAtPlateauIndex`.

### 7.4 Tests golden passés

Les fixtures golden documentées dans `docs/order-resolution-golden-fixtures.md` sont transcrites dans `frontend/src/features/projection/resolver/goldenFixtures.js` et exécutées par `frontend/src/features/projection/resolver/goldenFixtures.test.js` contre `resolveOrderAfterTransactionV2(input)`.

Le test vérifie notamment :

- la présence de toutes les fixtures documentées ;
- les champs canoniques `layoutByCardId`, `orderedCardIdsByColumnId`, `visibleResolvedRows`, `projectionWarnings` ;
- l’absence de `resolvedPlateauIndex` dans les fixtures ;
- l’appartenance des warnings au catalogue fermé ;
- la correspondance exacte des sorties V2 attendues.

### 7.5 Invariants passés

`frontend/src/features/projection/resolver/resolverInvariants.test.js` verrouille les invariants suivants avec plusieurs seeds déterministes internes :

- même input ⇒ même output ;
- même event log rejoué deux fois ⇒ même layout ;
- aucune colonne visible ne contient deux cards au même `resolvedRow` ;
- `played` ne change pas de `resolvedRow` après une transaction ultérieure ;
- `locked` ne change pas de `resolvedRow` tant que la card reste locked ;
- aucun link résoluble ne reste désaligné ;
- aucun conflict résoluble ne reste sur le même `resolvedRow` ;
- aucune card visible ne disparaît silencieusement ;
- les colonnes hidden n’influencent pas les cards visibles ;
- les rounds peuvent être mélangés ;
- les warnings appartiennent au catalogue fermé ;
- l’ordre brut des tableaux/objets JS ne change pas le résultat final.

### 7.6 Vérification Definition of Done

- Resolver V2 isolé dans des modules purs, sans dépendance React, DOM, MUI, Zustand, Dexie, `Date.now()` ni `Math.random()`.
- `projectJamState` applique les transactions actives une par une et appelle une seule résolution par transaction complète.
- `previousLayout` est propagé de la transaction N vers la transaction N+1.
- `buildTransactionContext` centralise l’intention de transaction ; aucun resolver n’est appelé entre deux events d’une même transaction.
- `buildColumns` consomme `layoutByCardId` et `visibleResolvedRows` ; le rendu table utilise les `resolvedRows`/`visualIndex` globaux et ne reconstruit pas un plateau par rang local de colonne.
- Les links/conflicts/played/locked utilisent `resolvedRow` comme vérité logique.
- `visualIndex` reste une valeur d’affichage compacte et globale.
- Les warnings du resolver passent par le catalogue fermé `resolverWarnings.js`.
- Le garde `noLegacyResolver.test.js` vérifie l’absence d’import de l’ancien module et l’absence de tri final round-first dans `selectors/buildColumns`.
- Les tests anciennement marqués `it.skip` pendant la migration ont été réactivés et alignés sur les attentes V2 ; la suite frontend ne contient plus de skip volontaire lié au resolver.

### 7.7 Points restant hors scope V0

Aucun point de logique resolver n’est volontairement hors scope V0 à ce stade. Les éléments suivants restent hors scope produit V0, conformément aux instructions globales du dépôt, et ne doivent pas être réintroduits par le refactor resolver :

- client sessions ;
- lease ;
- heartbeat ;
- takeover ;
- UI de lecture seule liée à un autre device ;
- retour de `JamClientSession`.
