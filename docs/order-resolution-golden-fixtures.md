# V0 — Golden fixtures du resolver de réorder

Ce fichier complète `docs/order-resolution-hierarchy-spec.md`. Il définit des fixtures golden exactes que la réécriture du resolver doit implémenter en tests purs.

## Convention commune

Les exemples utilisent un shape compact. Tout champ non listé prend la valeur par défaut suivante :

```js
{
  type: "appearance",
  participantId: null,
  participationId: null,
  appearanceId: cardId,
  holeId: null,
  appearanceIndex: 1,
  createdAtOrder: baseOrder,
  previousResolvedRow: baseOrder,
  played: false,
  locked: false,
  deleted: false,
  hidden: false
}
```

Colonnes de référence :

```txt
voice = instrument_voice
guitar = instrument_guitar
bass = instrument_bass
```

Les ids d’appearance doivent suivre le format déterministe :

```txt
appearance_{participationId}_{appearanceIndex}
```

Dans les fixtures compactes ci-dessous, `A_v1` signifie une card dont l’id exact en test doit être par exemple `appearance_participation_A_voice_1`. Les tests peuvent utiliser des helpers pour générer ces ids, mais les `expected` doivent comparer les ids exacts produits.

---

## fixture_01_drag_simple_push

But : un move simple garde l’anchor à la place demandée et pousse la card suivante.

```js
{
  name: "fixture_01_drag_simple_push",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_v1", columnId: "voice", baseOrder: 2 },
      { cardId: "C_v1", columnId: "voice", baseOrder: 3 }
    ],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_v1: { cardId: "B_v1", columnId: "voice", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      C_v1: { cardId: "C_v1", columnId: "voice", resolvedRow: 3, visualIndex: 3, cardIndexInColumn: 3 }
    }},
    transactionContext: { intent: "move", anchorCardId: "C_v1", afterTargetCardId: "A_v1", beforeTargetCardId: "B_v1", affectedCardIds: ["C_v1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_v1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      B_v1: { resolvedRow: 3, visualIndex: 3, cardIndexInColumn: 3 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1", "C_v1", "B_v1"] },
    visibleResolvedRows: [1, 2, 3],
    projectionWarnings: []
  }
}
```

---

## fixture_02_push_link_chain

But : une card poussée qui est linkée transmet son déplacement à son link group.

```js
{
  name: "fixture_02_push_link_chain",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_v1", columnId: "voice", baseOrder: 2 },
      { cardId: "D_g1", columnId: "guitar", baseOrder: 1 },
      { cardId: "E_g1", columnId: "guitar", baseOrder: 2 }
    ],
    links: [{ linkId: "link_B_E", targetCardIds: ["B_v1", "E_g1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 }],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_v1: { cardId: "B_v1", columnId: "voice", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      D_g1: { cardId: "D_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      E_g1: { cardId: "E_g1", columnId: "guitar", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
    }},
    transactionContext: { intent: "move", anchorCardId: "A_v1", afterTargetCardId: "B_v1", beforeTargetCardId: null, affectedCardIds: ["A_v1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      B_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      E_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      A_v1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      D_g1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
    },
    orderedCardIdsByColumnId: { voice: ["B_v1", "A_v1"], guitar: ["E_g1", "D_g1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## Fixtures 03 à 15 — expected exact obligatoire

Ces fixtures doivent être implémentées avec les mêmes champs exacts que les deux exemples précédents. Le tableau ci-dessous verrouille le résultat attendu ; les tests doivent traduire chaque ligne en input/output JSON explicite.

| Fixture | Input minimal | Expected exact |
|---|---|---|
| `fixture_03_indirect_priority_chain` | A pousse B ; B link C ; C pousse D ; D link E | A/B/C/D/E présents ; B et C alignés ; D et E alignés ; aucune collision ; priorité propagée dans l’ordre `user_move > pushed > linked > pushed > linked`. |
| `fixture_04_link_fixed_target` | A libre row 1, B locked row 3, link A-B | A prend `resolvedRow: 3`, B reste `3`, warning `[]`. |
| `fixture_05_link_fixed_impossible` | A locked row 1, B played row 3, link A-B | A reste `1`, B reste `3`, warning `{ type: "link_unresolvable", reason: "linked_cards_fixed_on_different_rows" }`. |
| `fixture_06_conflict_mobile_repair` | A row 1, B row 1, conflict A-B, aucun fixed | Une des deux cards bouge vers le slot disponible le moins coûteux ; aucune même row ; warning `[]`; tie-break par previous order puis id. |
| `fixture_07_conflict_fixed_impossible` | A played row 1, B locked row 1, conflict A-B | A reste `1`, B reste `1`, warning `{ type: "conflict_unresolvable", reason: "conflicted_cards_fixed_on_same_row" }`. |
| `fixture_08_rounds_mixed_valid` | Colonne voice : A round 1 row 1, B round 2 déplacée row 1, A poussée row 2 | Layout final peut avoir B round 2 avant A round 1 ; warning `[]`. |
| `fixture_09_hidden_column_ignored` | A visible link B hidden ; B aurait imposé row 5 | A garde sa row visible ; B absent du layout visible ; aucun déplacement visible ; warning optionnel `hidden_column_constraint_ignored` seulement en mode debug. |
| `fixture_10_skip_delinks_only_target` | A-B-C link group ; skip B | B est retirée du link group pour cette appearance et repoussée seule ; A et C restent alignées ; warning `[]`. |
| `fixture_11_visual_index_global_not_local_rank` | visibleResolvedRows attendues `[1, 3, 7]` avec cards sur colonnes différentes | visualIndex map `{1:1,3:2,7:3}` ; aucune reconstruction par rang local ; cellules vides visuelles non persistées. |
| `fixture_12_same_event_log_same_projection` | même input rejoué deux fois avec arrays mélangés | `layoutByCardId`, `orderedCardIdsByColumnId`, `visibleResolvedRows`, `projectionWarnings` strictement égaux. |
| `fixture_13_link_removed_no_magic_restore` | A-B link a déplacé B ; link_removed | B reste sur le layout courant sauf autre contrainte ; ne revient pas à son ordre pré-link. |
| `fixture_14_conflict_removed_no_magic_restore` | conflict a poussé B ; conflict_removed | B reste sur le layout courant sauf autre contrainte ; ne revient pas à son ordre pré-conflict. |
| `fixture_15_participation_conflict_expansion` | participation P1 visible r1/r2 et P2 visible r1/r2 avec conflict scope participation | Expansion en 4 paires concrètes ; aucune paire sur même resolvedRow si réparable ; warning `[]`. |

Règle de test : les fixtures 03 à 15 ne peuvent pas rester sous forme de tableau dans le code. Le fichier de tests doit contenir les `input` et `expected` JSON exacts pour chaque fixture, en reprenant les expected ci-dessus comme contrat.
