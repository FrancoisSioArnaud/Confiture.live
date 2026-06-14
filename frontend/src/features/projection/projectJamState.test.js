import { describe, expect, it } from 'vitest';
import { projectJamState } from './projectJamState.js';

const event = (type, payload, n, transactionId = `tx_${n}`) => ({ eventId: `event_${n}`, transactionId, type, payload, serverSequenceNumber: n });

describe('projectJamState', () => {
  it('projects a jam, instruments, participants and calculated first appearances deterministically', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam', indicativeDate: '2026-06-17' }, 1),
      event('instrument_added', { instrumentId: 'guitar', name: 'Guitare', order: 0 }, 2),
      event('participant_created', { participantId: 'lea', name: 'Léa' }, 3),
      event('participation_added', { participationId: 'lea_guitar', participantId: 'lea', instrumentId: 'guitar', baseOrderKey: 'a' }, 4),
    ] });
    expect(state.jam.name).toBe('Jam');
    expect(state.columns.guitar).toHaveLength(1);
    expect(state.columns.guitar[0]).toMatchObject({ type: 'appearance', participantId: 'lea', appearanceIndex: 1 });
  });

  it('materializes holes and links without creating participant state', () => {
    const state = projectJamState({ events: [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1),
      event('instrument_added', { instrumentId: 'drums', name: 'Batterie' }, 2),
      event('hole_added', { holeId: 'hole_1', instrumentId: 'drums', appearanceIndex: 1, orderKey: 'b' }, 3),
      event('link_created', { linkId: 'link_1', targets: [{ targetType: 'hole', targetId: 'hole_1' }] }, 4),
    ] });
    expect(state.columns.drums[0]).toMatchObject({ type: 'hole', holeId: 'hole_1' });
    expect(state.links.link_1.removed).toBe(false);
  });

  it('supports linear undo by ignoring events from reverted transactions', () => {
    const events = [
      event('jam_created', { jamId: 'jam_1', name: 'Jam' }, 1, 'tx_1'),
      event('instrument_added', { instrumentId: 'bass', name: 'Basse' }, 2, 'tx_2'),
      event('transaction_reverted', { transactionId: 'tx_2' }, 3, 'tx_3'),
    ];
    const state = projectJamState({ events });
    expect(state.instruments.bass).toBeUndefined();
    expect(state.revertedTransactionIds).toContain('tx_2');
  });
});
