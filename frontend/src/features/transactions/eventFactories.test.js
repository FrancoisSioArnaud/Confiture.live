import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, FORBIDDEN_EVENT_TYPES, assertAllowedEventType } from '../../shared/constants/eventTypes';
import { createTransaction } from './createTransaction';
import {
  appearanceSkipped,
  holeAdded,
  jamCreated,
  linkCreated,
  participantCreated,
  participationAdded,
  transactionRedone,
  transactionReverted,
} from './eventFactories';

describe('event factories', () => {
  it('defines the complete V0 event type allowlist and excludes forbidden event types', () => {
    expect(Object.values(EVENT_TYPES)).toEqual([
      'jam_created',
      'jam_updated',
      'instrument_added',
      'instrument_updated',
      'instruments_reordered',
      'instrument_visibility_changed',
      'jam_link_reorder_strategy_changed',
      'participant_created',
      'participant_updated',
      'participant_removed',
      'participant_marked_left',
      'participation_added',
      'participation_removed',
      'appearance_materialized',
      'appearance_moved_between',
      'appearance_removed',
      'appearance_locked',
      'appearance_unlocked',
      'appearance_skipped',
      'hole_added',
      'hole_removed',
      'hole_moved_between',
      'hole_locked',
      'hole_unlocked',
      'link_created',
      'link_removed',
      'conflict_created',
      'conflict_removed',
      'instrument_round_visibility_changed',
      'plateau_played',
      'plateau_unplayed',
      'transaction_reverted',
      'transaction_redone',
    ]);
    FORBIDDEN_EVENT_TYPES.forEach((type) => expect(() => assertAllowedEventType(type)).toThrow());
  });

  it('creates a deterministic transaction envelope around factory events', () => {
    const tx = createTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 7,
      transactionId: 'transaction_1',
      createdAt: '2026-06-14T19:00:00.000Z',
      label: 'Ajouter Nicolas',
      events: [
        participantCreated({ participantId: 'participant_nicolas', name: 'Nicolas' }),
        participationAdded({
          participationId: 'participation_nicolas_guitar',
          participantId: 'participant_nicolas',
          instrumentId: 'instrument_guitar',
          customInstrumentLabel: null,
          insertionMode: 'end_of_visible_rounds',
          startAppearanceIndex: 1,
          afterTarget: null,
          beforeTarget: null,
          baseOrderKey: 'order_a',
        }),
      ],
    });

    expect(tx.transactionId).toBe('transaction_1');
    expect(tx.schemaVersion).toBe(1);
    expect(tx.events).toHaveLength(2);
    expect(tx.events[0]).toMatchObject({
      transactionId: 'transaction_1',
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 7,
      eventIndexInTransaction: 0,
      serverSequenceNumber: null,
      schemaVersion: 1,
    });
  });

  it('creates jam/link/play-without/skip/undo payloads aligned with the specs', () => {
    expect(jamCreated({ jamId: 'jam_1', name: 'Jam du mercredi', indicativeDate: '2026-06-17', linkReorderStrategy: 'move_to_first' })).toEqual({
      type: EVENT_TYPES.JAM_CREATED,
      payload: { jamId: 'jam_1', name: 'Jam du mercredi', indicativeDate: '2026-06-17', linkReorderStrategy: 'move_to_first' },
    });
    expect(jamCreated({ jamId: 'jam_1', name: 'Jam sans date', indicativeDate: null, linkReorderStrategy: 'move_to_first' }).payload.indicativeDate).toBeNull();

    expect(holeAdded({
      holeId: 'hole_drums_1',
      instrumentId: 'instrument_drums',
      appearanceIndex: 1,
      reason: 'play_without',
      afterTarget: { type: 'appearance', id: 'appearance_guitar_1' },
      beforeTarget: null,
      positionKey: 'pos_1',
    }).payload.reason).toBe('play_without');

    expect(linkCreated({
      linkId: 'link_1',
      targets: [{ type: 'appearance', id: 'appearance_guitar_1' }, { type: 'hole', id: 'hole_drums_1' }],
      anchorTarget: { type: 'appearance', id: 'appearance_guitar_1' },
      reorderStrategy: 'move_to_first',
    }).payload.targets).toHaveLength(2);

    expect(appearanceSkipped({
      appearanceId: 'appearance_guitar_1',
      instrumentId: 'instrument_guitar',
      originalPlateauIndex: 3,
      replacement: { mode: 'hole', holeId: 'hole_drums_1' },
      createdHoleId: 'hole_drums_1',
      removedLinkIds: ['link_1'],
      confirmedDelink: true,
    }).payload.replacement.mode).toBe('hole');

    expect(transactionReverted({ targetTransactionId: 'transaction_1', targetClientSequenceNumber: 6, reason: 'organizer_undo' }).type).toBe(EVENT_TYPES.TRANSACTION_REVERTED);
    expect(transactionRedone({ targetTransactionId: 'transaction_1', targetClientSequenceNumber: 6, reason: 'organizer_redo' }).type).toBe(EVENT_TYPES.TRANSACTION_REDONE);
  });

  it('rejects malformed critical payloads and forbidden events', () => {
    expect(() => participationAdded({
      participationId: 'participation_bad',
      participantId: 'participant_1',
      instrumentId: 'instrument_guitar',
      customInstrumentLabel: null,
      insertionMode: 'between_targets',
      startAppearanceIndex: 1,
      afterTarget: null,
      beforeTarget: null,
      baseOrderKey: 'order_a',
    })).toThrow();

    expect(() => createTransaction({
      jamId: 'jam_1',
      clientId: 'client_1',
      clientSequenceNumber: 1,
      events: [{ type: 'play_without_created', payload: {} }],
    })).toThrow();
  });
});
