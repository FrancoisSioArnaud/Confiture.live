import { createTransaction } from '../../transactions/createTransaction';
import { instrumentAdded, jamCreated } from '../../transactions/eventFactories';
import { createId } from '../../../shared/utils/createId';
import { DEFAULT_INSTRUMENTS } from './defaultInstruments';

export function buildCreateJamTransaction({ name, indicativeDate, clientId, selectedInstrumentIds, customInstruments = [] }) {
  const jamId = createId('jam');
  const selected = new Set(selectedInstrumentIds);
  const defaultEvents = DEFAULT_INSTRUMENTS.filter((instrument) => selected.has(instrument.instrumentId)).map((instrument, index) => instrumentAdded({
    instrumentId: instrument.instrumentId,
    label: instrument.label,
    orderKey: `order_${index}`,
    visible: true,
    isDefault: true,
  }));
  const customEvents = customInstruments.map((label, index) => instrumentAdded({
    instrumentId: createId('instrument'),
    label,
    orderKey: `custom_${index}`,
    visible: true,
    isDefault: false,
  }));

  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber: 1,
    label: `Créer ${name}`,
    events: [jamCreated({ jamId, name, indicativeDate, linkReorderStrategy: 'move_to_first' }), ...defaultEvents, ...customEvents],
  });
}
