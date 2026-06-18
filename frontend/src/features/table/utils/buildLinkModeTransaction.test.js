import { describe, expect, it, vi } from 'vitest';
import { buildLinkModeTransaction, hasContradictoryConflict, hasDuplicateInstrument } from './buildLinkModeTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_test` }));

describe('buildLinkModeTransaction', () => {
  it('creates links with the jam strategy and removes previous links without link_updated', () => {
    const projection = { jam: { linkReorderStrategy: 'average_position' }, links: { link_old: { linkId: 'link_old', status: 'active', targets: [{ type: 'appearance', id: 'appearance_1' }] } } };
    const transaction = buildLinkModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 3, projection, anchorCard: { type: 'appearance', id: 'appearance_1' }, selectedCards: [{ type: 'appearance', id: 'appearance_1' }, { type: 'hole', id: 'hole_1' }] });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'link_created']);
    expect(transaction.events[1].payload.reorderStrategy).toBe('average_position');
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'link_updated' }));
  });



  it('refuses to create a link between two cards in the same column', () => {
    const cards = [
      { type: 'appearance', id: 'appearance_1', instrumentId: 'instrument_guitar' },
      { type: 'appearance', id: 'appearance_2', instrumentId: 'instrument_guitar' },
    ];
    expect(hasDuplicateInstrument(cards)).toBe(true);
    expect(buildLinkModeTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 4,
      projection: { jam: { linkReorderStrategy: 'move_to_first' }, links: {} },
      anchorCard: cards[0],
      selectedCards: cards,
    })).toBeNull();
  });

  it('detects contradictory appearance and participation conflicts', () => {
    const cards = [{ type: 'appearance', id: 'appearance_1', participationId: 'participation_1' }, { type: 'appearance', id: 'appearance_2', participationId: 'participation_2' }];
    expect(hasContradictoryConflict(cards, { conflicts: { conflict_1: { status: 'active', scope: 'participation', targetIds: ['participation_1', 'participation_2'] } } })).toBe(true);
    expect(hasContradictoryConflict(cards, { conflicts: {} })).toBe(false);
  });
});
