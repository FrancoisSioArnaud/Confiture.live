import { conflictRemoved, linkCreated, linkRemoved } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function toTarget(card) {
  return { type: card.type, id: card.id };
}

function targetMatchesCard(target, card) {
  return target.type === card.type && target.id === card.id;
}

function targetKey(target) {
  return target ? `${target.type}:${target.id}` : '';
}

function isUsableActiveLink(link) {
  return link.status === 'active'
    && link.suppressedByConflict !== true
    && link.suppressedBySameColumn !== true
    && link.suppressedByInvalidTargets !== true;
}

function targetEntity(projection, target) {
  if (!target) return null;
  if (target.type === 'appearance') return projection.appearances?.[target.id] ?? null;
  if (target.type === 'hole') return projection.holes?.[target.id] ?? null;
  return null;
}

function targetInstrumentId(projection, target, selectedCardsByTargetKey = new Map()) {
  const selectedCard = selectedCardsByTargetKey.get(targetKey(target));
  return selectedCard?.instrumentId ?? targetEntity(projection, target)?.instrumentId ?? null;
}

function hasDuplicateInstrumentTargets(targets, projection, selectedCardsByTargetKey = new Map()) {
  const instruments = targets.map((target) => targetInstrumentId(projection, target, selectedCardsByTargetKey)).filter(Boolean);
  return new Set(instruments).size !== instruments.length;
}

function conflictTargetIdsForCards(conflict, cards) {
  if (conflict.scope === 'participation') return cards.filter((card) => card.type === 'appearance').map((card) => card.participationId);
  return cards.map((card) => card.id);
}

function uniqueTargets(targets) {
  return [...new Map(targets.filter(Boolean).map((target) => [targetKey(target), { ...target }])).values()];
}

function targetsForLink(link) {
  return (link.targets ?? []).map((target) => ({ ...target }));
}

function linksTouchingTargets(targets, links) {
  const targetKeys = new Set(targets.map(targetKey));
  return Object.values(links ?? {}).filter((link) => isUsableActiveLink(link) && (link.targets ?? []).some((target) => targetKeys.has(targetKey(target))));
}

export function activeLinksForCards(cards, links) {
  const validCards = cards.filter(Boolean);
  return Object.values(links ?? {}).filter((link) => isUsableActiveLink(link) && (link.targets ?? []).some((target) => validCards.some((card) => targetMatchesCard(target, card))));
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

function buildFinalLinkTargets({ projection, anchorCard, uniqueSelectedCards, linksToRemove }) {
  const selectedTargets = uniqueSelectedCards.map(toTarget);
  const selectedTargetKeys = new Set(selectedTargets.map(targetKey));
  const selectedCardsByTargetKey = new Map(uniqueSelectedCards.map((card) => [targetKey(toTarget(card)), card]));
  const openedLinks = activeLinksForCards([anchorCard], projection.links);
  const openedLinkIds = new Set(openedLinks.map((link) => link.linkId ?? link.id));
  const finalTargets = [...selectedTargets];

  linksToRemove.forEach((link) => {
    const linkId = link.linkId ?? link.id;
    if (openedLinkIds.has(linkId)) {
      // Editing the currently opened group: deselected targets are intentionally removed.
      targetsForLink(link).forEach((target) => {
        if (selectedTargetKeys.has(targetKey(target))) finalTargets.push(target);
      });
      return;
    }

    // Merging another linked group by selecting one of its members: include the
    // whole group, because links are non-oriented groups rather than pair edges.
    finalTargets.push(...targetsForLink(link));
  });

  const targets = uniqueTargets(finalTargets);
  if (targets.length < 2) return { targets, selectedCardsByTargetKey };
  if (hasDuplicateInstrumentTargets(targets, projection, selectedCardsByTargetKey)) return { targets: null, selectedCardsByTargetKey };
  return { targets, selectedCardsByTargetKey };
}

export function buildLinkModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, selectedCards, conflictsToRemove = [] }) {
  if (!anchorCard) return null;
  const events = [];
  const uniqueSelectedCards = [...new Map(selectedCards.filter(Boolean).map((card) => [card.id, card])).values()];
  if (hasDuplicateInstrumentTargets(uniqueSelectedCards.map(toTarget), projection, new Map(uniqueSelectedCards.map((card) => [targetKey(toTarget(card)), card])))) return null;

  const selectedTargets = uniqueSelectedCards.map(toTarget);
  const linksToRemove = linksTouchingTargets([toTarget(anchorCard), ...selectedTargets], projection.links);
  const { targets: finalTargets } = buildFinalLinkTargets({ projection, anchorCard, uniqueSelectedCards, linksToRemove });
  if (finalTargets === null) return null;

  linksToRemove.forEach((link) => events.push(linkRemoved({ linkId: link.linkId })));
  [...new Map(conflictsToRemove.map((conflict) => [conflict.conflictId, conflict])).values()]
    .filter((conflict) => conflict?.status === 'active')
    .forEach((conflict) => events.push(conflictRemoved({ conflictId: conflict.conflictId })));

  if (finalTargets.length >= 2) {
    events.push(linkCreated({
      linkId: createId('link'),
      targets: finalTargets,
      reorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_first',
    }));
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: finalTargets.length >= 2 ? 'Créer link' : 'Retirer link', events });
}

export function selectedCardsWillMove(cards) {
  const scores = cards.map((card) => card.orderScore ?? card.positionKey ?? card.baseOrderKey).map(String);
  return new Set(scores).size > 1;
}
