import { Add, Call, CheckCircle, DragIndicator, Link as LinkIcon, Lock, LockOpen, MoreVert, RadioButtonUnchecked } from '@mui/icons-material';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, FormGroup, IconButton, List, ListItem, ListItemText, Menu, MenuItem, Paper, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import {
  buildAddHoleTransaction,
  buildRevealRoundTransaction,
  buildTogglePlateauPlayedTransaction,
} from '../utils/buildTableActionTransaction';
import {
  buildMoveCardTransaction,
  buildParticipantLeftTransaction,
  buildRemoveCardTransaction,
  buildRemoveParticipantTransaction,
  buildToggleLockTransaction,
} from '../utils/buildCardActionTransaction';
import { canDragCard, cardConflicts, cardLinks, participantHasPlayed } from '../utils/cardState';
import { buildLinkModeTransaction, hasContradictoryConflict, linkModeInitialSelection, selectedCardsWillMove } from '../utils/buildLinkModeTransaction';
import { activeConflictsBetween, buildConflictModeTransaction } from '../utils/buildConflictModeTransaction';
import { buildPlayWithoutTransaction } from '../utils/buildPlayWithoutTransaction';
import { buildSkipWithReplacementTransaction, buildSkipWithoutMusicianTransaction, replacementCandidatesForCallDrawer } from '../utils/buildCallDrawerTransaction';

function transformToCss(transform) {
  if (!transform) return undefined;
  const x = Math.round(transform.x ?? 0);
  const y = Math.round(transform.y ?? 0);
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function targetFor(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

function cardTitle(card, projection) {
  if (card.type === 'hole') return 'Trou';
  return projection.participants[card.participantId]?.name ?? 'Musicien';
}

function CardActions({ card, linked, linkModeActive, onToggleLink, onToggleLock, onOpenMenu, onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center">
      <Tooltip title={linkModeActive ? 'Sélection link' : linked ? 'Lié' : 'Non lié'}><IconButton size="small" aria-label={linked ? 'Card liée' : 'Card non liée'} onClick={onToggleLink}><LinkIcon fontSize="small" color={linked || linkModeActive ? 'primary' : 'disabled'} /></IconButton></Tooltip>
      <Tooltip title={card.locked ? 'Déverrouiller' : 'Verrouiller'}><IconButton size="small" aria-label={card.locked ? 'Déverrouiller' : 'Verrouiller'} onClick={onToggleLock}>{card.locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}</IconButton></Tooltip>
      <Tooltip title={dragDisabled ? 'Déplacement impossible' : 'Déplacer verticalement'}>
        <span>
          <IconButton size="small" aria-label="Déplacer verticalement" sx={{ display: { xs: 'none', sm: 'inline-flex' }, cursor: dragDisabled ? 'not-allowed' : 'grab' }} onClick={dragDisabled ? onBlockedDrag : undefined} {...(!dragDisabled ? dragAttributes : {})} {...(!dragDisabled ? dragListeners : {})}>
            <DragIndicator fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <IconButton size="small" aria-label="Menu card" onClick={onOpenMenu}><MoreVert fontSize="small" /></IconButton>
    </Stack>
  );
}

function AppearanceCard({ card, projection, instrument, linkModeActive, conflictMode, selectedForLink, selectableForLink, selectedForConflict, selectableForConflict, onToggleLink, onToggleLock, onOpenMenu, onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  const linked = cardLinks(card, projection.links).length > 0;
  const conflicted = cardConflicts(card, projection.conflicts).length > 0;
  return (
    <Card variant="outlined" sx={{ opacity: card.played ? 0.55 : 1, borderStyle: card.locked || linked ? 'solid' : 'dashed', borderColor: selectedForConflict ? 'error.main' : selectableForConflict ? 'error.light' : selectedForLink ? 'success.main' : selectableForLink ? 'primary.light' : linked ? 'primary.main' : card.locked ? 'warning.main' : 'divider', bgcolor: card.played ? 'action.hover' : 'background.paper', transition: 'transform 850ms ease, opacity 300ms ease, border-color 200ms ease' }}>
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography fontWeight={800} noWrap>{cardTitle(card, projection)}</Typography>
            <Typography variant="caption" color="text.secondary">{instrument.label}{card.appearanceIndex > 1 ? ` · R${card.appearanceIndex}` : ''}</Typography>
          </Box>
          <CardActions card={card} linked={linked} linkModeActive={linkModeActive} onToggleLink={onToggleLink} onToggleLock={onToggleLock} onOpenMenu={onOpenMenu} onBlockedDrag={onBlockedDrag} dragListeners={dragListeners} dragAttributes={dragAttributes} dragDisabled={dragDisabled} />
        </Stack>
        <Stack direction="row" spacing={0.5} mt={0.75} flexWrap="wrap">
          {card.appearanceIndex > 1 ? <Chip size="small" label={`R${card.appearanceIndex}`} /> : null}
          {linked ? <Chip size="small" label="Lié" color="primary" variant="outlined" /> : null}
          {(selectedForConflict || conflicted) ? <Chip size="small" label="Conflit" color="error" variant="outlined" /> : null}
          {card.locked ? <Chip size="small" label="Verrouillé" color="warning" /> : null}
          {card.played ? <Chip size="small" label="Joué" color="success" /> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function HoleCard({ card, projection, linkModeActive, selectedForLink, selectableForLink, onToggleLink, onToggleLock, onOpenMenu, onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  const linked = cardLinks(card, projection.links).length > 0;
  return (
    <Card variant="outlined" sx={{ opacity: card.played ? 0.55 : 1, borderColor: selectedForLink ? 'success.main' : selectableForLink ? 'primary.light' : linked ? 'primary.main' : card.locked ? 'warning.main' : 'divider', bgcolor: card.played ? 'action.hover' : 'background.paper', transition: 'transform 850ms ease, opacity 300ms ease, border-color 200ms ease' }}>
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography fontWeight={800} sx={{ flexGrow: 1 }}>Trou</Typography>
          <CardActions card={card} linked={linked} linkModeActive={linkModeActive} onToggleLink={onToggleLink} onToggleLock={onToggleLock} onOpenMenu={onOpenMenu} onBlockedDrag={onBlockedDrag} dragListeners={dragListeners} dragAttributes={dragAttributes} dragDisabled={dragDisabled} />
        </Stack>
        <Stack direction="row" spacing={0.5} mt={0.75} flexWrap="wrap">
          <Chip size="small" label={`R${card.appearanceIndex}`} />
          {linked ? <Chip size="small" label="Lié" color="primary" variant="outlined" /> : null}
          {card.locked ? <Chip size="small" icon={<Lock />} label="Verrouillé" color="warning" /> : null}
          {card.played ? <Chip size="small" label="Joué" color="success" /> : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

function SortableProjectedCard({ card, projection, instrument, linkMode, conflictMode, onToggleLink, onSelectConflict, onToggleLock, onOpenMenu, onBlockedDrag }) {
  const selectedForLink = Boolean(linkMode?.selectedIds?.has(card.id));
  const selectableForLink = Boolean(linkMode?.active && linkMode.anchor?.instrumentId !== card.instrumentId && !card.played && !card.locked);
  const selectedForConflict = Boolean(conflictMode?.active && (conflictMode.anchor?.id === card.id || conflictMode.target?.id === card.id));
  const selectableForConflict = Boolean(conflictMode?.active && card.type === 'appearance' && conflictMode.anchor?.id !== card.id);
  const dragDisabled = linkMode?.active || conflictMode?.active || !canDragCard(card, projection);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { card, instrumentId: instrument.instrumentId } });
  return (
    <Box ref={setNodeRef} onClick={conflictMode?.active && selectableForConflict ? () => onSelectConflict(card) : undefined} sx={{ transform: transformToCss(transform), transition, opacity: isDragging ? 0.7 : 1, cursor: conflictMode?.active && selectableForConflict ? 'crosshair' : 'default' }}>
      {card.type === 'hole'
        ? <HoleCard card={card} projection={projection} linkModeActive={linkMode?.active} conflictMode={conflictMode} selectedForLink={selectedForLink} selectableForLink={selectableForLink} selectedForConflict={selectedForConflict} selectableForConflict={selectableForConflict} onToggleLink={() => (conflictMode?.active ? onSelectConflict(card) : onToggleLink(card))} onToggleLock={() => onToggleLock(card)} onOpenMenu={(event) => onOpenMenu(event, card)} onBlockedDrag={() => onBlockedDrag(card)} dragListeners={listeners} dragAttributes={attributes} dragDisabled={dragDisabled} />
        : <AppearanceCard card={card} projection={projection} instrument={instrument} linkModeActive={linkMode?.active} conflictMode={conflictMode} selectedForLink={selectedForLink} selectableForLink={selectableForLink} selectedForConflict={selectedForConflict} selectableForConflict={selectableForConflict} onToggleLink={() => (conflictMode?.active ? onSelectConflict(card) : onToggleLink(card))} onToggleLock={() => onToggleLock(card)} onOpenMenu={(event) => onOpenMenu(event, card)} onBlockedDrag={() => onBlockedDrag(card)} dragListeners={listeners} dragAttributes={attributes} dragDisabled={dragDisabled} />}
    </Box>
  );
}

function InsertionZone({ label, onAddHole, onAddParticipant }) {
  return (
    <Paper variant="outlined" sx={{ p: 0.75, borderStyle: 'dashed', bgcolor: 'background.default' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={0.75} mt={0.5}>
        <Button size="small" variant="text" startIcon={<Add />} onClick={onAddHole}>Ajouter un trou</Button>
        <Button size="small" variant="text" startIcon={<Add />} onClick={onAddParticipant}>Ajouter un participant</Button>
      </Stack>
    </Paper>
  );
}

function PlateauRail({ rows, projection, onOpenCallDrawer, onTogglePlateauPlayed }) {
  return (
    <Box sx={{ minWidth: 132, flex: '0 0 132px', position: { sm: 'sticky' }, left: 0, zIndex: 1, bgcolor: 'background.paper' }}>
      <Stack spacing={1}>
        <Box sx={{ minHeight: 48 }} />
        {rows.map((row) => {
          const played = row.targets.length > 0 && row.targets.every((target) => (target.type === 'appearance' ? projection.appearances[target.id]?.played : projection.holes[target.id]?.played));
          return (
            <Paper key={row.plateauIndex} variant="outlined" sx={{ p: 1, minHeight: 132, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" fontWeight={900}>Plateau {row.plateauIndex + 1}</Typography>
              <Stack spacing={0.75}>
                <Button size="small" variant="outlined" startIcon={<Call />} onClick={() => onOpenCallDrawer?.(row.plateauIndex)}>Appeler</Button>
                <Button size="small" color={played ? 'success' : 'primary'} variant={played ? 'contained' : 'outlined'} startIcon={played ? <CheckCircle /> : <RadioButtonUnchecked />} onClick={() => onTogglePlateauPlayed(row.plateauIndex, row.targets, played)} disabled={row.targets.length === 0}>
                  {played ? 'Joué' : 'Marquer joué'}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}


function CallDrawer({ open, plateauIndex, projection, jamId, clientId, clientSequenceNumber, onClose, onTransaction, onFeedback }) {
  const theme = useTheme();
  const isTabletUp = useMediaQuery(theme.breakpoints.up('sm'));
  const [missingCard, setMissingCard] = useState(null);
  const columns = projection?.columns ?? [];
  const rowCards = columns.map((column) => ({ column, card: column.cards[plateauIndex] ?? null }));
  const targets = rowCards.map(({ card }) => targetFor(card)).filter(Boolean);
  const alreadyPlayed = targets.length > 0 && targets.every((target) => (target.type === 'appearance' ? projection.appearances[target.id]?.played : projection.holes[target.id]?.played));
  const replacementCandidates = missingCard ? replacementCandidatesForCallDrawer({ projection, sourceCard: missingCard, plateauIndex }) : [];
  const missingCardLinked = missingCard ? cardLinks(missingCard, projection.links).length > 0 : false;

  function close() {
    setMissingCard(null);
    onClose?.();
  }

  function markPlayed() {
    onTransaction?.(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex, targets, played: false }));
    close();
  }

  function chooseReplacement(replacementCard) {
    const replacementLinked = cardLinks(replacementCard, projection.links).length > 0;
    if ((missingCardLinked || replacementLinked) && !window.confirm('Ce remplacement supprimera un link existant. Continuer ?')) return;
    onTransaction?.(buildSkipWithReplacementTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard: missingCard, replacementCard, plateauIndex, confirmedDelink: missingCardLinked || replacementLinked }));
    onFeedback?.('Passage repoussé et remplaçant appelé');
    setMissingCard(null);
  }

  function chooseWithoutMusician() {
    if (missingCardLinked && !window.confirm('Faire sans musicien supprimera le link existant. Continuer ?')) return;
    onTransaction?.(buildSkipWithoutMusicianTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard: missingCard, plateauIndex, confirmedDelink: missingCardLinked }));
    onFeedback?.('Le plateau jouera sans musicien sur cet instrument');
    setMissingCard(null);
  }

  return (
    <Drawer anchor={isTabletUp ? 'right' : 'bottom'} open={open} onClose={close} PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, height: { xs: '100%', sm: '100%' }, maxWidth: '100%' } }}>
      <Box sx={{ p: 2, pb: 10, height: '100%', overflowY: 'auto' }}>
        <Typography variant="h6" fontWeight={900}>Appel plateau {plateauIndex == null ? '' : plateauIndex + 1}</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Instruments visibles dans l’ordre de la jam.</Typography>
        <List>
          {rowCards.map(({ column, card }) => {
            const participant = card?.type === 'appearance' ? projection.participants[card.participantId] : null;
            const linked = card ? cardLinks(card, projection.links).length > 0 : false;
            return (
              <ListItem key={column.instrument.instrumentId} divider alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemText
                  primary={column.instrument.label}
                  secondary={card ? (card.type === 'hole' ? 'Sans musicien' : participant?.name ?? 'Musicien') : 'Sans card sur ce plateau'}
                />
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                  {linked ? <Chip size="small" label="Lié" color="primary" variant="outlined" /> : null}
                  {card?.locked ? <Chip size="small" label="Verrouillé" color="warning" /> : null}
                  {card?.played ? <Chip size="small" label="Joué" color="success" /> : null}
                  {card?.type === 'appearance' && !card.played ? <Button size="small" variant="outlined" onClick={() => setMissingCard(card)}>Introuvable</Button> : null}
                </Stack>
              </ListItem>
            );
          })}
        </List>

        {missingCard ? (
          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderColor: 'warning.main' }}>
            <Typography fontWeight={900}>Musicien introuvable</Typography>
            <Typography variant="body2" color="text.secondary" mb={1}>Choisis un remplaçant dans la même colonne ou fais sans musicien.</Typography>
            <Stack spacing={1}>
              {replacementCandidates.map((candidate) => {
                const participant = projection.participants[candidate.participantId];
                const linked = cardLinks(candidate, projection.links).length > 0;
                return <Button key={candidate.id} variant="outlined" onClick={() => chooseReplacement(candidate)}>{participant?.name ?? 'Musicien'} · prochain passage{linked ? ' · lié' : ''}</Button>;
              })}
              {replacementCandidates.length === 0 ? <Typography variant="caption" color="text.secondary">Aucun remplaçant disponible dans cette colonne.</Typography> : null}
              <Button color="warning" variant="contained" onClick={chooseWithoutMusician}>Faire sans musicien</Button>
              <Button onClick={() => setMissingCard(null)}>Annuler</Button>
            </Stack>
          </Paper>
        ) : null}
      </Box>
      <Paper elevation={8} sx={{ position: 'sticky', bottom: 0, p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1}>
          <Button fullWidth onClick={close}>Fermer</Button>
          <Button fullWidth variant="contained" startIcon={<CheckCircle />} disabled={targets.length === 0 || alreadyPlayed} onClick={markPlayed}>Plateau joué</Button>
        </Stack>
      </Paper>
    </Drawer>
  );
}

export function JamTable({ projection, clientId, clientSequenceNumber, onTransaction, onOpenCallDrawer, onFeedback, onCreateParticipant, onEditParticipant }) {
  const [openPlateauIndex, setOpenPlateauIndex] = useState(null);
  const [menuState, setMenuState] = useState({ anchorEl: null, card: null });
  const [confirmState, setConfirmState] = useState(null);
  const [linkMode, setLinkMode] = useState({ active: false, anchor: null, selectedIds: new Set() });
  const [conflictMode, setConflictMode] = useState({ active: false, anchor: null, target: null });
  const [playWithoutState, setPlayWithoutState] = useState({ open: false, sourceCard: null, selectedInstrumentIds: [] });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columns = projection?.columns ?? [];
  const jamId = projection?.jam?.jamId;
  if (columns.length === 0) {
    return <Typography color="text.secondary">Aucun participant</Typography>;
  }

  const cardById = new Map(columns.flatMap((column) => column.cards.map((card) => [card.id, { card, column }])));
  const hasCards = columns.some((column) => column.cards.length > 0);
  const maxRows = Math.max(1, ...columns.map((column) => column.cards.length));
  const rows = Array.from({ length: maxRows }, (_, plateauIndex) => ({
    plateauIndex,
    targets: columns.map((column) => targetFor(column.cards[plateauIndex])).filter(Boolean),
  }));

  function dispatch(transaction) {
    if (transaction) onTransaction?.(transaction);
  }

  function slotContext(column, index) {
    const afterCard = column.cards[index - 1] ?? null;
    const beforeCard = column.cards[index] ?? null;
    const appearanceIndex = beforeCard?.appearanceIndex ?? ((afterCard?.appearanceIndex ?? 0) + 1);
    return { afterCard, beforeCard, appearanceIndex };
  }

  function addHole(column, index) {
    dispatch(buildAddHoleTransaction({ jamId, clientId, clientSequenceNumber, instrumentId: column.instrument.instrumentId, ...slotContext(column, index) }));
  }

  function addParticipant(column, index) {
    const context = slotContext(column, index);
    onCreateParticipant?.({ instrumentId: column.instrument.instrumentId, ...context });
  }

  function revealRound(column) {
    dispatch(buildRevealRoundTransaction({ jamId, clientId, clientSequenceNumber, instrumentId: column.instrument.instrumentId, visibleRoundCount: (column.visibleRoundCount ?? 1) + 1 }));
  }

  function latestPlayedPlateauIndex() {
    const playedIndexes = Object.keys(projection.playedPlateaux ?? {}).map(Number);
    return playedIndexes.length > 0 ? Math.max(...playedIndexes) : null;
  }

  function togglePlateauPlayed(plateauIndex, targets, played) {
    if (played) {
      if (latestPlayedPlateauIndex() !== plateauIndex) {
        onFeedback?.('Plateau unplayed impossible : seul le dernier plateau joué peut être annulé');
        return;
      }
      setConfirmState({ kind: 'plateau-unplayed', plateauIndex, targets, title: 'Remettre ce plateau à venir ?', description: 'Seul le dernier plateau joué peut être remis à venir. Les positions des cards seront conservées.', confirmLabel: 'Remettre à venir' });
      return;
    }
    dispatch(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex, targets, played }));
  }

  function toggleLock(card) {
    dispatch(buildToggleLockTransaction({ jamId, clientId, clientSequenceNumber, card }));
  }

  function openMenu(event, card) {
    setMenuState({ anchorEl: event.currentTarget, card });
  }

  function closeMenu() {
    setMenuState({ anchorEl: null, card: null });
  }

  function linkedCount(card) {
    return cardLinks(card, projection.links).length;
  }

  function requestRemoveCard(card) {
    closeMenu();
    setConfirmState({
      kind: 'remove-card',
      card,
      title: card.type === 'hole' ? 'Supprimer ce trou ?' : 'Supprimer ce passage ?',
      description: linkedCount(card) > 0
        ? (card.type === 'hole' ? 'Ce trou est lié à un passage. Le supprimer retirera aussi le link associé, sans supprimer le musicien lié.' : 'Ce passage est lié à un autre passage. Supprimer ce passage supprimera aussi le link associé, sans supprimer l’autre musicien.')
        : (card.type === 'hole' ? 'Le trou sera retiré du tableau.' : 'Ce passage sera retiré du tableau. Le musicien et ses autres passages restent conservés.'),
      confirmLabel: card.type === 'hole' ? 'Supprimer le trou' : 'Supprimer le passage',
    });
  }

  function requestParticipantLeft(card) {
    closeMenu();
    setConfirmState({ kind: 'participant-left', card, title: 'Marquer ce musicien comme parti ?', description: 'Ses passages futurs seront retirés du tableau. Ses passages déjà joués resteront visibles dans l’historique.', confirmLabel: 'Marquer parti' });
  }

  function requestRemoveParticipant(card) {
    closeMenu();
    setConfirmState({ kind: 'remove-participant', card, title: 'Supprimer ce participant ?', description: 'Le participant sera supprimé uniquement s’il n’a jamais joué.', confirmLabel: 'Supprimer participant' });
  }

  function confirmAction() {
    const { kind, card } = confirmState;
    if (kind === 'remove-card') {
      dispatch(buildRemoveCardTransaction({ jamId, clientId, clientSequenceNumber, card, linked: linkedCount(card) > 0 }));
      onFeedback?.(card.type === 'hole' ? 'Trou supprimé' : 'Passage supprimé');
    }
    if (kind === 'participant-left') {
      dispatch(buildParticipantLeftTransaction({ jamId, clientId, clientSequenceNumber, participantId: card.participantId }));
      onFeedback?.('Musicien marqué comme parti');
    }
    if (kind === 'remove-participant') {
      if (participantHasPlayed(projection, card.participantId)) onFeedback?.('Suppression impossible : ce participant a déjà joué');
      else {
        dispatch(buildRemoveParticipantTransaction({ jamId, clientId, clientSequenceNumber, participantId: card.participantId }));
        onFeedback?.('Participant supprimé');
      }
    }
    if (kind === 'plateau-unplayed') {
      dispatch(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex: confirmState.plateauIndex, targets: confirmState.targets, played: true }));
      onFeedback?.('Plateau remis à venir');
    }
    setConfirmState(null);
  }

  function handleDragEnd(event) {
    const active = cardById.get(event.active.id);
    const over = cardById.get(event.over?.id);
    if (!active || !over || active.card.id === over.card.id) return;
    if (active.column.instrument.instrumentId !== over.column.instrument.instrumentId) {
      onFeedback?.('Déplacement horizontal interdit en V0');
      return;
    }
    if (!canDragCard(active.card, projection)) {
      onFeedback?.('Déplacement impossible : passage joué, verrouillé ou en conflit');
      return;
    }
    const linked = linkedCount(active.card) > 0;
    const oldIndex = active.column.cards.findIndex((card) => card.id === active.card.id);
    const newIndex = active.column.cards.findIndex((card) => card.id === over.card.id);
    const reordered = arrayMove(active.column.cards, oldIndex, newIndex);
    const movedIndex = reordered.findIndex((card) => card.id === active.card.id);
    const afterCard = reordered[movedIndex - 1] ?? null;
    const beforeCard = reordered[movedIndex + 1] ?? null;
    dispatch(buildMoveCardTransaction({ jamId, clientId, clientSequenceNumber, card: active.card, instrumentId: active.column.instrument.instrumentId, afterCard, beforeCard, movedLinkedGroup: linked }));
    if (linked) onFeedback?.('Le groupe lié a été déplacé');
  }

  function cardPlateauIndex(card) {
    const entry = cardById.get(card.id);
    return entry ? entry.column.cards.findIndex((candidate) => candidate.id === card.id) : -1;
  }

  function moveForConflictTarget(anchorCard, targetCard) {
    if (cardPlateauIndex(anchorCard) !== cardPlateauIndex(targetCard)) return null;
    if (targetCard.played || targetCard.locked) return { error: 'Conflit impossible : la cible jouée ou verrouillée ne peut pas bouger' };
    const entry = cardById.get(targetCard.id);
    const targetIndex = entry.column.cards.findIndex((card) => card.id === targetCard.id);
    const afterCard = entry.column.cards[targetIndex + 1] ?? null;
    const beforeCard = entry.column.cards[targetIndex + 2] ?? null;
    if (!afterCard) return { error: 'Conflit impossible : aucun slot libre pour déplacer la cible' };
    return { moveTarget: { card: targetCard, afterCard, beforeCard } };
  }

  function selectConflictTarget(card) {
    if (!conflictMode.active) return;
    if (card.type !== 'appearance') {
      onFeedback?.('Conflit impossible : les trous ne sont pas concernés en V0');
      return;
    }
    if (card.id === conflictMode.anchor.id) {
      setConflictMode({ active: false, anchor: null, target: null });
      return;
    }
    if (card.played || card.locked) {
      onFeedback?.('Conflit impossible : passage joué ou verrouillé');
      return;
    }
    setConflictMode((current) => ({ ...current, target: card }));
  }

  function cancelConflictMode() {
    setConflictMode({ active: false, anchor: null, target: null });
  }

  function validateConflictMode(scope) {
    const { anchor, target } = conflictMode;
    if (!anchor || !target) return;
    const existing = activeConflictsBetween(anchor, target, projection.conflicts);
    const move = existing.length > 0 ? null : moveForConflictTarget(anchor, target);
    if (move?.error) {
      onFeedback?.(move.error);
      return;
    }
    const transaction = buildConflictModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard: anchor, targetCard: target, scope, moveTarget: move?.moveTarget ?? null });
    if (transaction) {
      dispatch(transaction);
      if (transaction.events.some((event) => event.type === 'conflict_created')) onFeedback?.(move?.moveTarget ? 'Conflit créé, passage déplacé' : 'Conflit créé');
      if (transaction.events.some((event) => event.type === 'conflict_removed')) onFeedback?.('Conflit supprimé');
    }
    cancelConflictMode();
  }

  function selectCardForLink(card) {
    if (!linkMode.active) {
      if (card.played || card.locked) {
        onFeedback?.('Link impossible : passage joué ou verrouillé');
        return;
      }
      const initialCards = linkModeInitialSelection(card, projection.links, cardById);
      setLinkMode({ active: true, anchor: card, selectedIds: new Set(initialCards.map((selectedCard) => selectedCard.id)) });
      return;
    }
    if (card.id === linkMode.anchor.id) {
      setLinkMode({ active: false, anchor: null, selectedIds: new Set() });
      return;
    }
    if (card.instrumentId === linkMode.anchor.instrumentId) {
      onFeedback?.('Link impossible : choisis une autre colonne');
      return;
    }
    if (card.played || card.locked) {
      onFeedback?.('Link impossible : passage joué ou verrouillé');
      return;
    }
    setLinkMode((current) => {
      const nextIds = new Set(current.selectedIds);
      if (nextIds.has(card.id)) nextIds.delete(card.id);
      else {
        const sameInstrument = [...nextIds].map((id) => cardById.get(id)?.card).find((selectedCard) => selectedCard?.instrumentId === card.instrumentId);
        if (sameInstrument) {
          onFeedback?.('Link impossible : une seule cible par instrument');
          return current;
        }
        nextIds.add(card.id);
      }
      nextIds.add(current.anchor.id);
      return { ...current, selectedIds: nextIds };
    });
  }

  function cancelLinkMode() {
    setLinkMode({ active: false, anchor: null, selectedIds: new Set() });
  }

  function validateLinkMode() {
    const selectedCards = [...linkMode.selectedIds].map((id) => cardById.get(id)?.card).filter(Boolean);
    if (selectedCards.length < 1) return;
    if (selectedCards.some((card) => card.played || card.locked)) {
      onFeedback?.('Link impossible : passage joué ou verrouillé');
      return;
    }
    if (hasContradictoryConflict(selectedCards, projection)) {
      onFeedback?.('Link impossible : ces passages sont en conflit');
      return;
    }
    const transaction = buildLinkModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard: linkMode.anchor, selectedCards });
    if (transaction) {
      dispatch(transaction);
      if (transaction.events.some((event) => event.type === 'link_created')) onFeedback?.(selectedCardsWillMove(selectedCards) ? 'Certains passages ont été déplacés pour respecter le link' : 'Link créé');
      if (!transaction.events.some((event) => event.type === 'link_created')) onFeedback?.('Link supprimé');
    }
    cancelLinkMode();
  }

  function visibleTargetInstrumentsForPlayWithout(sourceCard) {
    return columns.map((column) => column.instrument).filter((instrument) => instrument.instrumentId !== sourceCard?.instrumentId);
  }

  function togglePlayWithoutInstrument(instrumentId) {
    setPlayWithoutState((current) => {
      const selected = new Set(current.selectedInstrumentIds);
      if (selected.has(instrumentId)) selected.delete(instrumentId);
      else selected.add(instrumentId);
      return { ...current, selectedInstrumentIds: [...selected] };
    });
  }

  function openPlayWithout(card) {
    closeMenu();
    const options = visibleTargetInstrumentsForPlayWithout(card);
    setPlayWithoutState({ open: true, sourceCard: card, selectedInstrumentIds: options[0]?.instrumentId ? [options[0].instrumentId] : [] });
  }

  function closePlayWithout() {
    setPlayWithoutState({ open: false, sourceCard: null, selectedInstrumentIds: [] });
  }

  function validatePlayWithout() {
    if (!playWithoutState.sourceCard || playWithoutState.selectedInstrumentIds.length === 0) {
      onFeedback?.('Choisis au moins un instrument');
      return;
    }
    const transaction = buildPlayWithoutTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard: playWithoutState.sourceCard, instrumentIds: playWithoutState.selectedInstrumentIds });
    if (transaction) {
      dispatch(transaction);
      onFeedback?.('Trou ajouté et lié au passage');
    }
    closePlayWithout();
  }

  const menuCard = menuState.card;
  const menuCardHasPlayedParticipant = menuCard?.type === 'appearance' ? participantHasPlayed(projection, menuCard.participantId) : false;

  return (
    <>
      {!hasCards ? <Alert severity="info" sx={{ mb: 2 }}>Aucun participant</Alert> : null}
      {conflictMode.active ? <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderColor: 'error.main', bgcolor: 'action.hover' }}><Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between"><Typography variant="body2" fontWeight={800}>Mode conflict : choisis une appearance cible, sans hole.</Typography><Button size="small" onClick={cancelConflictMode}>Annuler</Button></Stack></Paper> : null}
      {linkMode.active ? <Paper variant="outlined" sx={{ p: 1.25, mb: 2, borderColor: 'primary.main', bgcolor: 'action.hover' }}><Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between"><Typography variant="body2" fontWeight={800}>Mode link : choisis au plus une card par autre instrument.</Typography><Stack direction="row" spacing={1}><Button size="small" onClick={cancelLinkMode}>Annuler</Button><Button size="small" variant="contained" onClick={validateLinkMode}>Valider</Button></Stack></Stack></Paper> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="stretch" sx={{ minHeight: 360, width: 'max-content', pr: 1 }}>
            <PlateauRail rows={rows} projection={projection} onOpenCallDrawer={(plateauIndex) => { setOpenPlateauIndex(plateauIndex); onOpenCallDrawer?.(plateauIndex); }} onTogglePlateauPlayed={togglePlateauPlayed} />
            {columns.map((column) => {
              const counter = projection.countersByInstrument[column.instrument.instrumentId]?.notYetPlayedFirstTime ?? 0;
              return (
                <Box key={column.instrument.instrumentId} sx={{ minWidth: { xs: 236, sm: 272 }, maxWidth: 292, flex: '0 0 auto' }}>
                  <Stack spacing={1} sx={{ height: '100%' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 48 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={900} noWrap>{column.instrument.label}</Typography>
                        <Typography variant="caption" color="text.secondary">Round {column.visibleRoundCount ?? 1} visible</Typography>
                      </Box>
                      <Chip size="small" label={`${counter} à faire passer`} />
                    </Stack>
                    <SortableContext items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
                      <Stack spacing={1}>
                        {Array.from({ length: Math.max(column.cards.length, 1) + 1 }, (_, index) => (
                          <Box key={`${column.instrument.instrumentId}:slot:${index}`}>
                            <InsertionZone label={index === 0 ? 'Début de colonne' : 'Entre les cards'} onAddHole={() => addHole(column, index)} onAddParticipant={() => addParticipant(column, index)} />
                            {column.cards[index] ? <Box mt={1}><SortableProjectedCard card={column.cards[index]} projection={projection} instrument={column.instrument} linkMode={linkMode} conflictMode={conflictMode} onToggleLink={selectCardForLink} onSelectConflict={selectConflictTarget} onToggleLock={toggleLock} onOpenMenu={openMenu} onBlockedDrag={() => onFeedback?.('Déplacement impossible : passage joué, verrouillé ou en conflit')} /></Box> : null}
                            {column.cards[index]?.appearanceIndex !== column.cards[index + 1]?.appearanceIndex && column.cards[index + 1] ? <Divider sx={{ mt: 1 }}><Chip size="small" label={`Round ${column.cards[index + 1].appearanceIndex}`} /></Divider> : null}
                          </Box>
                        ))}
                      </Stack>
                    </SortableContext>
                    <Button size="large" variant="outlined" onClick={() => revealRound(column)}>Afficher le round suivant</Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </DndContext>

      <Menu anchorEl={menuState.anchorEl} open={Boolean(menuState.anchorEl)} onClose={closeMenu}>
        {menuCard?.type === 'appearance' ? <MenuItem onClick={() => { const participantId = menuCard.participantId; closeMenu(); onEditParticipant?.(participantId); }}>Modifier le musicien</MenuItem> : null}
        {menuCard?.type === 'appearance' ? <MenuItem onClick={() => openPlayWithout(menuCard)}>Jouer sans…</MenuItem> : null}
        {menuCard?.type === 'appearance' ? <MenuItem onClick={() => { const anchor = menuCard; closeMenu(); setLinkMode({ active: false, anchor: null, selectedIds: new Set() }); setConflictMode({ active: true, anchor, target: null }); }}>Créer / retirer un conflit</MenuItem> : null}
        <MenuItem onClick={() => requestRemoveCard(menuCard)}>{menuCard?.type === 'hole' ? 'Supprimer le trou' : 'Supprimer ce passage'}</MenuItem>
        {menuCard?.type === 'appearance' ? <MenuItem onClick={() => requestParticipantLeft(menuCard)}>Musicien parti</MenuItem> : null}
        {menuCard?.type === 'appearance' ? <MenuItem disabled={menuCardHasPlayedParticipant} onClick={() => requestRemoveParticipant(menuCard)}>Supprimer participant</MenuItem> : null}
      </Menu>

      <CallDrawer
        open={openPlateauIndex != null}
        plateauIndex={openPlateauIndex}
        projection={projection}
        jamId={jamId}
        clientId={clientId}
        clientSequenceNumber={clientSequenceNumber}
        onClose={() => setOpenPlateauIndex(null)}
        onTransaction={dispatch}
        onFeedback={onFeedback}
      />

      <Dialog open={playWithoutState.open} onClose={closePlayWithout}>
        <DialogTitle>Jouer sans…</DialogTitle>
        <DialogContent>
          <Typography mb={1}>Ajouter un trou lié à ce passage pour chaque instrument sélectionné.</Typography>
          <FormGroup>
            {visibleTargetInstrumentsForPlayWithout(playWithoutState.sourceCard).map((instrument) => (
              <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={playWithoutState.selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => togglePlayWithoutInstrument(instrument.instrumentId)} />} label={instrument.label} />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePlayWithout}>Annuler</Button>
          <Button variant="contained" onClick={validatePlayWithout}>Valider</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(conflictMode.active && conflictMode.target)} onClose={() => setConflictMode((current) => ({ ...current, target: null }))}>
        <DialogTitle>Créer / retirer un conflit</DialogTitle>
        <DialogContent><Typography>Appliquer ce conflit seulement à ce passage ou pour toute la soirée ?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictMode((current) => ({ ...current, target: null }))}>Annuler</Button>
          <Button onClick={() => validateConflictMode('appearance')}>Seulement ce passage</Button>
          <Button variant="contained" onClick={() => validateConflictMode('participation')}>Toute la soirée</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        description={confirmState?.description ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirmer'}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </>
  );
}
