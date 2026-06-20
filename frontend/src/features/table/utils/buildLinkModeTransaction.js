import { conflictRemoved, linkCreated, linkRemoved } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function toTarget(card) {
  return { type: card.type, id: card.id };
}

function targetMatchesCard(target, card) {
  return target.type === card.type && target.id === card.id;
}

function isUsableActiveLink(link) {
  return link.status === 'active' && link.suppressedByConflict !== true && link.suppressedBySameColumn !== true;
}

function hasDuplicateInstrument(cards) {
  const instruments = cards.map((card) => card.instrumentId).filter(Boolean);
  return new Set(instruments).size !== instruments.length;
}

function conflictTargetIdsForCards(conflict, cards) {
  if (conflict.scope === 'participation') return cards.filter((card) => card.type === 'appearance').map((card) => card.participationId);
  return cards.map((card) => card.id);
}

export function activeLinksForCards(cards, links) {
  return Object.values(links ?? {}).filter((link) => isUsableActiveLink(link) && link.targets.some((target) => cards.some((card) => targetMatchesCard(target, card))));
}

export function linkModeInitialSelection(anchorCard, links, cardsById) {
  const linkedCards = activeLinksForCards([anchorCard], links).flatMap((link) => link.targets.map((target) => cardsById.get(target.id)?.card).filter(Boolean));
  return linkedCards.length > 0 ? linkedCards : [anchorCard];
}

export function contradictoryConflictsForCards(cards, projection) {
  return Object.values(projection.conflicts ?? {}).filter((conflict) => {
    if (conflict.status !== 'active' || conflict.suppressedBySameColumn === true) return false;
    const targetIds = conflictTargetIdsForCards(conflict, cards);
    return conflict.targetIds.filter((targetId) => targetIds.includes(targetId)).length >= 2;
  });
}

export function hasContradictoryConflict(cards, projection) {
  return contradictoryConflictsForCards(cards, projection).length > 0;
}

export function buildLinkModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, selectedCards, conflictsToRemove = [] }) {
  const events = [];
  const uniqueSelectedCards = [...new Map(selectedCards.map((card) => [card.id, card])).values()];
  if (hasDuplicateInstrument(uniqueSelectedCards)) return null;
  const linksToRemove = activeLinksForCards([anchorCard, ...uniqueSelectedCards], projection.links);
  linksToRemove.forEach((link) => events.push(linkRemoved({ linkId: link.linkId })));
  [...new Map(conflictsToRemove.map((conflict) => [conflict.conflictId, conflict])).values()]
    .filter((conflict) => conflict?.status === 'active')
    .forEach((conflict) => events.push(conflictRemoved({ conflictId: conflict.conflictId })));
  if (uniqueSelectedCards.length >= 2) {
    events.push(linkCreated({
      linkId: createId('link'),
      targets: uniqueSelectedCards.map(toTarget),
      anchorTarget: toTarget(anchorCard),
      reorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_first',
    }));
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: uniqueSelectedCards.length >= 2 ? 'Créer link' : 'Retirer link', events });
}

export function selectedCardsWillMove(cards) {
  const scores = cards.map((card) => card.orderScore ?? card.positionKey ?? card.baseOrderKey).map(String);
  return new Set(scores).size > 1;
}
