import { describe, expect, it } from 'vitest';
import { canDragCard, cardConflicts, cardLinks } from './cardState';

describe('cardState', () => {
  it('allows dragging a card that has an active conflict so the resolver can reorganize after the move', () => {
    expect(canDragCard({ id: 'appearance_a', type: 'appearance', played: false, locked: false })).toBe(true);
  });

  it('only blocks drag for played or locked cards', () => {
    expect(canDragCard({ id: 'appearance_played', played: true, locked: false })).toBe(false);
    expect(canDragCard({ id: 'appearance_locked', played: false, locked: true })).toBe(false);
  });

  it('does not expose suppressed links and conflicts as active card state', () => {
    const card = { id: 'appearance_a', type: 'appearance' };
    const links = {
      active: { linkId: 'link_active', status: 'active', targets: [{ type: 'appearance', id: 'appearance_a' }] },
      suppressed: { linkId: 'link_suppressed', status: 'active', suppressedBySameColumn: true, targets: [{ type: 'appearance', id: 'appearance_a' }] },
    };
    const conflicts = {
      active: { conflictId: 'conflict_active', status: 'active', targetIds: ['appearance_a', 'appearance_b'] },
      suppressed: { conflictId: 'conflict_suppressed', status: 'active', suppressedBySameColumn: true, targetIds: ['appearance_a', 'appearance_c'] },
    };

    expect(cardLinks(card, links).map((link) => link.linkId)).toEqual(['link_active']);
    expect(cardConflicts(card, conflicts).map((conflict) => conflict.conflictId)).toEqual(['conflict_active']);
  });
});
