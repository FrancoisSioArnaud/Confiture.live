import { describe, expect, it, vi } from 'vitest';
import { buildJamConfigTransaction } from './buildJamConfigTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_test` }));

describe('buildJamConfigTransaction', () => {
  const currentJam = { jamId: 'jam_1', name: 'Jam A', indicativeDate: '2026-01-15', linkReorderStrategy: 'move_to_first' };
  const currentInstruments = [
    { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: true },
    { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'b', visible: true },
  ];

  it('creates config events without destructive instrument deletion', () => {
    const transaction = buildJamConfigTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 4,
      currentJam,
      currentInstruments,
      draft: {
        name: 'Jam B',
        indicativeDate: '2026-01-16',
        linkReorderStrategy: 'average_position',
        instruments: [
          { instrumentId: 'instrument_guitar', label: 'Guitare lead', orderKey: 'b', visible: true },
          { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: false, confirmedDespiteActiveLinks: true },
          { instrumentId: 'instrument_sax', label: 'Saxophone', orderKey: 'c', visible: true },
        ],
      },
    });

    expect(transaction.events.map((event) => event.type)).toEqual([
      'jam_updated',
      'jam_link_reorder_strategy_changed',
      'instrument_updated',
      'instrument_visibility_changed',
      'instrument_added',
      'instruments_reordered',
    ]);
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'instrument_removed' }));
  });
});
