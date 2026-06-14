import { useState } from 'react';
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

export function useJamTableActions({ jamId, projectedState, notify, refreshProjection }) {
  const [targetToRemove, setTargetToRemove] = useState(null);
  const [linkMode, setLinkMode] = useState(null);
  const [conflictMode, setConflictMode] = useState(null);
  const [conflictScopeOpen, setConflictScopeOpen] = useState(false);
  const [playWithoutSource, setPlayWithoutSource] = useState(null);
  const [playWithoutInstrumentIds, setPlayWithoutInstrumentIds] = useState([]);
  const [callDrawerOpen, setCallDrawerOpen] = useState(false);
  const [callPlateauIndex, setCallPlateauIndex] = useState(1);

  async function handleLinkClick(item) {
    if (linkMode?.anchor?.id === (item.appearanceId ?? item.holeId)) {
      setLinkMode(null);
      return;
    }
    if (!linkMode && item.isLinked && item.activeLinks?.[0]) {
      await persistLocalAction({ jamId, label: 'Retirer link', events: [{ type: 'link_removed', payload: { linkId: item.activeLinks[0] } }] });
      notify('Link retiré.');
      await refreshProjection();
      return;
    }
    setLinkMode({ anchor: targetFromItem(item), selectedTargets: [targetFromItem(item)] });
  }

  function handleLinkTargetClick(item) {
    if (!linkMode) return;
    const target = targetFromItem(item);
    setLinkMode((current) => {
      const alreadySelected = current.selectedTargets.some((candidate) => candidate.id === target.id);
      if (alreadySelected) return { ...current, selectedTargets: current.selectedTargets.filter((candidate) => candidate.id !== target.id) };
      return { ...current, selectedTargets: [...current.selectedTargets.filter((candidate) => candidate.instrumentId !== target.instrumentId), target] };
    });
  }

  async function validateLinkMode() {
    if (!linkMode || linkMode.selectedTargets.length < 2) return;
    await persistLocalAction({ jamId, label: 'Créer link', events: [{ type: 'link_created', payload: { linkId: `link_${Date.now()}`, anchorTarget: { type: linkMode.anchor.type, id: linkMode.anchor.id }, targets: linkMode.selectedTargets.map((target) => ({ type: target.type, id: target.id })), reorderStrategy: projectedState?.jam?.linkReorderStrategy ?? 'move_to_first' } }] });
    notify('Link créé et projection mise à jour.');
    setLinkMode(null);
    await refreshProjection();
  }

  function handleConflictClick(item) {
    if (item.type === 'hole') return;
    if (conflictMode?.anchor?.id === item.appearanceId) {
      setConflictMode(null);
      return;
    }
    setConflictMode({ anchor: conflictTargetFromItem(item), selectedTargets: [conflictTargetFromItem(item)] });
  }

  function handleConflictTargetClick(item) {
    if (!conflictMode || item.type === 'hole') return;
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
    notify(scope === 'participation' ? 'Conflit appliqué pour la soirée.' : 'Conflit appliqué à ce passage.');
    setConflictScopeOpen(false);
    setConflictMode(null);
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
    notify('Trou lié créé pour jouer sans musicien.');
    setPlayWithoutSource(null);
    setPlayWithoutInstrumentIds([]);
    await refreshProjection();
  }

  async function markCalledPlateauPlayed() {
    const plateau = projectedState?.plateaus?.[callPlateauIndex - 1];
    if (!plateau) return;
    await persistLocalAction({ jamId, label: 'Plateau joué', events: [{ type: 'plateau_played', payload: { plateauIndex: callPlateauIndex, targets: plateauTargets(plateau), playedAt: new Date().toISOString() } }] });
    notify('Plateau marqué joué.');
    setCallDrawerOpen(false);
    await refreshProjection();
  }

  async function markLastPlateauUnplayed() {
    const lastPlayedPlateau = projectedState?.playedPlateaus?.at(-1);
    if (!lastPlayedPlateau) return;
    await persistLocalAction({ jamId, label: 'Plateau non joué', events: [{ type: 'plateau_unplayed', payload: { plateauIndex: lastPlayedPlateau.plateauIndex, targets: lastPlayedPlateau.targets ?? [] } }] });
    notify('Dernier plateau remis en attente.');
    await refreshProjection();
  }

  async function undoLastTransaction() {
    const targetTransactionId = projectedState?.activeTransactionIds?.at(-1);
    if (!targetTransactionId) return;
    await persistLocalAction({ jamId, label: 'Undo', events: [{ type: 'transaction_reverted', payload: { targetTransactionId, reason: 'global_undo' } }] });
    notify('Dernière action annulée.');
    await refreshProjection();
  }

  async function callDrawerWithoutMusician(cell) {
    if (!cell || cell.type === 'hole') return;
    const holeId = `hole_call_without_${Date.now()}`;
    await persistLocalAction({ jamId, label: 'Faire sans musicien', events: [
      { type: 'hole_added', payload: { holeId, instrumentId: cell.instrumentId, appearanceIndex: cell.appearanceIndex, reason: 'call_drawer_without_musician', positionKey: cell.positionKey ?? cell.orderKey ?? String(Date.now()) } },
      { type: 'appearance_skipped', payload: { appearanceId: cell.appearanceId, instrumentId: cell.instrumentId, originalPlateauIndex: callPlateauIndex, replacement: { mode: 'hole', holeId }, createdHoleId: holeId, removedLinkIds: [], confirmedDelink: true } },
    ] });
    notify('Musicien remplacé par un trou.');
    await refreshProjection();
  }

  async function revealNextRound(instrumentId) {
    const current = projectedState.instruments[instrumentId]?.visibleRoundCount ?? 1;
    await persistLocalAction({ jamId, label: 'Afficher round suivant', events: [{ type: 'instrument_round_visibility_changed', payload: { instrumentId, visibleRoundCount: current + 1 } }] });
    await refreshProjection();
  }

  async function addHole(instrumentId) {
    await persistLocalAction({ jamId, label: 'Ajouter trou', events: [{ type: 'hole_added', payload: { holeId: `hole_${Date.now()}`, instrumentId, appearanceIndex: 1, reason: 'manual', positionKey: String(Date.now()) } }] });
    await refreshProjection();
  }

  async function lockToggle(item) {
    const isHole = item.type === 'hole';
    const type = isHole ? (item.isLocked ? 'hole_unlocked' : 'hole_locked') : (item.isLocked ? 'appearance_unlocked' : 'appearance_locked');
    const payload = isHole ? { holeId: item.holeId } : { appearanceId: item.appearanceId };
    await persistLocalAction({ jamId, label: item.isLocked ? 'Unlock' : 'Lock', events: [{ type, payload }] });
    notify(item.isLocked ? 'Déverrouillé.' : 'Verrouillé.');
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
    const type = item.type === 'hole' ? 'hole_removed' : 'appearance_removed';
    const payload = item.type === 'hole' ? { holeId: item.holeId, confirmedDespiteLink: true } : { appearanceId: item.appearanceId, confirmedDespiteLink: true };
    await persistLocalAction({ jamId, label: 'Supprimer passage', events: [{ type, payload }] });
    notify(item.type === 'hole' ? 'Trou supprimé.' : 'Passage supprimé.');
    setTargetToRemove(null);
    await refreshProjection();
  }

  return {
    targetToRemove, setTargetToRemove,
    linkMode, setLinkMode, handleLinkClick, handleLinkTargetClick, validateLinkMode,
    conflictMode, setConflictMode, conflictScopeOpen, setConflictScopeOpen, handleConflictClick, handleConflictTargetClick, createConflict,
    playWithoutSource, setPlayWithoutSource, playWithoutInstrumentIds, togglePlayWithoutInstrument, openPlayWithout, validatePlayWithout,
    callDrawerOpen, setCallDrawerOpen, callPlateauIndex, setCallPlateauIndex, callDrawerWithoutMusician, markCalledPlateauPlayed,
    markLastPlateauUnplayed, undoLastTransaction, revealNextRound, addHole, lockToggle, moveVertically, removeTarget,
  };
}
