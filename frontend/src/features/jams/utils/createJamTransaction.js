import { createTransaction } from '../../transactions/createTransaction';
import { instrumentAdded, jamCreated } from '../../transactions/eventFactories';
import { createId } from '../../../shared/utils/createId';
import { DEFAULT_INSTRUMENTS } from './defaultInstruments';

export function buildCreateJamTransaction({ name, indicativeDate = null, clientId, selectedInstrumentIds, customInstruments = [], orderedInstruments = null }) {
  const jamId = createId('jam');
  const selected = new Set(selectedInstrumentIds);
  const instruments = orderedInstruments ?? [
    ...DEFAULT_INSTRUMENTS,
    ...customInstruments.map((label) => ({ instrumentId: createId('instrument'), label, isDefault: false })),
  ];
  const instrumentEvents = instruments.filter((instrument) => selected.has(instrument.instrumentId) || (orderedInstruments == null && instrument.isDefault === false)).map((instrument, index) => instrumentAdded({
    instrumentId: instrument.instrumentId,
    label: instrument.label,
    orderKey: `order_${index}`,
    visible: true,
    isDefault: instrument.isDefault ?? DEFAULT_INSTRUMENTS.some((defaultInstrument) => defaultInstrument.instrumentId === instrument.instrumentId),
  }));

  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber: 1,
    label: `Créer ${name}`,
    events: [jamCreated({ jamId, name, indicativeDate, linkReorderStrategy: 'move_to_first' }), ...instrumentEvents],
  });
}
