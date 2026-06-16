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

const emptyProjection = { jam: { jamId: 'jam_1', linkReorderStrategy: 'move_to_last' }, participants: {}, participations: {}, appearances: {}, links: {}, conflicts: {}, instruments: Object.fromEntries(instruments.map((instrument) => [instrument.instrumentId, instrument])) };

describe('buildParticipantDrawerTransaction', () => {
  it('rejects exact duplicate participant names', () => {
    const projection = { ...emptyProjection, participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } } };
    const result = validateParticipantDraft({ draft: { name: ' Nico ', selectedInstrumentIds: ['instrument_vocals'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} }, projection, instruments });
    expect(result).toMatchObject({ ok: false, error: 'Un musicien porte déjà ce nom dans cette jam.' });
  });

  it('rejects drafts without an instrument', () => {
    const result = validateParticipantDraft({ draft: { name: 'Nico', selectedInstrumentIds: [], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} }, projection: emptyProjection, instruments });
    expect(result).toMatchObject({ ok: false, error: 'Au moins un instrument doit être sélectionné.' });
  });

  it('creates participant, participations and automatic instrument constraints', () => {
    const result = buildCreateParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 2, projection: emptyProjection, instruments, draft: { name: 'Nico', selectedInstrumentIds: ['instrument_vocals', 'instrument_guitar'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_created', 'participation_added', 'participation_added', 'conflict_created']);
    expect(result.transaction.events.at(-1).payload.reason).toBe('instrument_constraint');
  });

  it('stores customInstrumentLabel for selected Autre instrument', () => {
    const otherInstruments = [...instruments, { instrumentId: 'instrument_other', label: 'Autre', orderKey: 'c', visible: true }];
    const result = buildCreateParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 4, projection: emptyProjection, instruments: otherInstruments, draft: { name: 'Nico', selectedInstrumentIds: ['instrument_other'], initialLinkedInstrumentPairs: [], customInstrumentLabels: { instrument_other: 'Mandoline' } } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.find((event) => event.type === 'participation_added').payload.customInstrumentLabel).toBe('Mandoline');
  });

  it('creates materialized appearances and a link for checked initial pairs', () => {
    const result = buildCreateParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 5, projection: emptyProjection, instruments, draft: { name: 'Nico', selectedInstrumentIds: ['instrument_vocals', 'instrument_guitar'], initialLinkedInstrumentPairs: ['instrument_guitar__instrument_vocals'], customInstrumentLabels: {} } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_created', 'participation_added', 'participation_added', 'appearance_materialized', 'appearance_materialized', 'link_created']);
    const link = result.transaction.events.find((event) => event.type === 'link_created');
    expect(link.payload.targets).toHaveLength(2);
    expect(result.transaction.events.some((event) => event.type === 'conflict_created')).toBe(false);
  });



  it('does not remove participations on hidden instruments from the standard drawer', () => {
    const projection = {
      ...emptyProjection,
      participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } },
      participations: {
        participation_vocals: { participationId: 'participation_vocals', participantId: 'participant_1', instrumentId: 'instrument_vocals', status: 'active', startAppearanceIndex: 1, baseOrderKey: 'position_vocals' },
        participation_hidden: { participationId: 'participation_hidden', participantId: 'participant_1', instrumentId: 'instrument_hidden', status: 'active', startAppearanceIndex: 1, baseOrderKey: 'position_hidden' },
      },
      instruments: { ...emptyProjection.instruments, instrument_hidden: { instrumentId: 'instrument_hidden', label: 'Sax', orderKey: 'c', visible: false } },
    };

    const result = buildEditParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 6, projection, participantId: 'participant_1', instruments, draft: { name: 'Nicolas', selectedInstrumentIds: ['instrument_vocals'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} } });

    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_updated']);
    expect(result.transaction.events.some((event) => event.payload.participationId === 'participation_hidden')).toBe(false);
  });

  it('refuses to add an instrument to a participant marked left', () => {
    const projection = {
      ...emptyProjection,
      participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'left' } },
      participations: { participation_vocals: { participationId: 'participation_vocals', participantId: 'participant_1', instrumentId: 'instrument_vocals', status: 'active', startAppearanceIndex: 1, baseOrderKey: 'position_vocals' } },
    };

    const result = buildEditParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 7, projection, participantId: 'participant_1', instruments, draft: { name: 'Nico', selectedInstrumentIds: ['instrument_vocals', 'instrument_guitar'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} } });

    expect(result).toMatchObject({ ok: false, error: 'Impossible d’ajouter un instrument à un musicien marqué parti.' });
  });

  it('edits name, adds an instrument and removes an instrument via events', () => {
    const projection = {
      ...emptyProjection,
      participants: { participant_1: { participantId: 'participant_1', name: 'Nico', status: 'active' } },
      participations: { participation_vocals: { participationId: 'participation_vocals', participantId: 'participant_1', instrumentId: 'instrument_vocals', status: 'active', startAppearanceIndex: 1, baseOrderKey: 'position_vocals' } },
    };
    const result = buildEditParticipantTransaction({ jamId: 'jam_1', clientId: 'client_1', clientSequenceNumber: 3, projection, participantId: 'participant_1', instruments, confirmedRemovedParticipationIds: ['participation_vocals'], draft: { name: 'Nicolas', selectedInstrumentIds: ['instrument_guitar'], initialLinkedInstrumentPairs: [], customInstrumentLabels: {} } });
    expect(result.ok).toBe(true);
    expect(result.transaction.events.map((event) => event.type)).toEqual(['participant_updated', 'participation_added', 'participation_removed']);
  });
});
