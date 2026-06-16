import { describe, expect, it, vi } from 'vitest';
import { buildSkipWithReplacementTransaction, buildSkipWithoutMusicianTransaction, replacementCandidatePresentation, replacementCandidatesForCallDrawer } from './buildCallDrawerTransaction';

vi.mock('../../../shared/utils/createId', () => ({ createId: (prefix) => `${prefix}_fixed` }));

const source = { id: 'appearance_source', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_a', participationId: 'participation_source', appearanceIndex: 1, played: false, locked: false };
const replacement = { id: 'appearance_replacement', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_b', participationId: 'participation_replacement', appearanceIndex: 2, played: false, locked: false };
const alreadyPlayedReplacement = { id: 'appearance_already_played_replacement', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_c', participationId: 'participation_already_played_replacement', appearanceIndex: 2, played: false, locked: false };
const projection = {
  jam: { linkReorderStrategy: 'move_to_first' },
  instruments: {
    instrument_drums: { instrumentId: 'instrument_drums', label: 'Batterie' },
  },
  participants: {
    participant_a: { status: 'active', name: 'A' },
    participant_b: { status: 'active', name: 'B' },
    participant_c: { status: 'active', name: 'C' },
  },
  appearances: {
    appearance_source: source,
    appearance_replacement: replacement,
    appearance_already_played_replacement: alreadyPlayedReplacement,
    appearance_participant_c_played: { id: 'appearance_participant_c_played', type: 'appearance', instrumentId: 'instrument_drums', participantId: 'participant_c', participationId: 'participation_already_played', appearanceIndex: 1, played: true, locked: false },
  },
  links: {
    link_source: { linkId: 'link_source', status: 'active', targets: [{ type: 'appearance', id: source.id }, { type: 'appearance', id: 'other' }] },
    link_replacement: { linkId: 'link_replacement', status: 'active', targets: [{ type: 'appearance', id: replacement.id }, { type: 'appearance', id: 'linked_other' }] },
  },
  conflicts: {},
  columns: [{ instrument: { instrumentId: 'instrument_drums', label: 'Batterie' }, cards: [source, replacement] }],
};

describe('buildCallDrawerTransaction', () => {
  it('proposes future unlocked replacement candidates in the same column', () => {
    expect(replacementCandidatesForCallDrawer({ projection, sourceCard: source, plateauIndex: 0 })).toEqual([replacement]);
  });

  it('prioritizes candidates whose participant has not already played', () => {
    const rankedProjection = {
      ...projection,
      columns: [{ instrument: { instrumentId: 'instrument_drums', label: 'Batterie' }, cards: [source, alreadyPlayedReplacement, replacement] }],
    };

    expect(replacementCandidatesForCallDrawer({ projection: rankedProjection, sourceCard: source, plateauIndex: 0 })).toEqual([replacement, alreadyPlayedReplacement]);
  });

  it('exposes presentation metadata for replacement options', () => {
    expect(replacementCandidatePresentation({ projection, candidate: replacement, sourceCard: source })).toEqual({
      linked: true,
      instrumentLabel: 'Batterie',
      alreadyPlayed: false,
      willMove: true,
      roundLabel: 'round 2',
    });
  });

  it('excludes replacement candidates that conflict with another card on the called plateau', () => {
    const otherPlateauCard = { id: 'appearance_guitar', type: 'appearance', instrumentId: 'instrument_guitar', participantId: 'participant_c', participationId: 'participation_guitar', appearanceIndex: 1, played: false, locked: false };
    const conflictedProjection = {
      ...projection,
      conflicts: { conflict_1: { conflictId: 'conflict_1', status: 'active', scope: 'participation', targetIds: ['participation_replacement', 'participation_guitar'] } },
      columns: [
        projection.columns[0],
        { instrument: { instrumentId: 'instrument_guitar', label: 'Guitare' }, cards: [otherPlateauCard] },
      ],
    };

    expect(replacementCandidatesForCallDrawer({ projection: conflictedProjection, sourceCard: source, plateauIndex: 0 })).toEqual([]);
  });

  it('skips the missing appearance and moves a replacement into its slot', () => {
    const transaction = buildSkipWithReplacementTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 1, projection, sourceCard: source, replacementCard: replacement, plateauIndex: 0, confirmedDelink: true });
    expect(transaction.label).toBe('Remplacer musicien introuvable');
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'link_removed', 'appearance_moved_between', 'appearance_skipped', 'appearance_moved_between']);
    expect(transaction.events[3].payload.replacement).toEqual({ mode: 'appearance', appearanceId: replacement.id });
    expect(transaction.events[3].payload.removedLinkIds).toEqual(['link_source', 'link_replacement']);
  });

  it('models Plateau sans instrument as hole_added plus appearance_skipped', () => {
    const transaction = buildSkipWithoutMusicianTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 1, projection, sourceCard: source, plateauIndex: 0, confirmedDelink: true, instrumentLabel: 'Batterie' });
    expect(transaction.label).toBe('Plateau sans Batterie');
    expect(transaction.events.map((event) => event.type)).toEqual(['link_removed', 'hole_added', 'appearance_skipped', 'appearance_moved_between']);
    expect(transaction.events[1].payload.reason).toBe('call_drawer_without_musician');
    expect(transaction.events[2].payload.replacement).toEqual({ mode: 'hole', holeId: 'hole_fixed' });
    expect(transaction.events[3].payload.afterTarget).toEqual({ type: 'hole', id: 'hole_fixed' });
    expect(transaction.events[3].payload.afterTarget).not.toEqual({ type: 'appearance', id: source.id });
  });
});
