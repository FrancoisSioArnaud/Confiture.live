# Prompt Codex — Implémenter le solver de réorder par contraintes

Lis d’abord toute la documentation suivante avant de modifier le code :

- `docs/order-resolution-hierarchy-spec.md`
- `docs/projection-engine-spec.md`
- `docs/confiture_event_actions_spec.md`
- `docs/v0-round-order-and-no-between-cards.md`
- `docs/event-payloads-reference.md`
- `docs/testing-strategy.md`

Objectif : implémenter un moteur frontend pur et déterministe de résolution d’ordre, basé sur un solver de contraintes discrètes.

La section `4. Arbitrages canoniques du resolver` de `docs/order-resolution-hierarchy-spec.md` est normative. Elle doit être appliquée telle quelle : hiérarchie hard/conditional/soft, politique refus vs warning, format des `projectionWarnings`, séparation `resolvedRow`/`visualIndex`, stratégie de collision, scoring chiffré et propagation chiffrée.

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
   - séparation stricte `resolvedRow` / `visualIndex` ;
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
   - `resolvedRow` pour constraints, `visualIndex` pour affichage compact ;
   - collision : fixed garde la place, sinon priorité la plus haute, sinon stabilité, card poussée vers le slot valide le plus proche avec préférence vers le bas en cas d’égalité ;
   - scoring numérique `RESOLUTION_COST` ;
   - propagation numérique `PROPAGATION_PRIORITY` ;
   - ne jamais scorer le round comme priorité.

5. Implémenter la propagation :
   - une card déplacée peut pousser une autre card ;
   - si la card poussée est linkée, son groupe linké doit être réaligné ;
   - si ce réalignement pousse encore une card linkée, la propagation continue ;
   - si plusieurs chemins donnent une priorité à la même card, conserver la priorité la plus haute ;
   - sous la priorité utile 100, utiliser le fallback de stabilité ;
   - la boucle doit être bornée et retourner `resolver_max_passes_reached` ou `resolver_cycle_detected` si elle n’atteint pas un état stable.

6. Ajouter ou mettre à jour les tests :
   - même event log rejoué deux fois → même projection exacte ;
   - drag simple qui pousse une card mobile ;
   - drag qui pousse une card linkée et propage son link ;
   - propagation en chaîne `A pousse B`, `B link C`, `C pousse D`, `D link E` ;
   - link aligné avec target locked ;
   - link impossible avec deux targets fixed sur rows différentes ;
   - conflict simple entre deux cards mobiles ;
   - conflict où une card est locked ;
   - conflict impossible entre deux cards fixed ;
   - création de link refusée si conflict direct ;
   - création de link refusée si deux targets dans la même colonne ;
   - suppression de link ne provoquant pas un retour magique ;
   - suppression de conflict ne provoquant pas un retour magique ;
   - reveal round puis résolution par solver ;
   - mélange de rounds autorisé si nécessaire ;
   - played et locked immobiles ;
   - collision entre deux cards mobiles : garde la plus prioritaire et pousse vers le slot valide le plus proche ;
   - collision avec une card fixed : la fixed garde sa row ;
   - `projectionWarnings` produits au format standard ;
   - `resolvedRow` stable pour played/locked malgré normalisation `visualIndex` ;
   - score égal départagé par ordre précédent, ordre de création, puis id ;
   - undo/redo linéaire puis replay cohérent.

Livrable attendu : code + tests + mise à jour éventuelle des exports/imports, sans réintroduire de logique d’ordre dans les composants React.
