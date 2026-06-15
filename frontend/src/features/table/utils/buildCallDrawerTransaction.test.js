import { describe, expect, it, vi } from 'vitest';
import { buildSkipWithReplacementTransaction, buildSkipWithoutMusicianTransaction, replacementCandidatesForCallDrawer } from './buildCallDrawerTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_fixed` }));

const source = { id: 'appearance_source', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_a', appearanceIndex: 1, played: false, locked: false };
const replacement = { id: 'appearance_replacement', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_b', appearanceIndex: 2, played: false, locked: false };
const projection = {
  jam: { linkReorderStrategy: 'move_to_first' },
  participants: {
    participant_a: { status: 'active', name: 'A' },
    participant_b: { status: 'active', name: 'B' },
  },
  links: {
    link_source: { linkId: 'link_source', status: 'active', targets: [{ type: 'appearance', id: source.id }, { type: 'appearance', id: 'other' }] },
  },
  columns: [{ instrument: { instrumentId: 'instrument_drums', label: 'Batterie' }, cards: [source, replacement] }],
};

describe('buildCallDrawerTransaction', () => {
  it('proposes future unlocked replacement candidates in the same column', () => {
    expect(replacementCandidatesForCallDrawer({ projection, sourceCard: source, plateauIndex: 0 })).toEqual([replacement]);
  });

  it('skips the missing appearance and moves a replacement into its slot', () => {
    const transaction = buildSkipWithReplacementTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 1, projection, sourceCard: source, replacementCard: replacement, plateauIndex: 0, confirmedDelink: true });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'appearance_moved_between', 'appearance_skipped', 'appearance_moved_between']);
    expect(transaction.events[2].payload.replacement).toEqual({ mode: 'appearance', appearanceId: replacement.id });
    expect(transaction.events[2].payload.removedLinkIds).toEqual(['link_source']);
  });

  it('models faire sans musicien as hole_added plus appearance_skipped', () => {
    const transaction = buildSkipWithoutMusicianTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 1, projection, sourceCard: source, plateauIndex: 0, confirmedDelink: true });
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'hole_added', 'appearance_skipped', 'appearance_moved_between']);
    expect(transaction.events[1].payload.reason).toBe('call_drawer_without_musician');
    expect(transaction.events[2].payload.replacement).toEqual({ mode: 'hole', holeId: 'hole_fixed' });
  });
});
