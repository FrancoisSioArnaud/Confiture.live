import { describe, expect, it, vi } from 'vitest';
import { buildRevealRoundTransaction, buildTogglePlateauPlayedTransaction } from './buildTableActionTransaction';

vi.mock('../../../shared/utils/createId', () => ({
  createId: vi.fn((prefix) => `${prefix}_test`),
}));

describe('buildTableActionTransaction', () => {
  it('creates a reveal-round event for one instrument column', () => {
    const transaction = buildRevealRoundTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 2, instrumentId: 'instrument_guitar', visibleRoundCount: 3 });
    expect(transaction.events).toEqual([expect.objectContaining({ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 3 } })]);
  });


  it('adds played holes for empty instrument slots before marking a plateau played', () => {
    const projection = {
      columns: [
        {
          instrument: { instrumentId: 'instrument_vocals', label: 'Chant' },
          cards: [{ id: 'appearance_a', type: 'appearance', instrumentId: 'instrument_vocals', appearanceIndex: 1 }],
        },
        {
          instrument: { instrumentId: 'instrument_guitar', label: 'Guitare' },
          cards: [],
        },
      ],
    };
    const transaction = buildTogglePlateauPlayedTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 3,
      plateauIndex: 0,
      targets: [{ type: 'appearance', id: 'appearance_a' }],
      played: false,
      projection,
    });

    expect(transaction.events.map((event) => event.type)).toEqual(['hole_added', 'plateau_played']);
    expect(transaction.events[0].payload).toMatchObject({
      holeId: 'hole_test',
      instrumentId: 'instrument_guitar',
      reason: 'played_empty_slot',
    });
    expect(transaction.events[1].payload.targets).toEqual([
      { type: 'appearance', id: 'appearance_a' },
      { type: 'hole', id: 'hole_test' },
    ]);
  });

});
