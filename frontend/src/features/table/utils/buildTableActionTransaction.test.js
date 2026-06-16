import { describe, expect, it, vi } from 'vitest';
import { buildRevealRoundTransaction } from './buildTableActionTransaction';

vi.mock('../../../shared/utils/createId', () => ({
  createId: vi.fn((prefix) => `${prefix}_test`),
}));

describe('buildTableActionTransaction', () => {
  it('creates a reveal-round event for one instrument column', () => {
    const transaction = buildRevealRoundTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 2, instrumentId: 'instrument_guitar', visibleRoundCount: 3 });
    expect(transaction.events).toEqual([expect.objectContaining({ type: 'instrument_round_visibility_changed', payload: { instrumentId: 'instrument_guitar', visibleRoundCount: 3 } })]);
  });

});
