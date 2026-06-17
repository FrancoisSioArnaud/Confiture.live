import { describe, expect, it, vi } from 'vitest';
import { activeConflictsBetween, buildConflictModeTransaction } from './buildConflictModeTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_test` }));

const anchor = { type: 'appearance', id: 'appearance_a', participationId: 'participation_a', instrumentId: 'instrument_a' };
const target = { type: 'appearance', id: 'appearance_b', participationId: 'participation_b', instrumentId: 'instrument_b' };

describe('buildConflictModeTransaction', () => {
  it('creates manual appearance conflict intents without pre-resolving target movement', () => {
    const transaction = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 5, projection: { conflicts: {} }, anchorCard: anchor, targetCard: target, scope: 'appearance' });
    expect(transaction.events.map((event) => event.type)).toEqual(['conflict_created']);
    expect(transaction.events[0].payload).toMatchObject({ scope: 'appearance', reason: 'manual', targetIds: ['appearance_a', 'appearance_b'] });
  });

  it('removes existing conflicts without conflict_updated', () => {
    const projection = { conflicts: { conflict_1: { conflictId: 'conflict_1', status: 'active', scope: 'participation', targetIds: ['participation_a', 'participation_b'] } } };
    expect(activeConflictsBetween(anchor, target, projection.conflicts)).toHaveLength(1);
    const transaction = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 6, projection, anchorCard: anchor, targetCard: target, scope: 'participation' });
    expect(transaction.events).toEqual([expect.objectContaining({ type: 'conflict_removed', payload: { conflictId: 'conflict_1' } })]);
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'conflict_updated' }));
  });
});
