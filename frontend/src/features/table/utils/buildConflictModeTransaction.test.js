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
    expect(transaction.events[0].payload).not.toHaveProperty('anchorTargetId');
  });

  it('removes existing conflicts without conflict_updated', () => {
    const projection = { conflicts: { conflict_1: { conflictId: 'conflict_1', status: 'active', scope: 'participation', targetIds: ['participation_a', 'participation_b'] } } };
    expect(activeConflictsBetween(anchor, target, projection.conflicts)).toHaveLength(1);
    const transaction = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 6, projection, anchorCard: anchor, targetCard: target, scope: 'participation' });
    expect(transaction.events).toEqual([expect.objectContaining({ type: 'conflict_removed', payload: { conflictId: 'conflict_1' } })]);
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'conflict_updated' }));
  });

  it('refuses same-column conflicts because conflicts are inter-column only in V0', () => {
    const sameColumnTarget = { ...target, instrumentId: anchor.instrumentId };
    const transaction = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 7, projection: { conflicts: {} }, anchorCard: anchor, targetCard: sameColumnTarget, scope: 'appearance' });
    expect(transaction).toBeNull();
  });


  it('normalizes targetIds so conflict creation is non-oriented', () => {
    const forward = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 8, projection: { conflicts: {} }, anchorCard: anchor, targetCard: target, scope: 'appearance' });
    const reverse = buildConflictModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 9, projection: { conflicts: {} }, anchorCard: target, targetCard: anchor, scope: 'appearance' });
    expect(forward.events[0].payload.targetIds).toEqual(reverse.events[0].payload.targetIds);
    expect(forward.events[0].payload).not.toHaveProperty('anchorTargetId');
    expect(reverse.events[0].payload).not.toHaveProperty('anchorTargetId');
  });

});
