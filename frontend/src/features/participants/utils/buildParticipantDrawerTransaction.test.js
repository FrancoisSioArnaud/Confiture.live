import { describe, expect, it, vi } from 'vitest';
import { buildCreateParticipantTransaction, buildEditParticipantTransaction, validateParticipantDraft } from './buildParticipantDrawerTransaction';

vi.mock('../../../shared/utils/createId', () => {
  let counter = 0;
  return { createId: vi.fn((prefix) => `${prefix}_test_${counter += 1}`) };
});

const instruments = [
  { instrumentId: 'instrument_vocals', label: 'Chant', orderKey: 'a', visible: true },
  { instrumentId: 'instrument_guitar', label: 'Guitare', orderKey: 'b', visible: true },
];

const emptyProjection = { jam: { jamId: 'jam_1' }, participants: {}, participations: {}, appearances: {}, links: {}, instruments: Object.fromEntries(instruments.map((instrument) => [instrument.instrumentId, instrument])) };

describe('buildParticipantDrawerTransaction', () => {
  it('rejects exact duplicate participant names', () => {
    const projection = { ...emptyProjection, participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } } };
    const result = validateParticipantDraft({ draft: { name: ' Nico ', selectedInstrumentIds: ['instrument_vocals'], customInstrumentLabels: {} }, projection, instruments });
    expect(result).toMatchObject({ ok: false, error: 'Un musicien porte déjà ce nom dans cette jam.' });
  });

  it('creates participant, participations and automatic instrument constraints', () => {
    const result = buildCreateParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 2, projection: emptyProjection, instruments, draft: { name: 'Nico', selectedInstrumentIds: ['instrument_vocals', 'instrument_guitar'], customInstrumentLabels: {} } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_created', 'participation_added', 'participation_added', 'conflict_created']);
    expect(result.transaction.events.at(-1).payload.reason).toBe('instrument_constraint');
  });

  it('edits name, adds an instrument and removes an instrument via events', () => {
    const projection = {
      ...emptyProjection,
      participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } },
      participations: { participation_vocals: { participationId: 'participation_vocals', participantId: 'participant_1', instrumentId: 'instrument_vocals', status: 'active' } },
    };
    const result = buildEditParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 3, projection, participantId: 'participant_1', instruments, confirmedRemovedParticipationIds: ['participation_vocals'], draft: { name: 'Nicolas', selectedInstrumentIds: ['instrument_guitar'], customInstrumentLabels: {} } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_updated', 'participation_added', 'participation_removed']);
  });
});
