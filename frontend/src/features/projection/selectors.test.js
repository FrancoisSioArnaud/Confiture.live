import { describe, expect, it } from 'vitest';
import { buildColumns } from './selectors';

function card(id, instrumentId, overrides = {}) {
  return {
    id,
    appearanceId: id,
    type: 'appearance',
    instrumentId,
    participantId: `participant_${id}`,
    participationId: `participation_${id}`,
    status: 'active',
    played: false,
    locked: false,
    ...overrides,
  };
}

function stateWithCards(appearances, layoutByCardId, visibleResolvedRows) {
  return {
    instruments: {
      instrument_voice: { instrumentId: 'instrument_voice', label: 'Chant', visible: true, orderKey: 'a' },
      instrument_guitar: { instrumentId: 'instrument_guitar', label: 'Guitare', visible: true, orderKey: 'b' },
    },
    visibleRoundsByInstrument: {},
    appearances: Object.fromEntries(appearances.map((appearance) => [appearance.id, appearance])),
    holes: {},
    layoutByCardId,
    visibleResolvedRows,
  };
}

describe('buildColumns visual row contract', () => {
  it('returns deterministic rows with visual empty cells for non-contiguous global rows', () => {
    const voice = card('voice_a', 'instrument_voice');
    const guitar = card('guitar_a', 'instrument_guitar');
    const columns = buildColumns(
      stateWithCards(
        [voice, guitar],
        {
          voice_a: { cardId: 'voice_a', columnId: 'instrument_voice', resolvedRow: 2, visualIndex: 1, cardIndexInColumn: 1 },
          guitar_a: { cardId: 'guitar_a', columnId: 'instrument_guitar', resolvedRow: 7, visualIndex: 2, cardIndexInColumn: 1 },
        },
        [2, 7],
      ),
    );

    expect(columns[0].rows).toEqual([
      { visualIndex: 1, resolvedRow: 2, cardId: 'voice_a', card: expect.objectContaining({ id: 'voice_a' }), isVisualEmptyCell: false },
      { visualIndex: 2, resolvedRow: 7, cardId: null, card: null, isVisualEmptyCell: true },
    ]);
    expect(columns[1].rows).toEqual([
      { visualIndex: 1, resolvedRow: 2, cardId: null, card: null, isVisualEmptyCell: true },
      { visualIndex: 2, resolvedRow: 7, cardId: 'guitar_a', card: expect.objectContaining({ id: 'guitar_a' }), isVisualEmptyCell: false },
    ]);
  });

  it('does not align first cards in different columns by local index', () => {
    const voice = card('voice_first', 'instrument_voice');
    const guitar = card('guitar_first', 'instrument_guitar');
    const columns = buildColumns(
      stateWithCards(
        [voice, guitar],
        {
          voice_first: { cardId: 'voice_first', columnId: 'instrument_voice', resolvedRow: 1, visualIndex: 1, cardIndexInColumn: 1 },
          guitar_first: { cardId: 'guitar_first', columnId: 'instrument_guitar', resolvedRow: 5, visualIndex: 2, cardIndexInColumn: 1 },
        },
        [1, 5],
      ),
    );

    expect(columns[0].rows[0].cardId).toBe('voice_first');
    expect(columns[1].rows[0].cardId).toBeNull();
    expect(columns[1].rows[1].cardId).toBe('guitar_first');
  });

  it('aligns linked cards through global visualIndex when their resolvedRow matches', () => {
    const voice = card('voice_linked', 'instrument_voice');
    const guitar = card('guitar_linked', 'instrument_guitar');
    const columns = buildColumns(
      stateWithCards(
        [voice, guitar],
        {
          voice_linked: { cardId: 'voice_linked', columnId: 'instrument_voice', resolvedRow: 9, visualIndex: 2, cardIndexInColumn: 1 },
          guitar_linked: { cardId: 'guitar_linked', columnId: 'instrument_guitar', resolvedRow: 9, visualIndex: 2, cardIndexInColumn: 1 },
        },
        [4, 9],
      ),
    );

    expect(columns[0].rows[1]).toMatchObject({ visualIndex: 2, resolvedRow: 9, cardId: 'voice_linked', isVisualEmptyCell: false });
    expect(columns[1].rows[1]).toMatchObject({ visualIndex: 2, resolvedRow: 9, cardId: 'guitar_linked', isVisualEmptyCell: false });
  });
});
