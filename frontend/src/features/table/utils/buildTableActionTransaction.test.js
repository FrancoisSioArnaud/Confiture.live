import { describe, expect, it, vi } from 'vitest';
import { buildAddHoleTransaction, buildAddParticipantTransaction, buildRevealRoundTransaction } from './buildTableActionTransaction';

vi.mock('../../../shared/utils/createId', () => ({
  createId: vi.fn((prefix) => `${prefix}_test`),
}));

describe('buildTableActionTransaction', () => {
  it('creates a reveal-round event for one instrument column', () => {
    const transaction = buildRevealRoundTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 2, instrumentId: 'instrument_guitar', visibleRoundCount: 3 });
    expect(transaction.events).toEqual([{ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 3 } }]);
  });

  it('creates a hole event between projected cards', () => {
    const transaction = buildAddHoleTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 3,
      instrumentId: 'instrument_guitar',
      appearanceIndex: 2,
      afterCard: { type: 'appearance', id: 'appearance_1' },
      beforeCard: { type: 'hole', id: 'hole_2' },
    });
    expect(transaction.events[0]).toMatchObject({
      type: 'hole_added',
      payload: { instrumentId: 'instrument_guitar', appearanceIndex: 2, reason: 'manual', afterTarget: { type: 'appearance', id: 'appearance_1' }, beforeTarget: { type: 'hole', id: 'hole_2' } },
    });
  });

  it('creates participant and participation events for an insertion zone', () => {
    const transaction = buildAddParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 4, instrumentId: 'instrument_guitar', appearanceIndex: 1 });
    expect(transaction.events.map((event) => event.type)).toEqual(['participant_created', 'participation_added']);
    expect(transaction.events[1].payload).toMatchObject({ instrumentId: 'instrument_guitar', insertionMode: 'end_of_visible_rounds', startAppearanceIndex: 1 });
  });
});
