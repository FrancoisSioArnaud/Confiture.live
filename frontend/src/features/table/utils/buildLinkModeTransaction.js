import { linkCreated, linkRemoved } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function toTarget(card) {
  return { type: card.type, id: card.id };
}

function targetMatchesCard(target, card) {
  return target.type === card.type && target.id === card.id;
}

export function activeLinksForCards(cards, links) {
  return Object.values(links ?? {}).filter((link) => link.status === 'active' && link.targets.some((target) => cards.some((card) => targetMatchesCard(target, card))));
}

export function linkModeInitialSelection(anchorCard, links, cardsById) {
  const linkedCards = activeLinksForCards([anchorCard], links).flatMap((link) => link.targets.map((target) => cardsById.get(target.id)?.card).filter(Boolean));
  return linkedCards.length > 0 ? linkedCards : [anchorCard];
}

export function hasContradictoryConflict(cards, projection) {
  return Object.values(projection.conflicts ?? {}).some((conflict) => {
    if (conflict.status !== 'active') return false;
    const ids = cards.map((card) => card.id);
    const participationIds = cards.filter((card) => card.type === 'appearance').map((card) => card.participationId);
    const targetSet = conflict.scope === 'participation' ? participationIds : ids;
    return conflict.targetIds.filter((targetId) => targetSet.includes(targetId)).length >= 2;
  });
}

export function buildLinkModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, selectedCards }) {
  const events = [];
  const linksToRemove = activeLinksForCards([anchorCard, ...selectedCards], projection.links);
  linksToRemove.forEach((link) => events.push(linkRemoved({ linkId: link.linkId })));
  if (selectedCards.length >= 2) {
    events.push(linkCreated({
      linkId: createId('link'),
      targets: selectedCards.map(toTarget),
      anchorTarget: toTarget(anchorCard),
      reorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_first',
    }));
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: selectedCards.length >= 2 ? 'Créer link' : 'Retirer link', events });
}

export function selectedCardsWillMove(cards) {
  const scores = cards.map((card) => card.orderScore ?? card.positionKey ?? card.baseOrderKey).map(String);
  return new Set(scores).size > 1;
}
