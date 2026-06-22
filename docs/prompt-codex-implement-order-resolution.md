# Prompt Codex — Implémenter le solver de réorder par contraintes

Lis d’abord toute la documentation suivante avant de modifier le code :

- `docs/order-resolution-hierarchy-spec.md`
- `docs/projection-engine-spec.md`
- `docs/confiture_event_actions_spec.md`
- `docs/v0-round-order-and-no-between-cards.md`
- `docs/event-payloads-reference.md`
- `docs/testing-strategy.md`

Objectif : implémenter un moteur frontend pur et déterministe de résolution d’ordre, basé sur un solver de contraintes discrètes.

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
   - scoring des réparations ;
   - normalisation finale stable ;
   - production de `projectionWarnings` déterministes.

2. Intégrer le resolver dans le pipeline de projection :
   - appliquer les events d’une transaction ;
   - appeler `resolveOrderAfterTransaction(state, context)` ;
   - passer ensuite à la transaction suivante.

3. Implémenter les contraintes dures :
   - une card reste dans sa colonne instrument ;
   - une colonne ne peut pas avoir deux cards sur la même row résolue ;
   - played ne bouge jamais ;
   - locked ne bouge jamais ;
   - links alignés si possible ;
   - conflicts séparés si possible ;
   - links impossibles détectés : même colonne, conflict direct, fixed rows différentes ;
   - conflicts impossibles détectés : deux fixed sur la même row.

4. Implémenter les contraintes soft :
   - respecter l’intention de la dernière action autant que possible ;
   - minimiser le nombre de cards déplacées ;
   - minimiser la distance totale de déplacement ;
   - préserver l’ordre courant quand aucune contrainte ne force un changement ;
   - fallback stable par ordre de création puis id ;
   - ne jamais scorer le round comme priorité.

5. Implémenter la propagation :
   - une card déplacée peut pousser une autre card ;
   - si la card poussée est linkée, son groupe linké doit être réaligné ;
   - si ce réalignement pousse encore une card linkée, la propagation continue ;
   - la boucle doit être bornée et retourner `resolver_max_passes_reached` si elle n’atteint pas un état stable.

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
   - undo/redo linéaire puis replay cohérent.

Livrable attendu : code + tests + mise à jour éventuelle des exports/imports, sans réintroduire de logique d’ordre dans les composants React.
