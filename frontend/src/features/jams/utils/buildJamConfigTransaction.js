import { createTransaction } from '../../transactions/createTransaction';
import {
  instrumentAdded,
  instrumentUpdated,
  instrumentVisibilityChanged,
  instrumentsReordered,
  jamLinkReorderStrategyChanged,
  jamUpdated,
} from '../../transactions/eventFactories';
import { createId } from '../../../shared/utils/createId';

export function buildJamConfigTransaction({ jamId, clientId, clientSequenceNumber, currentJam, currentInstruments, draft }) {
  const events = [];
  if (draft.name !== currentJam?.name || draft.indicativeDate !== currentJam?.indicativeDate) {
    events.push(jamUpdated({ name: draft.name, indicativeDate: draft.indicativeDate }));
  }
  if (draft.linkReorderStrategy !== currentJam?.linkReorderStrategy) {
    events.push(jamLinkReorderStrategyChanged({ previousStrategy: currentJam?.linkReorderStrategy ?? 'move_to_first', nextStrategy: draft.linkReorderStrategy }));
  }

  draft.instruments.forEach((instrument) => {
    const existing = currentInstruments.find((candidate) => candidate.instrumentId === instrument.instrumentId);
    if (!existing) {
      events.push(instrumentAdded({ instrumentId: instrument.instrumentId, label: instrument.label, orderKey: instrument.orderKey, visible: instrument.visible, isDefault: false }));
    } else if (existing.label !== instrument.label) {
      events.push(instrumentUpdated({ instrumentId: instrument.instrumentId, label: instrument.label }));
    }
    if (existing && existing.visible !== instrument.visible) {
      events.push(instrumentVisibilityChanged({ instrumentId: instrument.instrumentId, visible: instrument.visible, confirmedDespiteActiveLinks: instrument.confirmedDespiteActiveLinks ?? false }));
    }
  });

  const currentOrder = currentInstruments.map((instrument) => instrument.instrumentId).join('|');
  const nextOrder = draft.instruments.map((instrument) => instrument.instrumentId).join('|');
  if (currentOrder !== nextOrder) {
    events.push(instrumentsReordered({ orderedInstrumentIds: draft.instruments.map((instrument) => instrument.instrumentId) }));
  }

  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Configurer la jam', events });
}

export function createDraftInstrument(label, index) {
  return { instrumentId: createId('instrument'), label, orderKey: `custom_${index}`, visible: true, isDefault: false };
}
