# Testing Strategy — V0 sans client sessions

## 1. Objectif

Les tests V0 doivent vérifier la sync local-first/offline sans client sessions.

---

## 2. Tests backend attendus

### Transactions acceptées sans lease

`POST /api/jams/:jamId/transactions/` doit accepter une transaction valide sans `leaseToken`.

### Transactions multi-device acceptées

Deux transactions issues de deux `clientId` différents doivent être acceptées dans l'ordre d'arrivée serveur.

### `clientSequenceNumber` metadata only

Deux transactions différentes avec le même `clientId` et le même `clientSequenceNumber` ne doivent pas être refusées pour cette raison.

### `baseServerSequenceNumber` debug only

Une transaction avec `baseServerSequenceNumber` inférieur au dernier numéro serveur doit être acceptée.

### Endpoints client-session supprimés

Les routes suivantes doivent retourner 404 ou ne pas être déclarées :

```txt
/api/jams/:jamId/client-session/acquire/
/api/jams/:jamId/client-session/heartbeat/
/api/jams/:jamId/client-session/release/
/api/jams/:jamId/client-session/takeover/
```

### Modèle supprimé

`JamClientSession` ne doit plus être importable depuis `jams.models`.

---

## 3. Tests frontend attendus

### Sync queue

- pousse une transaction sans session ;
- n'envoie pas `leaseToken` ;
- garde pending en offline ;
- retry en erreur réseau ;
- marque synced sur ack backend.

### Page jam

- ne tente pas `acquireClientSession` au chargement ;
- ne démarre pas de heartbeat ;
- ne libère pas de session au démontage ;
- n'affiche pas `Reprendre le contrôle` ;
- permet les actions dès que la jam est chargée.

### NewJamPage

- crée la jam ;
- ne tente pas d'acquérir une session après création ;
- navigue vers la page jam après succès.

### API client

- `pushTransaction` ne prend plus `leaseToken` ;
- `postSnapshot` ne prend plus `leaseToken` ;
- les fonctions `acquireClientSession`, `heartbeatClientSession`, `releaseClientSession`, `takeoverClientSession` sont supprimées.

---

## 4. Tests supprimés ou déplacés V1

Déplacer/supprimer les tests portant sur :

- lease actif ;
- heartbeat ;
- takeover ;
- expiration de session ;
- `jam_locked_by_other_client` ;
- `lease_lost` ;
- `session_required`.

Ces scénarios appartiennent à une future V1.


---

## 5. Tests moteur d’ordre déterministe

Ajouter des tests frontend purs pour :

```txt
frontend/src/features/projection/orderResolution.js
```

Cas minimaux :

1. même eventLog rejoué deux fois → même projection exacte ;
2. drag simple qui pousse une card mobile ;
3. drag qui pousse une card linkée et propage son link ;
4. propagation en chaîne `A pousse B`, `B link C`, `C pousse D`, `D link E` ;
5. link aligné avec une target locked ;
6. link impossible avec deux targets fixed sur rows différentes ;
7. link `move_to_first` choisissant la row la plus haute ;
8. link `move_to_last` choisissant la row la plus basse ;
9. link `average_position` avec arrondi canonique ;
10. link targetRow bloquée par une card fixed puis candidateRow alternative ;
11. conflict simple entre deux cards mobiles ;
12. conflict où une card est locked ;
13. conflict impossible entre deux cards fixed ;
14. link direct refusé si conflict direct ;
15. link refusé si deux targets sont dans la même colonne ;
16. conflict refusé si deux targets sont dans le même link group ;
17. link_removed ne provoquant pas un retour magique à un ancien ordre ;
18. conflict_removed ne provoquant pas un retour magique à un ancien ordre ;
19. reveal round puis résolution par solver ;
20. mélange de rounds autorisé si nécessaire ;
21. played et locked immobiles ;
22. hidden column ignorée par le resolver visible ;
23. réaffichage d’une hidden column relançant une résolution stable ;
24. hole mobile traité comme une card normale ;
25. hole played/locked immobile ;
26. hole de `jouer sans` membre d’un link explicite ;
27. `appearance_skipped` repoussant uniquement l’appearance ciblée ;
28. skip avec remplaçant linked nécessitant confirmation UI ;
29. collision entre deux cards mobiles : garde la plus prioritaire et pousse vers le slot valide le plus proche ;
30. collision avec une card fixed : la fixed garde sa row ;
31. cycle détecté avec warning `resolver_cycle_detected` ;
32. max passes atteint avec warning `resolver_max_passes_reached` ;
33. `projectionWarnings` produits au format standard ;
34. `resolvedRow` stable pour played/locked malgré normalisation `visualIndex` ;
35. deux cards avec le même `resolvedRow` obtiennent le même `visualIndex` global ;
36. le rang local dans une colonne ne sert jamais à définir un plateau logique ;
37. score égal départagé par ordre précédent, ordre de création, puis id ;
38. replay après undo linéaire produisant un état stable.

Invariants obligatoires à vérifier dans les tests pertinents :

```txt
- aucune colonne visible ne contient deux cards sur le même resolvedRow final ;
- aucune card played/locked ne change de resolvedRow ;
- aucun link résoluble ne reste désaligné ;
- aucun conflict résoluble ne reste sur le même resolvedRow ;
- les rounds ne sont jamais utilisés comme priorité d’ordre ;
- les colonnes hidden ne déplacent jamais les cards visibles ;
- les holes suivent les mêmes règles que les appearances pour ordre, lock, played et links explicites ;
- le `visualIndex` est une compression globale des `resolvedRows`, pas un index local par colonne ;
- aucun résultat ne dépend du DOM, de React, de Zustand, de Dexie, de Date.now() ou de Math.random().
```

Ces tests doivent être indépendants de React et tester le moteur de projection comme une fonction pure.


### Fixtures canoniques resolver

Créer un fichier de fixtures pur, par exemple :

```txt
frontend/src/features/projection/__fixtures__/orderResolutionFixtures.js
```

Chaque fixture doit contenir :

```js
{
  name: "fixture_02_push_link_chain",
  input: {
    cards: [],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: {},
    transactionContext: {},
    config: {}
  },
  expected: {
    layoutByCardId: {},
    orderedCardIdsByColumnId: {},
    visibleResolvedRows: [],
    projectionWarnings: []
  }
}
```

Fixtures obligatoires :

```txt
fixture_01_drag_simple_push
fixture_02_push_link_chain
fixture_03_indirect_priority_chain
fixture_04_link_fixed_target
fixture_05_link_fixed_impossible
fixture_06_conflict_mobile_repair
fixture_07_conflict_fixed_impossible
fixture_08_rounds_mixed_valid
fixture_09_hidden_column_ignored
fixture_10_skip_delinks_only_target
fixture_11_visual_index_global_not_local_rank
fixture_12_same_event_log_same_projection
fixture_13_link_removed_no_magic_restore
fixture_14_conflict_removed_no_magic_restore
fixture_15_participation_conflict_expansion
```

Ces fixtures doivent être petites et lisibles à la main. Elles verrouillent le contrat d’entrée/sortie du resolver, pas seulement le rendu UI. Les résultats attendus exacts sont définis dans `docs/order-resolution-golden-fixtures.md`; le fichier de test doit contenir les mêmes `expected` sous forme exécutable.

### Tests de contrat d’intégration resolver

Ajouter des tests purs pour :

```txt
- `buildTransactionContext()` respecte la table event → context ;
- `validateTransactionBeforeApply()` retourne des reasons stables ;
- `previousLayout` de transaction N+1 vient du layout produit par transaction N ;
- `resolvedRow` n’est jamais lu depuis un event comme vérité finale ;
- les anciens champs d’ordre sont fallback uniquement ;
- `scope: participation` est étendu en paires de cardIds visibles ;
- `buildColumns()` consomme `layoutByCardId` et ne recalcule pas les contraintes ;
- le tableau UI utilise `visibleResolvedRows` / `visualIndex` global, pas le rang local.
```



### Pipeline locale UX → replay

Ajouter des tests d'intégration frontend qui traversent le chemin local-first réaliste :

```txt
builder ou transaction déterministe
→ applyLocalTransaction
→ IndexedDB locale
→ projection
→ columns affichables
→ reloadFromLocalDb
→ même columns
```

Ces tests doivent vérifier les cards visibles (`projection.columns[*].cards`) plutôt que seulement des champs internes comme `positionInRound`, `orderScore` ou `manualOrderKey`.

Scénarios prioritaires : link créé, drag linké, played/locked + ajout participation, conflict + drag, play without / hole, appearance_skipped, hidden column, link_removed, conflict_removed, participant left/removed, et undo.


### Tests de verrouillage final resolver

Ajouter explicitement ces tests avant la réécriture complète du resolver :

```txt
- transaction multi-events : tous les events sont appliqués, puis resolver appelé une seule fois ;
- `plateau_played` depuis visualIndex : conversion correcte vers `playedResolvedRow` ;
- colonne vide sur plateau joué : création d’un hole `played_empty_slot` avec `targetResolvedRow`, inclus dans `plateau_played.targets` et fixed ;
- lock d’une card : fixed sur son resolvedRow courant, unlock sans retour magique ;
- move avec afterTarget manquant mais beforeTarget valide : placement déterministe + warning `missing_target` ;
- move avec deux bornes manquantes : fallback previousLayout/baseOrder + warning ;
- tri déterministe des cards/links/conflicts/targets malgré entrée mélangée ;
- link local insoluble n’empêche pas la réparation d’un autre link résoluble dans la même résolution ;
- conflict local insoluble n’empêche pas la réparation d’un autre conflict résoluble dans la même résolution ;
- layout partiel avec warning error ne supprime aucune card visible active.
```


### Definition of Done test pour la réécriture du resolver

La réécriture du resolver est considérée terminée seulement si :

```txt
- toutes les fixtures golden de `docs/order-resolution-golden-fixtures.md` existent en tests purs ;
- chaque fixture compare `layoutByCardId`, `orderedCardIdsByColumnId`, `visibleResolvedRows` et `projectionWarnings` ;
- les warnings appartiennent au catalogue fermé de `docs/order-resolution-hierarchy-spec.md` section 4.3 ;
- les typedefs/JSDoc du resolver existent ou sont couverts par un schema équivalent ;
- `buildTransactionContext()` respecte toute la table event → context ;
- `validateTransactionBeforeApply()` retourne des reasons stables ;
- aucun test ne dépend du DOM, de React, de Zustand, de Dexie, de `Date.now()` ou de `Math.random()` ;
- aucun tri round-first, `appearanceIndex`, `positionInRound` ou rang local de colonne ne reste dans le chemin critique ;
- même eventLog rejoué deux fois produit une sortie strictement identique.
```

### Property-based tests resolver

Ajouter des tests génératifs sur petits tableaux quand le resolver de base est stable. Les propriétés minimales sont :

```txt
- aucune card visible active ne disparaît du layout ;
- pas deux cards visibles dans la même colonne et le même resolvedRow sans warning `column_collision_unresolvable` ;
- une card played ne change jamais de resolvedRow après une transaction ultérieure ;
- une card locked ne change jamais de resolvedRow tant qu’elle reste locked ;
- tout link résoluble finit aligné ;
- tout conflict résoluble finit séparé ;
- mélanger l’ordre d’entrée des arrays cards/links/conflicts ne change pas le résultat ;
- les rounds peuvent être mélangés sans warning.
```
