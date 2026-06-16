import { describe, expect, it } from 'vitest';
import { buildMoveCardTransaction, buildRemoveCardTransaction, buildToggleLockTransaction } from './buildCardActionTransaction';

describe('buildCardActionTransaction', () => {
  const base = { jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 7 };

  it('creates lock and unlock events for appearances and holes', () => {
    expect(buildToggleLockTransaction({ ...base, card: { type: 'appearance', id: 'appearance_1', locked: false } }).events[0]).toEqual({ type: 'appearance_locked', payload: { appearanceId: 'appearance_1' } });
    expect(buildToggleLockTransaction({ ...base, card: { type: 'hole', id: 'hole_1', locked: true } }).events[0]).toEqual({ type: 'hole_unlocked', payload: { holeId: 'hole_1' } });
  });

  it('creates removal events with explicit link confirmation flags', () => {
    expect(buildRemoveCardTransaction({ ...base, card: { type: 'appearance', id: 'appearance_1' }, linked: true }).events[0]).toEqual({ type: 'appearance_removed', payload: { appearanceId: 'appearance_1', confirmedDespiteLink: true } });
    expect(buildRemoveCardTransaction({ ...base, card: { type: 'hole', id: 'hole_1' }, linked: false }).events[0]).toEqual({ type: 'hole_removed', payload: { holeId: 'hole_1', confirmedDespiteLink: false } });
  });



  it('refuses remove and move transactions for locked or played cards', () => {
    expect(buildRemoveCardTransaction({ ...base, card: { type: 'appearance', id: 'appearance_locked', locked: true }, linked: false })).toBeNull();
    expect(buildRemoveCardTransaction({ ...base, card: { type: 'hole', id: 'hole_played', played: true }, linked: false })).toBeNull();
    expect(buildMoveCardTransaction({ ...base, card: { type: 'appearance', id: 'appearance_played', played: true }, instrumentId: 'instrument_guitar' })).toBeNull();
    expect(buildMoveCardTransaction({ ...base, card: { type: 'hole', id: 'hole_locked', locked: true }, instrumentId: 'instrument_guitar' })).toBeNull();
  });

  it('creates vertical move events for the moved target only', () => {
    const transaction = buildMoveCardTransaction({
      ...base,
      card: { type: 'appearance', id: 'appearance_1' },
      instrumentId: 'instrument_guitar',
      afterCard: { type: 'hole', id: 'hole_1' },
      beforeCard: { type: 'appearance', id: 'appearance_2' },
      movedLinkedGroup: true,
    });
    expect(transaction.events[0]).toEqual({
      type: 'appearance_moved_between',
      payload: {
        appearanceId: 'appearance_1',
        instrumentId: 'instrument_guitar',
        afterTarget: { type: 'hole', id: 'hole_1' },
        beforeTarget: { type: 'appearance', id: 'appearance_2' },
        movedLinkedGroup: true,
      },
    });
  });
});
