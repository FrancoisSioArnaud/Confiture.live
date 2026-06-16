# Audit d’alignement — `docs/drawer-call-spec.md`

Date d’audit : 2026-06-16

## Périmètre audité

Cet audit compare la spec du drawer d’appel avec l’implémentation actuelle côté frontend/projection/transactions.

Fichiers principaux audités :

- `docs/drawer-call-spec.md`
- `frontend/src/features/table/components/JamTable.jsx`
- `frontend/src/features/table/utils/buildCallDrawerTransaction.js`
- `frontend/src/features/table/utils/buildCallDrawerTransaction.test.js`
- `frontend/src/features/projection/applyEvent.js`
- `frontend/src/features/projection/selectors.js`
- `frontend/src/features/transactions/eventFactories.js`

## Synthèse

Statut global : **aligné sur les flux V0 principaux, avec quelques enrichissements P2 restants**.

Le flux principal du drawer d’appel existe : ouverture depuis une ligne plateau, affichage des instruments visibles, action `Plateau joué`, gestion d’un musicien introuvable, propositions de remplaçants, option `Plateau sans [instrument manquant]`, création de transactions event-sourced, delink préalable et maintien du drawer ouvert après remplacement.

Les écarts restants concernent surtout des enrichissements P2 : détails avancés de calcul “rejoue”, couverture UI automatisée plus large, et extraction complète des règles de présentation hors composant.

## Conforme

| Point spec | Statut | Preuve / commentaire |
|---|---:|---|
| Accès depuis une action de plateau | Conforme | Le rail de plateau expose un bouton `Appeler` par ligne plateau. |
| Drawer ciblé par `plateauIndex` projeté | Conforme | `CallDrawer` reçoit `plateauIndex` et lit les cards à cet index dans les colonnes projetées. |
| Format responsive mobile/tablette | Conforme minimal | Drawer plein écran mobile, latéral à partir du breakpoint `sm`. |
| Bouton `Plateau joué` sticky en bas | Conforme | Le bouton principal est dans un `Paper` sticky en bas du drawer. |
| Instruments visibles dans l’ordre de la jam | Conforme | Le drawer s’appuie sur `projection.columns`, construites depuis les instruments visibles triés. |
| Holes affichés comme `Sans musicien` | Conforme | Les cards de type `hole` sont rendues avec le libellé `Sans musicien`. |
| `plateau_played` pour appearances et holes | Conforme | `markPlayed` construit une transaction `plateau_played` avec tous les targets du plateau. |
| Fermeture automatique après `plateau_played` | Conforme | `markPlayed` appelle `close()` après transaction. |
| `Musicien introuvable` ne crée pas d’état durable `temporarily_away` | Conforme | La transaction produit `appearance_skipped` et aucun event/statut temporaire durable. |
| Suppression de links avant skip/remplacement | Conforme partiel | Les builders ajoutent des `link_removed` pour la source et/ou le remplaçant linkés. |
| Jusqu’à trois remplaçants | Conforme | `replacementCandidatesForCallDrawer` filtre puis applique `.slice(0, 3)`. |
| Remplaçants même colonne, futurs, non played, non locked, participant actif | Conforme | Le helper filtre sur colonne, index futur, `played`, `locked`, et statut participant. |
| Exclusion des remplaçants en conflict avec le plateau | Conforme partiel | Le helper exclut les conflicts actifs avec les autres cards du plateau ; la couverture reste limitée aux cards existantes du plateau courant. |
| Option `Plateau sans [instrument manquant]` toujours affichée | Conforme | L’option est rendue même lorsque la liste de candidats est vide. |
| `Plateau sans...` = `hole_added` + `appearance_skipped` + éventuel `link_removed` | Conforme | Le builder produit cette séquence et déplace l’appearance après le hole. |
| Drawer reste ouvert après remplacement / sans musicien | Conforme | Les handlers réinitialisent seulement l’état `missingCard`, sans appeler `close()`. |
| Events interdits absents du drawer | Conforme | Aucun `participant_marked_left`, `participant_removed`, `participation_removed`, `participant_updated`, ou `appearance_note_updated` n’est produit par ces builders. |

## Partiellement conforme

| Point spec | Écart | Impact | Recommandation |
|---|---|---|---|
| Badges `lié`, `rejoue`, `verrouillé` | `lié`, `verrouillé`, `joué` existent ; le badge/indication `rejoue` n’est pas calculé dans le drawer. | L’organisateur a moins d’information sur les répétitions de passage. | Ajouter un helper pur qui détecte si le participant a déjà joué ou rejoue dans le round/index concerné, puis afficher l’indication. |
| UI d’un remplaçant proposé | Le bouton affiche nom + `prochain passage` + `lié`, mais pas l’instrument ni `rejoue en round X` / `déplacera ce passage`. | Informations de décision incomplètes. | Ajouter les métadonnées calculées via helper pur et tests associés. |
| `respecter les links/conflicts autant que possible` | Les links sont supprimés si nécessaire ; il n’y a pas de stratégie plus fine de conservation. | Acceptable V0 mais moins riche que la spec. | Documenter l’hypothèse ou renforcer le helper de sélection/remplacement. |
| `plateau_played` feedback visuel sans snackbar | Le drawer se ferme, mais le rail peut aussi marquer joué hors drawer. | Le comportement global est cohérent, mais pas testé spécifiquement sur le drawer. | Ajouter un test UI du drawer si la suite Testing Library est disponible. |
| Projection selectors du drawer | `buildCallDrawerSelectors` reste très minimal et ne porte pas le plateau courant. | Une partie de la logique métier/présentation reste dans `JamTable.jsx`. | Déplacer les règles de composition du plateau et candidats vers des selectors/helpers purs. |

## Non conforme / risques à corriger

| Point spec | Écart | Risque | Correctif recommandé |
|---|---|---|---|
| Couverture UI automated du drawer | Les guards locked/played et dialogs ont été alignés dans le composant, mais ne disposent pas encore d’un test RTL dédié au drawer complet. | Régression possible sur un flux critique. | P1 : ajouter un test UI ciblé dès stabilisation de la suite RTL existante. |

## Tests existants pertinents

- `frontend/src/features/table/utils/buildCallDrawerTransaction.test.js` couvre :
  - proposition de candidats futurs non locked ;
  - exclusion d’un candidat en conflict avec le plateau ;
  - transaction de remplacement avec `link_removed`, `appearance_moved_between`, `appearance_skipped` ;
  - transaction `Plateau sans...` avec `hole_added`, `appearance_skipped`, et déplacement après le hole.
- `frontend/src/features/projection/projectJamState.test.js` et `frontend/src/features/projection/projectionRules.test.js` couvrent la projection de `appearance_skipped`, la suppression de links, les holes et l’absence d’état durable temporaire.

## Recommandations priorisées

### P0 / P1 court terme

1. Ajouter un test UI ciblé pour le drawer d’appel : source locked, plateau played, dialogs source/remplaçant linkés.
2. Étendre les tests projection/helpers sur les edge cases links/conflicts/played/locked.
3. Continuer à extraire les règles de présentation du drawer hors JSX quand elles deviennent plus riches.

### P1 / P2 consolidation

1. Extraire la composition du drawer d’appel dans un helper pur : plateau targets, états read-only, candidats, raisons d’indisponibilité.
2. Ajouter un ranking déterministe des remplaçants selon la priorité de la spec.
3. Enrichir l’UI remplaçant avec instrument, link détaillé, indication `rejoue`, et “déplacera ce passage”.
4. Étendre les tests projection/helpers sur les edge cases links/conflicts/played/locked.

## Conclusion

Le drawer d’appel couvre les scénarios principaux attendus par la spec et respecte l’approche event-sourcing. Les protections locked/played, le wording des dialogs de delink, le feedback de remplacement et le ranking déterministe des remplaçants ont été alignés. Les prochains travaux recommandés sont surtout des tests UI dédiés et l’enrichissement P2 des informations de candidats.
