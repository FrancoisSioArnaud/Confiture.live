# Prompt Codex — Implémenter `frontend/src/features/projection/orderResolution.js`

Lis d’abord toute la documentation suivante avant de modifier le code :

- `docs/order-resolution-hierarchy-spec.md`
- `docs/projection-engine-spec.md`
- `docs/confiture_event_actions_spec.md`
- `docs/v0-round-order-and-no-between-cards.md`
- `docs/event-payloads-reference.md`
- `docs/testing-strategy.md`

Objectif : implémenter un moteur frontend pur et déterministe de résolution d’ordre.

Créer le module :

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

Hiérarchie à implémenter, du plus prioritaire au moins prioritaire :

```txt
0. removed / left / hidden
1. played
2. locked
3. anchor de la dernière action utilisateur
4. décisions d’appel : appearance_skipped / remplacement / faire sans musicien
5. conflict
6. link
7. manual order existant
8. round / appearanceIndex
9. base order
10. fallback stable par id
```

Implémentation attendue :

1. Ajouter `orderResolution.js` avec au minimum :
   - `resolveOrderAfterTransaction(state, context)` ;
   - helpers purs pour collecter les cards actives par colonne ;
   - identification des anchors ;
   - identification des cards played/locked ;
   - construction des groupes linkés ;
   - détection des conflicts ;
   - tri stable final.

2. Intégrer le resolver dans le pipeline de projection :
   - appliquer les events d’une transaction ;
   - appeler `resolveOrderAfterTransaction(state, context)` ;
   - passer ensuite à la transaction suivante.

3. Corriger le bug suivant :

```txt
Avant : A, B, C, A', B', C'
A, B, C et A' sont joués.
Ajout de D.
Attendu : A, B, C, A', D, B', C', D'
Interdit : A, B, C, D, A', B', C', D'
```

4. Implémenter la logique d’anchor :
   - drag manuel : card déplacée ;
   - link_created : `anchorTarget` ;
   - conflict_created : `anchorTargetId` ;
   - participation_added : nouvelles appearances ;
   - hole_added : nouveau hole ;
   - appearance_skipped : décision d’appel ;
   - plateau_played : targets figées.

5. Implémenter les règles link/conflict :
   - si A est déplacé et linké à C, C suit A ;
   - si A est anchor et conflict avec B, B bouge si mobile ;
   - conflict gagne contre link ;
   - rien ne doit déplacer played ou locked ;
   - si aucune résolution valide n’existe, produire un warning déterministe ou refuser côté builder si c’est encore possible.

6. Stabiliser played/locked :
   - quand une card devient played, conserver une position figée dérivée (`playedAtPlateauIndex` / `frozenOrderKey` ou équivalent) ;
   - quand une card devient locked, conserver sa position courante tant qu’elle reste locked ;
   - ces champs doivent être recalculables depuis l’eventLog.

7. Ajouter des tests purs frontend couvrant au minimum :
   - replay identique deux fois ;
   - ajout D après A' joué ;
   - drag avec conflict, target mobile ;
   - drag avec conflict, target played ;
   - drag avec conflict, target locked ;
   - drag d’une card linkée ;
   - drag d’une card linkée avec conflict externe ;
   - link direct refusé si conflict direct ;
   - lock empêchant une insertion de passer devant ;
   - link_removed et conflict_removed ne provoquent pas de retour magique ;
   - round_revealed respecte played/locked/manual/link/conflict.

8. Adapter les tests existants si nécessaire, mais ne supprime pas de couverture utile.

9. Lancer :

```bash
cd frontend
npm test -- --run
npm run build
```

Livrable attendu :

- code implémenté ;
- tests ajoutés/mis à jour ;
- aucun changement de logique UI non demandé ;
- pas de refactor massif hors projection/ordering si évitable ;
- résumé clair des fichiers modifiés et des scénarios validés.
