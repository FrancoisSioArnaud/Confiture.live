# Prompt Codex — Implémenter le solver de réorder par contraintes

Lis d’abord toute la documentation suivante avant de modifier le code :

- `docs/order-resolution-hierarchy-spec.md`
- `docs/projection-engine-spec.md`
- `docs/confiture_event_actions_spec.md`
- `docs/v0-round-order-and-no-between-cards.md`
- `docs/event-payloads-reference.md`
- `docs/testing-strategy.md`
- `docs/order-resolution-golden-fixtures.md`

Objectif : implémenter un moteur frontend pur et déterministe de résolution d’ordre, basé sur un solver de contraintes discrètes.

Les sections `4.1` à `4.29` de `docs/order-resolution-hierarchy-spec.md` sont normatives. Elles doivent être appliquées telles quelles : hiérarchie hard/conditional/soft, politique refus vs warning, format des `projectionWarnings`, séparation `resolvedRow`/`visualIndex`/`cardIndexInColumn`, stratégie de collision, scoring chiffré, propagation chiffrée, choix de `targetRow`, ordre exact des passes, conditions d’arrêt, colonnes hidden, holes, `appearance_skipped`, validations UI pré-transaction, invariants de tests, contrat d’entrée/sortie, mapping event→context, previousLayout, IDs, expansion des conflicts participation, traitement legacy, contrat UI, fixtures canoniques, schémas JSDoc, fonctions pures obligatoires, DoD, property-based tests et suppression explicite de l’ancien resolver.

Créer ou remplacer le module :

```txt
frontend/src/features/projection/orderResolution.js
```

Puis l’intégrer dans le replay/projection existant pour qu’après chaque transaction appliquée, le tableau soit recalculé par ce resolver.

Contraintes non négociables :

- JavaScript uniquement, pas TypeScript.
- Pas de dépendance React, MUI, Zustand, Dexie, DOM, localStorage.
- Pas de `Date.now()` ni `Math.random()`.
- Même state + même eventLog + même transaction context = même projection.
- Le même eventLog rejoué deux fois doit produire exactement le même ordre.
- Les composants UI ne doivent pas contenir de logique concurrente de résolution d’ordre.
- Le round d’une appearance est une metadata, pas une contrainte d’ordre.

Ancienne logique à supprimer :

```txt
- tri round-first obligatoire
- priorité round / appearanceIndex dans l’ordre final
- resolver limité à l’anchor et ses links directs
- conflict orienté par le sens de création
- retour automatique à un ancien ordre après suppression de link/conflict
```

Implémentation attendue :

0. Verrouiller le contrat d’intégration avant de coder l’algorithme :
   - `resolveOrderAfterTransaction(input)` reçoit exactement `cards`, `links`, `conflicts`, `hiddenColumnIds`, `previousLayout`, `transactionContext`, `config` ;
   - il retourne `layoutByCardId`, `orderedCardIdsByColumnId`, `visibleResolvedRows`, `projectionWarnings` ;
   - `resolvedRow` est calculé par le resolver et stockable seulement en projection/snapshot dérivable, jamais comme vérité d’event ;
   - chaque transaction reçoit comme `previousLayout` le layout produit par la transaction active précédente pendant le replay ;
   - créer une table pure `buildTransactionContext(transaction, projectedState, previousLayout)` conforme à la section 4.19 ;
   - créer une fonction pure `validateTransactionBeforeApply(state, transaction)` conforme à la section 4.22 ;
   - appliquer strictement la convention des IDs de la section 4.23 : `appearanceId = appearance_{participationId}_{appearanceIndex}` ;
   - étendre les conflicts `scope: participation` en paires de cardIds visibles selon la section 4.24 ;
   - traiter les anciens champs d’ordre comme fallback uniquement, jamais comme contraintes finales ;
   - faire consommer `layoutByCardId` par `buildColumns()` sans logique concurrente dans l’UI.

1. Ajouter `orderResolution.js` avec au minimum :
   - `resolveOrderAfterTransaction(state, context)` ;
   - helpers purs pour collecter les cards actives par colonne ;
   - identification des cards fixed : played, locked, holes played/locked ;
   - construction des groupes linkés via union-find ;
   - construction des conflicts actifs ;
   - détection des impossibilités structurelles ;
   - recherche des violations : collisions, links désalignés, conflicts actifs ;
   - réparation itérative bornée ;
   - scoring des réparations avec les constantes `RESOLUTION_COST` de la spec ;
   - propagation avec les constantes `PROPAGATION_PRIORITY` de la spec ;
   - choix de `targetRow` avec stratégie link + candidateRows alternatives ;
   - ordre exact des passes : collisions, links, collisions, conflicts, collisions, repeat ;
   - limites `RESOLUTION_LIMITS` et détection de `layoutHash` répété ;
   - filtrage canonique des colonnes hidden ;
   - règles holes comme cards normales pour ordre/lock/played/link explicite ;
   - règles `appearance_skipped` : délink ponctuel puis push de l’appearance seule ;
   - séparation stricte `resolvedRow` / `visualIndex` / `cardIndexInColumn` ;
   - `visualIndex` calculé comme compression globale des `resolvedRows` visibles, jamais comme index local par colonne ;
   - normalisation finale stable sans modifier les `resolvedRow` fixed ;
   - production de `projectionWarnings` déterministes au format standard de la spec.

2. Intégrer le resolver dans le pipeline de projection :
   - appliquer les events d’une transaction ;
   - appeler `resolveOrderAfterTransaction(state, context)` ;
   - passer ensuite à la transaction suivante.

3. Implémenter la hiérarchie canonique des contraintes :
   - contraintes dures absolues : colonne instrument immuable, aucune collision finale dans une colonne visible, played immobile, locked immobile ;
   - contraintes dures conditionnelles : links alignés si possible, conflicts séparés si possible ;
   - contraintes soft : intention utilisateur, propagation, minimisation du mouvement, stabilité ;
   - un conflict dur passe avant l’intention du dernier drag ;
   - links impossibles détectés : même colonne, conflict direct, fixed rows différentes ;
   - conflicts impossibles détectés : deux fixed sur la même row.

4. Implémenter les arbitrages canoniques :
   - refus UI/pré-transaction pour les actions manifestement impossibles listées dans la spec ;
   - replay défensif avec `projectionWarnings` pour les events invalides ou devenus insolubles ;
   - format standard des warnings avec `type`, `severity`, `reason`, `transactionId`, `cardIds`, `message` ;
   - `resolvedRow` pour constraints, `visualIndex` global pour affichage compact, `cardIndexInColumn` seulement pour le rendu local ;
   - collision : fixed garde la place, sinon priorité la plus haute, sinon stabilité, card poussée vers le slot valide le plus proche avec préférence vers le bas en cas d’égalité ;
   - scoring numérique `RESOLUTION_COST` ;
   - propagation numérique `PROPAGATION_PRIORITY` ;
   - `targetRow` des links : fixed row, priorité >= 500, stratégie enregistrée, candidateRows alternatives ;
   - limites `RESOLUTION_LIMITS` : `MAX_PASSES = 50`, repairs par passe = cards visibles * 4, distance candidate max = 200 ;
   - warning `resolver_cycle_detected` si un `layoutHash` revient deux fois ;
   - colonnes hidden absentes de `buildVisibleCards` et contraintes hidden ignorées dans le resolver visible sans déplacer les cards visibles ;
   - holes traités comme cards normales, sauf pas de conflicts automatiques et pas de génération future ;
   - skip : repousse uniquement l’appearance ciblée, sans modifier le participant ni les appearances futures ;
   - validations UI pré-transaction listées en section 4.14 ;
   - ne jamais scorer le round comme priorité.
   - appliquer les clarifications finales de section 4.28 : une seule résolution par transaction complète, `playedResolvedRow`, holes `played_empty_slot`, lock sur row courante, move avec bornes manquantes, tri déterministe des entrées, layout partiel complet.

5. Implémenter la propagation :
   - une card déplacée peut pousser une autre card ;
   - si la card poussée est linkée, son groupe linké doit être réaligné ;
   - si ce réalignement pousse encore une card linkée, la propagation continue ;
   - si plusieurs chemins donnent une priorité à la même card, conserver la priorité la plus haute ;
   - sous la priorité utile 100, utiliser le fallback de stabilité ;
   - la boucle doit être bornée et retourner `resolver_max_passes_reached` ou `resolver_cycle_detected` si elle n’atteint pas un état stable.

6. Implémenter les points canoniques 8 à 15 :
   - `chooseLinkTargetRow()` respecte fixed rows, priorité de propagation, stratégie `link_created`, candidateRows alternatives ;
   - `runResolutionPasses()` respecte l’ordre canonique des passes et relance collisions après links/conflicts ;
   - `layoutHash()` détecte les cycles et les limites de passes/réparations retournent des warnings standards ;
   - les colonnes hidden sont filtrées avant résolution visible et leurs contraintes n’influencent pas les cards visibles ;
   - les holes utilisent le même pipeline que les appearances pour collisions, push, lock, played et links explicites ;
   - `appearance_skipped` délinke ponctuellement puis repousse seulement l’appearance ciblée ;
   - ajouter les validations UI/pré-transaction nécessaires sans déplacer la logique de résolution dans les composants ;
   - faire passer tous les invariants de tests listés en section 4.15 et les fixtures canoniques de la section 4.27 et `docs/order-resolution-golden-fixtures.md`.

7. Ajouter les fixtures canoniques avant ou avec les tests, avec expected exact conforme à `docs/order-resolution-golden-fixtures.md` :
   - `fixture_01_drag_simple_push` ;
   - `fixture_02_push_link_chain` ;
   - `fixture_03_indirect_priority_chain` ;
   - `fixture_04_link_fixed_target` ;
   - `fixture_05_link_fixed_impossible` ;
   - `fixture_06_conflict_mobile_repair` ;
   - `fixture_07_conflict_fixed_impossible` ;
   - `fixture_08_rounds_mixed_valid` ;
   - `fixture_09_hidden_column_ignored` ;
   - `fixture_10_skip_delinks_only_target` ;
   - `fixture_11_visual_index_global_not_local_rank` ;
   - `fixture_12_same_event_log_same_projection` ;
   - `fixture_13_link_removed_no_magic_restore` ;
   - `fixture_14_conflict_removed_no_magic_restore` ;
   - `fixture_15_participation_conflict_expansion`.

8. Ajouter ou mettre à jour les tests :
   - même event log rejoué deux fois → même projection exacte ;
   - drag simple qui pousse une card mobile ;
   - drag qui pousse une card linkée et propage son link ;
   - propagation en chaîne `A pousse B`, `B link C`, `C pousse D`, `D link E` ;
   - link aligné avec target locked ;
   - link impossible avec deux targets fixed sur rows différentes ;
   - link `move_to_first`, `move_to_last`, `average_position` ;
   - link targetRow bloquée puis candidateRow alternative ;
   - conflict simple entre deux cards mobiles ;
   - conflict où une card est locked ;
   - conflict impossible entre deux cards fixed ;
   - création de link refusée si conflict direct ;
   - création de link refusée si deux targets dans la même colonne ;
   - création de conflict refusée si deux targets sont déjà linkées ;
   - suppression de link ne provoquant pas un retour magique ;
   - suppression de conflict ne provoquant pas un retour magique ;
   - reveal round puis résolution par solver ;
   - mélange de rounds autorisé si nécessaire ;
   - played et locked immobiles ;
   - colonne hidden n’influençant pas l’ordre visible ;
   - réaffichage d’une colonne hidden relançant une résolution stable ;
   - hole mobile traité comme card normale ;
   - hole played/locked immobile ;
   - hole de `jouer sans` membre d’un link explicite ;
   - `appearance_skipped` repoussant uniquement l’appearance ciblée ;
   - skip avec remplaçant linked nécessitant confirmation UI ;
   - collision entre deux cards mobiles : garde la plus prioritaire et pousse vers le slot valide le plus proche ;
   - collision avec une card fixed : la fixed garde sa row ;
   - cycle détecté avec warning `resolver_cycle_detected` ;
   - max passes atteint avec warning `resolver_max_passes_reached` ;
   - `projectionWarnings` produits au format standard ;
   - `resolvedRow` stable pour played/locked malgré normalisation `visualIndex` ;
   - même `resolvedRow` => même `visualIndex` global ;
   - aucune logique de plateau basée sur la nième card d’une colonne ;
   - score égal départagé par ordre précédent, ordre de création, puis id ;
   - undo/redo linéaire puis replay cohérent.

Interdictions spécifiques :

- ne pas faire `return` dès que `detectStructuralImpossibleCases()` retourne des warnings ; collecter les warnings, ignorer seulement les contraintes impossibles et continuer les réparations possibles ;
- ne pas implémenter “déplacer la non-anchor” pour les conflicts ; choisir la card ou le groupe au coût minimal ;
- ne pas utiliser `appearanceIndex`, `positionInRound`, `cardIndexInColumn` ou le rang local UI pour aligner les plateaux ;
- ne pas faire dépendre le résultat de l’ordre de parcours des objets JavaScript sans tri stable explicite ;
- ne pas répartir les validations pré-transaction dans plusieurs composants React.
- ne pas oublier de patcher les payloads `plateau_played` / `hole_added reason: played_empty_slot` et les tests liés à `targetResolvedRow` ;
- ne pas arrêter tout le resolver pour un link/conflict local insoluble : isoler la contrainte, warning, puis continuer les réparations possibles.

Livrable attendu : code + tests + mise à jour éventuelle des exports/imports, sans réintroduire de logique d’ordre dans les composants React.


8. Respecter la Definition of Done resolver avant de considérer la tâche terminée :
   - créer les typedefs/JSDoc obligatoires ;
   - isoler les fonctions pures listées en section 4.29 ;
   - supprimer le vieux resolver du chemin critique ;
   - faire passer les fixtures golden exactes ;
   - faire passer les invariants et property-based tests listés dans `docs/testing-strategy.md` ;
   - garantir que `buildColumns()` utilise `visibleResolvedRows` et jamais le rang local de colonne.
