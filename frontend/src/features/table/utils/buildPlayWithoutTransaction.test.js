import { describe, expect, it, vi } from 'vitest';
import { buildPlayWithoutTransaction } from './buildPlayWithoutTransaction';

vi.mock('../../../shared/utils/createId', () => {
  let counter = 0;
  return { createId: (prefix) => `${prefix}_test_${counter += 1}` };
});

describe('buildPlayWithoutTransaction', () => {
  it('models play without as hole_added plus link_created only', () => {
    const projection = { jam: { linkReorderStrategy: 'move_to_last' }, columns: [{ instrument: { instrumentId: 'instrument_drums' }, cards: [] }] };
    const transaction = buildPlayWithoutTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 8, projection, sourceCard: { type: 'appearance', id: 'appearance_guitar_1', appearanceIndex: 2 }, instrumentIds: ['instrument_drums'] });
    expect(transaction.events.map((event) => event.type)).toEqual(['hole_added', 'link_created']);
    expect(transaction.events[0].payload.reason).toBe('play_without');
    expect(transaction.events[1].payload.reorderStrategy).toBe('move_to_last');
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'play_without_created' }));
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'play_without_removed' }));
  });
});
