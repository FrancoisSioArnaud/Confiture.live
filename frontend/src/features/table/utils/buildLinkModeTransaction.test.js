import { describe, expect, it, vi } from 'vitest';
import { buildLinkModeTransaction, hasContradictoryConflict } from './buildLinkModeTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_test` }));

describe('buildLinkModeTransaction', () => {
  it('creates links with the jam strategy and removes previous links without link_updated', () => {
    const projection = { jam: { linkReorderStrategy: 'average_position' }, links: { link_old: { linkId: 'link_old', status: 'active', targets: [{ type: 'appearance', id: 'appearance_1' }] } } };
    const transaction = buildLinkModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 3, projection, anchorCard: { type: 'appearance', id: 'appearance_1' }, selectedCards: [{ type: 'appearance', id: 'appearance_1' }, { type: 'hole', id: 'hole_1' }] });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'link_created']);
    expect(transaction.events[1].payload.reorderStrategy).toBe('average_position');
    expect(transaction.events).not.toContainEqual(expect.objectContaining({ type: 'link_updated' }));
  });

  it('detects contradictory appearance and participation conflicts', () => {
    const cards = [{ type: 'appearance', id: 'appearance_1', participationId: 'participation_1' }, { type: 'appearance', id: 'appearance_2', participationId: 'participation_2' }];
    expect(hasContradictoryConflict(cards, { conflicts: { conflict_1: { status: 'active', scope: 'participation', targetIds: ['participation_1', 'participation_2'] } } })).toBe(true);
    expect(hasContradictoryConflict(cards, { conflicts: {} })).toBe(false);
  });

  it('refuses same-column links because links are inter-column only in V0', () => {
    const projection = { jam: { linkReorderStrategy: 'move_to_first' }, links: {} };
    const anchorCard = { type: 'appearance', id: 'appearance_1', instrumentId: 'instrument_vocals' };
    const selectedCards = [anchorCard, { type: 'appearance', id: 'appearance_2', instrumentId: 'instrument_vocals' }];
    const transaction = buildLinkModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 4, projection, anchorCard, selectedCards });
    expect(transaction).toBeNull();
  });


  it('can remove contradictory conflicts and create the requested manual link in one transaction', () => {
    const projection = { jam: { linkReorderStrategy: 'move_to_first' }, links: {}, conflicts: { conflict_1: { conflictId: 'conflict_1', status: 'active', scope: 'participation', targetIds: ['participation_1', 'participation_2'] } } };
    const anchorCard = { type: 'appearance', id: 'appearance_1', participationId: 'participation_1', instrumentId: 'instrument_vocals' };
    const targetCard = { type: 'appearance', id: 'appearance_2', participationId: 'participation_2', instrumentId: 'instrument_guitar' };
    const transaction = buildLinkModeTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 5, projection, anchorCard, selectedCards: [anchorCard, targetCard], conflictsToRemove: [projection.conflicts.conflict_1] });
    expect(transaction.events.map((event) => event.type)).toEqual(['conflict_removed', 'link_created']);
  });


  it('can remove an existing link when only one selected card remains in link mode', () => {
    const anchorCard = { type: 'appearance', id: 'appearance_1', instrumentId: 'instrument_vocals' };
    const projection = {
      jam: { linkReorderStrategy: 'move_to_first' },
      links: {
        link_existing: {
          linkId: 'link_existing',
          status: 'active',
          targets: [
            { type: 'appearance', id: 'appearance_1' },
            { type: 'appearance', id: 'appearance_2' },
          ],
        },
      },
    };
    const transaction = buildLinkModeTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 6,
      projection,
      anchorCard,
      selectedCards: [anchorCard],
    });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed']);
    expect(transaction.label).toBe('Retirer link');
  });


  it('can remove an existing link when every linked card is deselected but the anchor is known', () => {
    const anchorCard = { type: 'appearance', id: 'appearance_1', instrumentId: 'instrument_vocals' };
    const projection = {
      jam: { linkReorderStrategy: 'move_to_first' },
      links: {
        link_existing: {
          linkId: 'link_existing',
          status: 'active',
          targets: [
            { type: 'appearance', id: 'appearance_1' },
            { type: 'appearance', id: 'appearance_2' },
          ],
        },
      },
    };
    const transaction = buildLinkModeTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 7,
      projection,
      anchorCard,
      selectedCards: [],
    });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed']);
  });

});
