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

## Fixtures 03 à 15 — `input` / `expected` exacts obligatoires

Les fixtures ci-dessous doivent être transcrites en tests exécutables. Les champs de warning non listés ici (`transactionId`, `eventId`, `message`, etc.) doivent être testés par le catalogue fermé des warnings ; dans les fixtures golden, le comparateur peut normaliser les warnings sur `type`, `reason`, `severity`, `cardIds`, `linkIds`, `conflictIds` et `columnIds`.

---

## fixture_03_indirect_priority_chain

But : A pousse B ; B link C ; C pousse D ; D link E. La priorité se propage sur deux links.

```js
{
  name: "fixture_03_indirect_priority_chain",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_v1", columnId: "voice", baseOrder: 2 },
      { cardId: "D_g1", columnId: "guitar", baseOrder: 1 },
      { cardId: "C_g1", columnId: "guitar", baseOrder: 2 },
      { cardId: "E_b1", columnId: "bass", baseOrder: 1 }
    ],
    links: [
      { linkId: "link_B_C", targetCardIds: ["B_v1", "C_g1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 },
      { linkId: "link_D_E", targetCardIds: ["D_g1", "E_b1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 11 }
    ],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_v1: { cardId: "B_v1", columnId: "voice", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      D_g1: { cardId: "D_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_g1: { cardId: "C_g1", columnId: "guitar", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      E_b1: { cardId: "E_b1", columnId: "bass", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "move", anchorCardId: "A_v1", afterTargetCardId: "B_v1", beforeTargetCardId: null, affectedCardIds: ["A_v1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      B_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      A_v1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      D_g1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      E_b1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["B_v1", "A_v1"], guitar: ["C_g1", "D_g1"], bass: ["E_b1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## fixture_04_link_fixed_target

But : une target locked impose sa row au groupe linké.

```js
{
  name: "fixture_04_link_fixed_target",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 3, locked: true }
    ],
    links: [{ linkId: "link_A_B", targetCardIds: ["A_v1", "B_g1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 }],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 3, visualIndex: 2, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "link_created", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 3, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 3, visualIndex: 1, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [3],
    projectionWarnings: []
  }
}
```

---

## fixture_05_link_fixed_impossible

But : deux fixed rows différentes rendent le link localement insoluble.

```js
{
  name: "fixture_05_link_fixed_impossible",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1, locked: true },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 3, played: true }
    ],
    links: [{ linkId: "link_A_B", targetCardIds: ["A_v1", "B_g1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 }],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 3, visualIndex: 2, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "link_created", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 3, visualIndex: 2, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1, 3],
    projectionWarnings: [{ type: "link_unresolvable", reason: "linked_cards_fixed_on_different_rows", severity: "warning", cardIds: ["A_v1", "B_g1"], linkIds: ["link_A_B"] }]
  }
}
```

---

## fixture_06_conflict_mobile_repair

But : à coût égal, la card au tri stable le plus faible garde sa row et l’autre descend au slot disponible le plus proche.

```js
{
  name: "fixture_06_conflict_mobile_repair",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 1 }
    ],
    links: [],
    conflicts: [{ conflictId: "conflict_A_B", scope: "appearance", targetCardIds: ["A_v1", "B_g1"], reason: "manual", active: true, createdAtOrder: 10 }],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "conflict_created", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## fixture_07_conflict_fixed_impossible

But : conflict entre deux fixed cards même row produit un warning, sans déplacer.

```js
{
  name: "fixture_07_conflict_fixed_impossible",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1, played: true },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 1, locked: true }
    ],
    links: [],
    conflicts: [{ conflictId: "conflict_A_B", scope: "appearance", targetCardIds: ["A_v1", "B_g1"], reason: "manual", active: true, createdAtOrder: 10 }],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "conflict_created", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1],
    projectionWarnings: [{ type: "conflict_unresolvable", reason: "conflicted_cards_fixed_on_same_row", severity: "warning", cardIds: ["A_v1", "B_g1"], conflictIds: ["conflict_A_B"] }]
  }
}
```

---

## fixture_08_rounds_mixed_valid

But : une round 2 peut passer avant une round 1. Le round n’ajoute aucun coût.

```js
{
  name: "fixture_08_rounds_mixed_valid",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1, appearanceIndex: 1 },
      { cardId: "B_v2", columnId: "voice", baseOrder: 2, appearanceIndex: 2 }
    ],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_v2: { cardId: "B_v2", columnId: "voice", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
    }},
    transactionContext: { intent: "move", anchorCardId: "B_v2", afterTargetCardId: null, beforeTargetCardId: "A_v1", affectedCardIds: ["B_v2"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      B_v2: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      A_v1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
    },
    orderedCardIdsByColumnId: { voice: ["B_v2", "A_v1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## fixture_09_hidden_column_ignored

But : une contrainte visible ↔ hidden ne déplace jamais la card visible et produit un warning info déterministe.

```js
{
  name: "fixture_09_hidden_column_ignored",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 2 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 5, hidden: true }
    ],
    links: [{ linkId: "link_A_B", targetCardIds: ["A_v1", "B_g1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 }],
    conflicts: [],
    hiddenColumnIds: ["guitar"],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 2, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 5, visualIndex: 2, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "neutral", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 2, visualIndex: 1, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"] },
    visibleResolvedRows: [2],
    projectionWarnings: [{ type: "hidden_column_constraint_ignored", reason: "hidden_column_not_resolved", severity: "info", cardIds: ["A_v1", "B_g1"], linkIds: ["link_A_B"], columnIds: ["guitar"] }]
  }
}
```

---

## fixture_10_skip_delinks_only_target

But : skip B dans un groupe A-B-C retire seulement B du groupe pour cette appearance ; A et C restent alignées.

```js
{
  name: "fixture_10_skip_delinks_only_target",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 1 },
      { cardId: "C_b1", columnId: "bass", baseOrder: 1 }
    ],
    links: [{ linkId: "link_A_C_after_skip", targetCardIds: ["A_v1", "C_b1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 11 }],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_b1: { cardId: "C_b1", columnId: "bass", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "skip", anchorCardId: "B_g1", affectedCardIds: ["A_v1", "B_g1", "C_b1"], preferredResolvedRow: 2, metadata: { skippedAppearanceId: "B_g1" } },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_b1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"], bass: ["C_b1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## fixture_11_visual_index_global_not_local_rank

But : le `visualIndex` est une compression globale des `resolvedRows`, pas un rang local par colonne.

```js
{
  name: "fixture_11_visual_index_global_not_local_rank",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 7 },
      { cardId: "C_b1", columnId: "bass", baseOrder: 3 }
    ],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 7, visualIndex: 3, cardIndexInColumn: 1 },
      C_b1: { cardId: "C_b1", columnId: "bass", resolvedRow: 3, visualIndex: 2, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "neutral", anchorCardId: null, affectedCardIds: [] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      C_b1: { resolvedRow: 3, visualIndex: 2, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 7, visualIndex: 3, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"], bass: ["C_b1"] },
    visibleResolvedRows: [1, 3, 7],
    projectionWarnings: []
  }
}
```

---

## fixture_12_same_event_log_same_projection

But : l’ordre des arrays en entrée ne doit pas changer la sortie.

```js
{
  name: "fixture_12_same_event_log_same_projection",
  input: {
    variants: ["normal_order", "arrays_shuffled"],
    cards: [
      { cardId: "B_g1", columnId: "guitar", baseOrder: 1 },
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 }
    ],
    links: [{ linkId: "link_A_B", targetCardIds: ["B_g1", "A_v1"], active: true, reorderStrategy: "move_to_first", createdAtOrder: 10 }],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "neutral", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"] },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1],
    projectionWarnings: []
  }
}
```

---

## fixture_13_link_removed_no_magic_restore

But : supprimer un link ne remet pas une card à son ancien ordre pré-link.

```js
{
  name: "fixture_13_link_removed_no_magic_restore",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 3 }
    ],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "neutral", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"], metadata: { removedLinkId: "link_A_B" } },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1],
    projectionWarnings: []
  }
}
```

---

## fixture_14_conflict_removed_no_magic_restore

But : supprimer un conflict ne remet pas une card à son ancien ordre pré-conflict.

```js
{
  name: "fixture_14_conflict_removed_no_magic_restore",
  input: {
    cards: [
      { cardId: "A_v1", columnId: "voice", baseOrder: 1 },
      { cardId: "B_g1", columnId: "guitar", baseOrder: 1 }
    ],
    links: [],
    conflicts: [],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      A_v1: { cardId: "A_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { cardId: "B_g1", columnId: "guitar", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 1 }
    }},
    transactionContext: { intent: "neutral", anchorCardId: null, affectedCardIds: ["A_v1", "B_g1"], metadata: { removedConflictId: "conflict_A_B" } },
    config: {}
  },
  expected: {
    layoutByCardId: {
      A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      B_g1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 1 }
    },
    orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["B_g1"] },
    visibleResolvedRows: [1, 2],
    projectionWarnings: []
  }
}
```

---

## fixture_15_participation_conflict_expansion

But : un conflict `scope: participation` est étendu en toutes les paires concrètes visibles et toutes sont séparées si c’est réparable.

```js
{
  name: "fixture_15_participation_conflict_expansion",
  input: {
    cards: [
      { cardId: "P1_v1", columnId: "voice", participationId: "participation_P1", baseOrder: 1, appearanceIndex: 1 },
      { cardId: "P1_v2", columnId: "voice", participationId: "participation_P1", baseOrder: 2, appearanceIndex: 2 },
      { cardId: "P2_g1", columnId: "guitar", participationId: "participation_P2", baseOrder: 1, appearanceIndex: 1 },
      { cardId: "P2_g2", columnId: "guitar", participationId: "participation_P2", baseOrder: 2, appearanceIndex: 2 }
    ],
    links: [],
    conflicts: [{ conflictId: "conflict_P1_P2", scope: "participation", targetParticipationIds: ["participation_P1", "participation_P2"], reason: "instrument_constraint", active: true, createdAtOrder: 10 }],
    hiddenColumnIds: [],
    previousLayout: { byCardId: {
      P1_v1: { cardId: "P1_v1", columnId: "voice", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      P1_v2: { cardId: "P1_v2", columnId: "voice", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      P2_g1: { cardId: "P2_g1", columnId: "guitar", resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      P2_g2: { cardId: "P2_g2", columnId: "guitar", resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
    }},
    transactionContext: { intent: "conflict_created", anchorCardId: null, affectedCardIds: ["P1_v1", "P1_v2", "P2_g1", "P2_g2"], metadata: { expandedConflictPairs: [["P1_v1", "P2_g1"], ["P1_v1", "P2_g2"], ["P1_v2", "P2_g1"], ["P1_v2", "P2_g2"]] } },
    config: {}
  },
  expected: {
    layoutByCardId: {
      P1_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
      P1_v2: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 },
      P2_g1: { resolvedRow: 3, visualIndex: 3, cardIndexInColumn: 1 },
      P2_g2: { resolvedRow: 4, visualIndex: 4, cardIndexInColumn: 2 }
    },
    orderedCardIdsByColumnId: { voice: ["P1_v1", "P1_v2"], guitar: ["P2_g1", "P2_g2"] },
    visibleResolvedRows: [1, 2, 3, 4],
    projectionWarnings: []
  }
}
```

Règle de test finale : les fixtures 01 à 15 doivent exister comme données exécutables dans le code. Aucune fixture obligatoire ne doit rester seulement sous forme de description prose ou de tableau.

---

## fixture_16_move_missing_before_after_target

But : si les bornes `beforeTargetCardId` / `afterTargetCardId` d’un move rejoué sont absentes, la card garde son layout stable et le resolver produit des warnings `missing_target` / `move_target_missing` déterministes. Cette fixture clarifie que l’absence de borne ne doit pas se transformer implicitement en move en fin de colonne.

Expected canonique :

```js
{
  layoutByCardId: {
    A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
    B_v1: { resolvedRow: 2, visualIndex: 2, cardIndexInColumn: 2 }
  },
  orderedCardIdsByColumnId: { voice: ["A_v1", "B_v1"] },
  visibleResolvedRows: [1, 2],
  projectionWarnings: [
    { type: "missing_target", reason: "move_target_missing", severity: "warning", cardIds: ["missing_after"] },
    { type: "missing_target", reason: "move_target_missing", severity: "warning", cardIds: ["missing_before"] }
  ]
}
```

---

## fixture_17_plateau_played_empty_visual_cell

But : un plateau joué avec une cellule visuelle vide matérialisée en hole joué utilise `playedResolvedRow` / `targetResolvedRow`, jamais `plateauIndex` local.

Expected canonique :

```js
{
  layoutByCardId: {
    A_v1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
    H_g1: { resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 }
  },
  orderedCardIdsByColumnId: { voice: ["A_v1"], guitar: ["H_g1"] },
  visibleResolvedRows: [1],
  projectionWarnings: []
}
```

---

## fixture_18_lock_captures_current_resolved_row

But : un lock capture la `resolvedRow` courante depuis le layout précédent et ne recompacte pas cette row en vérité logique.

Expected canonique :

```js
{
  layoutByCardId: {
    A_v1: { resolvedRow: 4, visualIndex: 1, cardIndexInColumn: 1 }
  },
  orderedCardIdsByColumnId: { voice: ["A_v1"] },
  visibleResolvedRows: [4],
  projectionWarnings: []
}
```
