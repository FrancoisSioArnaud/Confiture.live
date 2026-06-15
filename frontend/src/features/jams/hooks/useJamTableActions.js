import { useState } from 'react';
import { db } from '../../sync/localDb.js';
import { persistLocalAction } from '../services/localJamActions.js';

function targetFromItem(item) {
  return { type: item.type, id: item.appearanceId ?? item.holeId, instrumentId: item.instrumentId };
}

function conflictTargetFromItem(item) {
  return { type: 'appearance', id: item.appearanceId, participationId: item.participationId, instrumentId: item.instrumentId };
}

function plateauTargets(plateau) {
  return Object.values(plateau?.cells ?? {}).filter(Boolean).map((cell) => ({ type: cell.type, id: cell.appearanceId ?? cell.holeId }));
}


function appearanceForTarget(projectedState, target) {
  return target?.type === 'appearance' ? projectedState?.appearances?.[target.id] : null;
}

function hasConflictBetweenTargets(projectedState, first, second) {
  if (first?.type === 'hole' || second?.type === 'hole') return false;
  const firstAppearance = appearanceForTarget(projectedState, first);
  const secondAppearance = appearanceForTarget(projectedState, second);
  return Object.values(projectedState?.conflicts ?? {}).some((conflict) => {
    if (conflict.removed) return false;
    const targetIds = conflict.targetIds ?? [];
    if (conflict.scope === 'appearance') return targetIds.includes(first.id) && targetIds.includes(second.id);
    if (conflict.scope === 'participation') return targetIds.includes(firstAppearance?.participationId) && targetIds.includes(secondAppearance?.participationId);
    return false;
  });
}

export function useJamTableActions({ jamId, projectedState, notify, confirm, refreshProjection }) {
  const [targetToRemove, setTargetToRemove] = useState(null);
  const [linkMode, setLinkMode] = useState(null);
  const [conflictMode, setConflictMode] = useState(null);
  const [conflictScopeOpen, setConflictScopeOpen] = useState(false);
  const [playWithoutSource, setPlayWithoutSource] = useState(null);
  const [playWithoutInstrumentIds, setPlayWithoutInstrumentIds] = useState([]);
  const [callDrawerOpen, setCallDrawerOpen] = useState(false);
  const [callPlateauIndex, setCallPlateauIndex] = useState(1);



  async function askConfirmation(options) {
    if (!confirm) return true;
    return confirm(options);
  }

  async function confirmDelinkIfNeeded(item) {
    if (!item?.isLinked || !item.activeLinks?.length) return true;
    if (!confirm) return true;
    return confirm({
      title: 'Délier ce passage ?',
      description: 'Ce musicien est lié à un autre passage. Pour le repousser ou le remplacer, le link sera supprimé.',
      confirmLabel: 'Délier et continuer',
      confirmColor: 'error',
    });
  }

  function linkRemovalEvents(item) {
    return (item?.activeLinks ?? []).map((linkId) => ({ type: 'link_removed', payload: { linkId } }));
  }

  async function handleLinkClick(item) {
    if (item.isLocked) { notify('Link impossible : cette cible est verrouillée', { severity: 'error' }); return; }
    if (item.isPlayed) { notify('Link impossible : cette cible a déjà été jouée', { severity: 'error' }); return; }
    if (linkMode?.anchor?.id === (item.appearanceId ?? item.holeId)) {
      setLinkMode(null);
      return;
    }
    if (!linkMode && item.isLinked && item.activeLinks?.[0]) {
      await persistLocalAction({ jamId, label: 'Retirer link', events: [{ type: 'link_removed', payload: { linkId: item.activeLinks[0] } }] });
      notify('Link supprimé');
      await refreshProjection();
      return;
    }
    setLinkMode({ anchor: targetFromItem(item), selectedTargets: [targetFromItem(item)] });
  }

  function handleLinkTargetClick(item) {
    if (!linkMode) return;
    if (item.isLocked) { notify('Link impossible : cette cible est verrouillée', { severity: 'error' }); return; }
    if (item.isPlayed) { notify('Link impossible : cette cible a déjà été jouée', { severity: 'error' }); return; }
    const target = targetFromItem(item);
    if (linkMode.selectedTargets.some((selected) => hasConflictBetweenTargets(projectedState, selected, target))) {
      notify('Link impossible : ces passages sont en conflit', { severity: 'error' });
      return;
    }
    const sameInstrumentSelected = linkMode.selectedTargets.some((candidate) => candidate.instrumentId === target.instrumentId && candidate.id !== target.id);
    setLinkMode((current) => {
      const alreadySelected = current.selectedTargets.some((candidate) => candidate.id === target.id);
      if (alreadySelected) return { ...current, selectedTargets: current.selectedTargets.filter((candidate) => candidate.id !== target.id) };
      return { ...current, selectedTargets: [...current.selectedTargets.filter((candidate) => candidate.instrumentId !== target.instrumentId), target] };
    });
    if (sameInstrumentSelected) notify('Une seule cible par instrument : la sélection précédente a été remplacée', { severity: 'info' });
  }

  async function validateLinkMode() {
    if (!linkMode || linkMode.selectedTargets.length < 2) return;
    if (linkMode.selectedTargets.some((target, index, targets) => targets.slice(index + 1).some((other) => hasConflictBetweenTargets(projectedState, target, other)))) {
      notify('Link impossible : ces passages sont en conflit', { severity: 'error' });
      return;
    }
    await persistLocalAction({ jamId, label: 'Créer link', events: [{ type: 'link_created', payload: { linkId: `link_${Date.now()}`, anchorTarget: { type: linkMode.anchor.type, id: linkMode.anchor.id }, targets: linkMode.selectedTargets.map((target) => ({ type: target.type, id: target.id })), reorderStrategy: projectedState?.jam?.linkReorderStrategy ?? 'move_to_first' } }] });
    notify('Link créé');
    setLinkMode(null);
    await refreshProjection();
  }

  function handleConflictClick(item) {
    if (item.type === 'hole') {
      notify('Conflict impossible sur un trou', { severity: 'warning' });
      return;
    }
    if (conflictMode?.anchor?.id === item.appearanceId) {
      setConflictMode(null);
      return;
    }
    setConflictMode({ anchor: conflictTargetFromItem(item), selectedTargets: [conflictTargetFromItem(item)] });
  }

  function handleConflictTargetClick(item) {
    if (!conflictMode) return;
    if (item.type === 'hole') {
      notify('Conflict impossible sur un trou', { severity: 'warning' });
      return;
    }
    const target = conflictTargetFromItem(item);
    setConflictMode((current) => {
      const alreadySelected = current.selectedTargets.some((candidate) => candidate.id === target.id);
      if (alreadySelected) return { ...current, selectedTargets: current.selectedTargets.filter((candidate) => candidate.id !== target.id) };
      return { ...current, selectedTargets: [...current.selectedTargets, target] };
    });
  }

  async function createConflict(scope) {
    if (!conflictMode || conflictMode.selectedTargets.length < 2) return;
    const targetIds = scope === 'participation' ? conflictMode.selectedTargets.map((target) => target.participationId) : conflictMode.selectedTargets.map((target) => target.id);
    await persistLocalAction({ jamId, label: 'Créer conflit', events: [{ type: 'conflict_created', payload: { conflictId: `conflict_${Date.now()}`, scope, targetIds, reason: 'manual', anchorTargetId: targetIds[0] } }] });
    notify('Conflit créé');
    setConflictScopeOpen(false);
    setConflictMode(null);
    await refreshProjection();
  }


  async function removeConflictsForItem(item) {
    if (item.type === 'hole') {
      notify('Les trous ne portent pas de conflict', { severity: 'warning' });
      return;
    }
    const conflictIds = item.activeConflicts ?? [];
    if (!conflictIds.length) return;
    await persistLocalAction({
      jamId,
      label: conflictIds.length > 1 ? 'Supprimer conflicts' : 'Supprimer conflict',
      events: conflictIds.map((conflictId) => ({ type: 'conflict_removed', payload: { conflictId } })),
    });
    notify(conflictIds.length > 1 ? 'Conflicts supprimés' : 'Conflict supprimé');
    await refreshProjection();
  }

  function openPlayWithout(item) {
    const otherInstrumentIds = Object.values(projectedState?.instruments ?? {}).filter((instrument) => instrument.isVisible !== false && instrument.instrumentId !== item.instrumentId).sort((a, b) => a.order - b.order).map((instrument) => instrument.instrumentId);
    setPlayWithoutSource(item);
    setPlayWithoutInstrumentIds(otherInstrumentIds.slice(0, 1));
  }

  function togglePlayWithoutInstrument(instrumentId) {
    setPlayWithoutInstrumentIds((current) => current.includes(instrumentId) ? current.filter((id) => id !== instrumentId) : [...current, instrumentId]);
  }

  async function validatePlayWithout() {
    if (!playWithoutSource || playWithoutInstrumentIds.length === 0) return;
    const createdHoles = playWithoutInstrumentIds.map((instrumentId, index) => ({ holeId: `hole_without_${Date.now()}_${index}`, instrumentId }));
    const events = [
      ...createdHoles.map((hole, index) => ({ type: 'hole_added', payload: { holeId: hole.holeId, instrumentId: hole.instrumentId, appearanceIndex: playWithoutSource.appearanceIndex, reason: 'play_without', positionKey: String(Date.now() + index) } })),
      { type: 'link_created', payload: { linkId: `link_play_without_${Date.now()}`, anchorTarget: { type: 'appearance', id: playWithoutSource.appearanceId }, targets: [{ type: 'appearance', id: playWithoutSource.appearanceId }, ...createdHoles.map((hole) => ({ type: 'hole', id: hole.holeId }))], reorderStrategy: projectedState?.jam?.linkReorderStrategy ?? 'move_to_first' } },
    ];
    await persistLocalAction({ jamId, label: 'Jouer sans', events });
    notify('Trou ajouté et lié au passage');
    setPlayWithoutSource(null);
    setPlayWithoutInstrumentIds([]);
    await refreshProjection();
  }

  async function markCalledPlateauPlayed() {
    const plateau = projectedState?.plateaus?.[callPlateauIndex - 1];
    if (!plateau) return;
    const confirmed = await askConfirmation({ title: `Marquer le plateau ${callPlateauIndex} joué ?`, description: 'Les cards de ce plateau deviendront jouées et immobiles.', confirmLabel: 'Marquer joué' });
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Plateau joué', events: [{ type: 'plateau_played', payload: { plateauIndex: callPlateauIndex, targets: plateauTargets(plateau), playedAt: new Date().toISOString() } }] });
    notify('Plateau marqué joué');
    setCallDrawerOpen(false);
    await refreshProjection();
  }


  async function markPlateauPlayed(plateauIndex) {
    const plateau = projectedState?.plateaus?.[plateauIndex - 1];
    if (!plateau) return;
    const confirmed = await askConfirmation({ title: `Marquer le plateau ${plateauIndex} joué ?`, description: 'Les appearances et holes du plateau deviendront joués et ne pourront plus être déplacés.', confirmLabel: 'Marquer joué' });
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Plateau joué', events: [{ type: 'plateau_played', payload: { plateauIndex, targets: plateauTargets(plateau), playedAt: new Date().toISOString() } }] });
    notify('Plateau marqué joué');
    await refreshProjection();
  }

  async function markPlateauUnplayed(plateauIndex) {
    const lastPlayedPlateau = projectedState?.playedPlateaus?.at(-1);
    if (!lastPlayedPlateau || lastPlayedPlateau.plateauIndex !== plateauIndex) {
      notify('Seul le dernier plateau joué peut être remis à venir', { severity: 'warning' });
      return;
    }
    const confirmed = await askConfirmation({ title: `Remettre le plateau ${plateauIndex} à venir ?`, description: 'Cette action n’est autorisée que sur le dernier plateau joué et rend ses cards à nouveau déplaçables si elles ne sont pas verrouillées.', confirmLabel: 'Remettre à venir' });
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Plateau non joué', events: [{ type: 'plateau_unplayed', payload: { plateauIndex, targets: lastPlayedPlateau.targets ?? [] } }] });
    notify('Plateau remis à venir');
    await refreshProjection();
  }

  async function markLastPlateauUnplayed() {
    const lastPlayedPlateau = projectedState?.playedPlateaus?.at(-1);
    if (!lastPlayedPlateau) return;
    const confirmed = await askConfirmation({ title: `Remettre le plateau ${lastPlayedPlateau.plateauIndex} à venir ?`, description: 'Seul le dernier plateau joué peut être remis à venir en V0.', confirmLabel: 'Remettre à venir' });
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Plateau non joué', events: [{ type: 'plateau_unplayed', payload: { plateauIndex: lastPlayedPlateau.plateauIndex, targets: lastPlayedPlateau.targets ?? [] } }] });
    notify('Plateau remis à venir');
    await refreshProjection();
  }

  async function undoLastTransaction() {
    const targetTransactionId = projectedState?.activeTransactionIds?.at(-1);
    if (!targetTransactionId) return;
    const targetTransaction = await db.localTransactions.get(targetTransactionId);
    if (targetTransaction && ((targetTransaction.clientSequenceNumber ?? 0) <= 1 || targetTransaction.label === 'Créer jam')) {
      notify('Undo refusé : la création initiale de la jam ne peut pas être annulée ici', { severity: 'warning' });
      return;
    }
    const eventTypes = new Set((targetTransaction?.events ?? []).map((event) => event.type));
    const isCritical = ['plateau_played', 'plateau_unplayed', 'hole_removed', 'appearance_removed', 'participant_removed', 'instrument_removed', 'instrument_visibility_changed'].some((type) => eventTypes.has(type));
    const confirmed = await askConfirmation({
      title: 'Annuler la dernière action ?',
      description: isCritical ? 'Cette dernière action touche un passage joué, une suppression ou une configuration sensible. L’undo reste linéaire : seule cette dernière action active sera annulée.' : 'L’undo est linéaire : seule la dernière transaction active sera annulée.',
      confirmLabel: 'Annuler la dernière action',
      confirmColor: isCritical ? 'error' : 'primary',
    });
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Undo', events: [{ type: 'transaction_reverted', payload: { targetTransactionId, reason: 'organizer_undo' } }] });
    notify('Action annulée');
    await refreshProjection();
  }

  async function callDrawerWithoutMusician(cell) {
    if (!cell || cell.type === 'hole') return;
    const confirmed = await confirmDelinkIfNeeded(cell);
    if (!confirmed) return;
    const holeId = `hole_call_without_${Date.now()}`;
    const linkId = `link_call_without_${Date.now()}`;
    await persistLocalAction({ jamId, label: 'Faire sans musicien', events: [
      ...linkRemovalEvents(cell),
      { type: 'hole_added', payload: { holeId, instrumentId: cell.instrumentId, appearanceIndex: cell.appearanceIndex, reason: 'call_drawer_without_musician', positionKey: cell.positionKey ?? cell.orderKey ?? String(Date.now()) } },
      { type: 'link_created', payload: { linkId, anchorTarget: { type: 'appearance', id: cell.appearanceId }, targets: [{ type: 'appearance', id: cell.appearanceId }, { type: 'hole', id: holeId }], reorderStrategy: projectedState?.jam?.linkReorderStrategy ?? 'move_to_first' } },
    ] });
    notify('Le plateau jouera sans musicien sur cet instrument');
    await refreshProjection();
  }

  async function callDrawerReplaceMusician(cell, replacement) {
    if (!cell || !replacement || cell.type === 'hole' || replacement.type !== 'appearance') return;
    const confirmed = await confirmDelinkIfNeeded(cell);
    if (!confirmed) return;
    await persistLocalAction({ jamId, label: 'Remplacer musicien', events: [
      ...linkRemovalEvents(cell),
      { type: 'appearance_moved_between', payload: { appearanceId: replacement.appearanceId, instrumentId: replacement.instrumentId, positionKey: cell.positionKey ?? cell.orderKey ?? String(Date.now()), movedLinkedGroup: false } },
      { type: 'appearance_skipped', payload: { appearanceId: cell.appearanceId, instrumentId: cell.instrumentId, originalPlateauIndex: callPlateauIndex, replacement: { mode: 'appearance', appearanceId: replacement.appearanceId }, removedLinkIds: cell.activeLinks ?? [], confirmedDelink: true } },
    ] });
    notify('Musicien remplacé');
    await refreshProjection();
  }

  async function revealNextRound(instrumentId) {
    const current = projectedState.instruments[instrumentId]?.visibleRoundCount ?? 1;
    await persistLocalAction({ jamId, label: 'Afficher round suivant', events: [{ type: 'instrument_round_visibility_changed', payload: { instrumentId, visibleRoundCount: current + 1 } }] });
    await refreshProjection();
  }

  function targetPayloadForItem(item) {
    if (!item) return null;
    return item.type === 'hole' ? { type: 'hole', id: item.holeId } : { type: 'appearance', id: item.appearanceId };
  }

  function positionKeyBetween(afterItem, beforeItem, fallbackIndex = 0) {
    const afterKey = Number.parseFloat(afterItem?.orderKey ?? afterItem?.positionKey ?? fallbackIndex * 1000);
    const beforeKey = Number.parseFloat(beforeItem?.orderKey ?? beforeItem?.positionKey ?? (fallbackIndex + 2) * 1000);
    if (Number.isFinite(afterKey) && Number.isFinite(beforeKey) && afterKey !== beforeKey) return String((afterKey + beforeKey) / 2);
    return String(Date.now());
  }

  async function addHole(instrumentId) {
    await persistLocalAction({ jamId, label: 'Ajouter trou', events: [{ type: 'hole_added', payload: { holeId: `hole_${Date.now()}`, instrumentId, appearanceIndex: 1, reason: 'manual', positionKey: String(Date.now()) } }] });
    await refreshProjection();
  }

  async function addHoleBetween(instrumentId, afterItem, beforeItem, fallbackIndex = 0) {
    const now = Date.now();
    await persistLocalAction({
      jamId,
      label: 'Ajouter trou ici',
      events: [{
        type: 'hole_added',
        payload: {
          holeId: `hole_${now}`,
          instrumentId,
          appearanceIndex: beforeItem?.appearanceIndex ?? afterItem?.appearanceIndex ?? 1,
          reason: 'manual',
          afterTarget: targetPayloadForItem(afterItem),
          beforeTarget: targetPayloadForItem(beforeItem),
          positionKey: positionKeyBetween(afterItem, beforeItem, fallbackIndex),
        },
      }],
    });
    await refreshProjection();
  }

  async function lockToggle(item) {
    const isHole = item.type === 'hole';
    const type = isHole ? (item.isLocked ? 'hole_unlocked' : 'hole_locked') : (item.isLocked ? 'appearance_unlocked' : 'appearance_locked');
    const payload = isHole ? { holeId: item.holeId } : { appearanceId: item.appearanceId };
    await persistLocalAction({ jamId, label: item.isLocked ? 'Unlock' : 'Lock', events: [{ type, payload }] });
    notify(item.isLocked ? 'Passage déverrouillé' : 'Passage verrouillé');
    await refreshProjection();
  }

  async function moveVertically(item, direction, items) {
    if (item.isLocked || item.isPlayed) return;
    const currentIndex = items.findIndex((candidate) => (candidate.appearanceId ?? candidate.holeId) === (item.appearanceId ?? item.holeId));
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, item);
    const before = reordered[targetIndex - 1];
    const after = reordered[targetIndex + 1];
    const beforeKey = Number.parseFloat(before?.orderKey ?? targetIndex * 1000);
    const afterKey = Number.parseFloat(after?.orderKey ?? (targetIndex + 2) * 1000);
    const fallback = (targetIndex + 1) * 1000;
    const positionKey = Number.isFinite(beforeKey) && Number.isFinite(afterKey) ? String((beforeKey + afterKey) / 2) : String(fallback);
    const isHole = item.type === 'hole';
    await persistLocalAction({ jamId, label: 'Déplacer verticalement', events: [{ type: isHole ? 'hole_moved_between' : 'appearance_moved_between', payload: isHole ? { holeId: item.holeId, instrumentId: item.instrumentId, positionKey, movedLinkedGroup: false } : { appearanceId: item.appearanceId, instrumentId: item.instrumentId, positionKey, movedLinkedGroup: false } }] });
    await refreshProjection();
  }

  async function removeTarget() {
    const item = targetToRemove;
    if (!item) return;
    if (item.isPlayed) {
      notify(item.type === 'hole' ? 'Un trou joué ne peut pas être supprimé' : 'Un passage joué ne peut pas être supprimé', { severity: 'warning' });
      setTargetToRemove(null);
      return;
    }
    const type = item.type === 'hole' ? 'hole_removed' : 'appearance_removed';
    const payload = item.type === 'hole' ? { holeId: item.holeId, confirmedDespiteLink: true } : { appearanceId: item.appearanceId, confirmedDespiteLink: true };
    await persistLocalAction({ jamId, label: 'Supprimer passage', events: [{ type, payload }] });
    notify(item.type === 'hole' ? 'Trou supprimé' : 'Passage supprimé');
    setTargetToRemove(null);
    await refreshProjection();
  }

  return {
    targetToRemove, setTargetToRemove,
    linkMode, setLinkMode, handleLinkClick, handleLinkTargetClick, validateLinkMode,
    conflictMode, setConflictMode, conflictScopeOpen, setConflictScopeOpen, handleConflictClick, handleConflictTargetClick, createConflict, removeConflictsForItem,
    playWithoutSource, setPlayWithoutSource, playWithoutInstrumentIds, togglePlayWithoutInstrument, openPlayWithout, validatePlayWithout,
    callDrawerOpen, setCallDrawerOpen, callPlateauIndex, setCallPlateauIndex, callDrawerWithoutMusician, callDrawerReplaceMusician, markCalledPlateauPlayed,
    markPlateauPlayed, markPlateauUnplayed, markLastPlateauUnplayed, undoLastTransaction, revealNextRound, addHole, addHoleBetween, lockToggle, moveVertically, removeTarget,
  };
}
