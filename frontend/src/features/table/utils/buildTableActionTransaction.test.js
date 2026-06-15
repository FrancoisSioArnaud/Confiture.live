import { describe, expect, it, vi } from 'vitest';
import { buildAddHoleTransaction, buildRevealRoundTransaction } from './buildTableActionTransaction';

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
});
