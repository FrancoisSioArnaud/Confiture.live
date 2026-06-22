import { Campaign, CheckCircle, Delete, DisabledByDefault, DragHandle as DragHandleIcon, Edit, Link as LinkIcon, Lock, LockOpen, MoreVert, PersonOff } from '@mui/icons-material';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControlLabel, FormGroup, IconButton, List, ListItem, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, SvgIcon, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { colors } from '../../../app/theme';
import {
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
import { activeLinksForCards, buildLinkModeTransaction, contradictoryConflictsForCards, linkModeInitialSelection, selectedCardsWillMove } from '../utils/buildLinkModeTransaction';
import { activeConflictsBetween, buildConflictModeTransaction } from '../utils/buildConflictModeTransaction';
import { buildPlayWithoutTransaction } from '../utils/buildPlayWithoutTransaction';
import { buildSkipWithReplacementTransaction, buildSkipWithoutMusicianTransaction, replacementCandidatePresentation, replacementCandidatesForCallDrawer } from '../utils/buildCallDrawerTransaction';


function SwordsIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M6.92 5H5V3h5v5H8V6.41L6.41 8 9 10.59 7.59 12 5 9.41l-2.29 2.3-1.42-1.42L6.92 5zm10.16 0L15.49 6.59 17.08 8l2.29-2.29 1.42 1.42L18.5 9.42l3.29 3.29-1.42 1.42-3.29-3.3-1.59 1.59L14.08 11l2.59-2.59-1.59-1.59-1.41 1.41-1.42-1.42L16.06 3H21v5h-2V6.41L17.08 5zM3.71 20.29l6.88-6.88 1.41 1.42-6.88 6.88H3v-2.12l.71-.7zm16.58 0 .71.7V23h-2.12L12 16.12l1.41-1.41 6.88 6.88z" />
    </SvgIcon>
  );
}

const TABLE_HEADER_HEIGHT = 48;
const TABLE_ROW_HEIGHT = 96;
const MODE_BAR_Z_INDEX = 1300;

const LINK_SELECTION_BG = 'rgba(250, 204, 21, 0.18)';
const CONFLICT_SELECTION_BG = 'rgba(239, 68, 68, 0.16)';


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


function cardResolvedRow(card) {
  return card?.resolvedRow ?? null;
}

function visualRowsForProjection(projection, columns) {
  const cardRows = columns
    .flatMap((column) => column.cards ?? [])
    .map(cardResolvedRow)
    .filter(Number.isFinite);
  const resolvedRows = (projection?.visibleResolvedRows?.length ? projection.visibleResolvedRows : [...new Set(cardRows)].sort((a, b) => a - b));
  if (resolvedRows.length === 0) {
    const maxRows = Math.max(1, ...columns.map((column) => column.cards?.length ?? 0));
    return Array.from({ length: maxRows }, (_, index) => ({
      visualIndex: index + 1,
      plateauIndex: index,
      resolvedRow: index + 1,
      cells: columns.map((column) => ({ column, card: column.cards?.[index] ?? null })),
    }));
  }
  return resolvedRows.map((resolvedRow, index) => {
    const visualIndex = index + 1;
    return {
      visualIndex,
      plateauIndex: index,
      resolvedRow,
      cells: columns.map((column) => ({
        column,
        card: (column.cards ?? []).find((card) => cardResolvedRow(card) === resolvedRow) ?? null,
      })),
    };
  });
}

function cardsForVisualRow(row) {
  return row.cells.map(({ card }) => card).filter(Boolean);
}

function cardTitle(card, projection) {
  if (card.type === 'hole') return 'Trou';
  return projection.participants[card.participantId]?.name ?? 'Musicien';
}

function DragHandle({ onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  return (
    <Tooltip title={dragDisabled ? 'Déplacement impossible' : 'Déplacer verticalement'}>
      <span>
        <IconButton
          size="small"
          aria-label="Déplacer verticalement"
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, cursor: dragDisabled ? 'not-allowed' : 'grab', mt: 0.25 }}
          onClick={dragDisabled ? onBlockedDrag : undefined}
          {...(!dragDisabled ? dragAttributes : {})}
          {...(!dragDisabled ? dragListeners : {})}
        >
          <DragHandleIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function CardActions({ card, linked, linkModeActive, onToggleLink, onToggleLock, onOpenMenu }) {
  const linkColor = linked || linkModeActive ? colors.state.linked : colors.text.primary;
  const lockColor = card.locked ? colors.state.locked : colors.text.primary;
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ mt: 0.25 }}>
      <Tooltip title={linkModeActive ? 'Sélection link' : linked ? 'Lié' : 'Non lié'}>
        <IconButton size="small" aria-label={linked ? 'Card liée' : 'Card non liée'} onClick={onToggleLink} sx={{ color: linkColor }}>
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={card.locked ? 'Déverrouiller' : 'Verrouiller'}>
        <IconButton size="small" aria-label={card.locked ? 'Déverrouiller' : 'Verrouiller'} onClick={onToggleLock} sx={{ color: lockColor }}>
          {card.locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
        </IconButton>
      </Tooltip>
      <IconButton size="small" aria-label="Menu card" onClick={onOpenMenu}><MoreVert fontSize="small" /></IconButton>
    </Stack>
  );
}

function cardBackground({ played, selectedForLink, selectedForConflict }) {
  if (selectedForLink) return LINK_SELECTION_BG;
  if (selectedForConflict) return CONFLICT_SELECTION_BG;
  if (played) return 'action.hover';
  return 'background.paper';
}

function AppearanceCard({ card, projection, linkModeActive, selectedForLink, selectedForConflict, selectionModeActive, disabledByMode, onToggleLink, onToggleLock, onOpenMenu, onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  const linked = cardLinks(card, projection.links).length > 0;
  const conflicted = cardConflicts(card, projection.conflicts).length > 0;
  return (
    <Card
      variant="outlined"
      data-testid={`appearance-card-${card.id}`}
      sx={{
        width: '100%',
        height: '100%',
        opacity: card.played ? 0.55 : disabledByMode ? 0.42 : 1,
        borderStyle: 'solid',
        borderColor: 'divider',
        bgcolor: cardBackground({ played: card.played, selectedForLink, selectedForConflict }),
        transition: 'opacity 180ms ease, background-color 180ms ease',
      }}
    >
      <CardContent sx={{ p: 1, height: '100%', '&:last-child': { pb: 1 } }}>
        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ height: '100%' }}>
          {!selectionModeActive ? <DragHandle onBlockedDrag={onBlockedDrag} dragListeners={dragListeners} dragAttributes={dragAttributes} dragDisabled={dragDisabled} /> : null}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} noWrap>{cardTitle(card, projection)}</Typography>
              {card.appearanceIndex > 1 ? <Chip size="small" label={`R${card.appearanceIndex}`} sx={{ height: 20 }} /> : null}
              {(selectedForConflict || conflicted) ? <Chip size="small" icon={<SwordsIcon />} label="Conflit" color="error" variant="outlined" sx={{ height: 20 }} /> : null}
              {card.played ? <Chip size="small" label="Joué" color="success" sx={{ height: 20 }} /> : null}
            </Stack>
            {!selectionModeActive ? <CardActions card={card} linked={linked} linkModeActive={linkModeActive} onToggleLink={onToggleLink} onToggleLock={onToggleLock} onOpenMenu={onOpenMenu} /> : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function HoleCard({ card, projection, linkModeActive, selectedForLink, selectionModeActive, disabledByMode, onToggleLink, onToggleLock, onOpenMenu, onBlockedDrag, dragListeners, dragAttributes, dragDisabled }) {
  const linked = cardLinks(card, projection.links).length > 0;
  return (
    <Card
      variant="outlined"
      data-testid={`hole-card-${card.id}`}
      sx={{
        width: '100%',
        height: '100%',
        opacity: card.played ? 0.55 : disabledByMode ? 0.42 : 1,
        borderStyle: 'solid',
        borderColor: 'divider',
        bgcolor: cardBackground({ played: card.played, selectedForLink, selectedForConflict: false }),
        transition: 'opacity 180ms ease, background-color 180ms ease',
      }}
    >
      <CardContent sx={{ p: 1, height: '100%', '&:last-child': { pb: 1 } }}>
        <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ height: '100%' }}>
          {!selectionModeActive ? <DragHandle onBlockedDrag={onBlockedDrag} dragListeners={dragListeners} dragAttributes={dragAttributes} dragDisabled={dragDisabled} /> : null}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography fontWeight={800} noWrap>Trou</Typography>
              {card.appearanceIndex > 1 ? <Chip size="small" label={`R${card.appearanceIndex}`} sx={{ height: 20 }} /> : null}
              {card.played ? <Chip size="small" label="Joué" color="success" sx={{ height: 20 }} /> : null}
            </Stack>
            {!selectionModeActive ? <CardActions card={card} linked={linked} linkModeActive={linkModeActive} onToggleLink={onToggleLink} onToggleLock={onToggleLock} onOpenMenu={onOpenMenu} /> : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SortableProjectedCard({ card, projection, instrument, linkMode, conflictMode, onToggleLink, onSelectConflict, onToggleLock, onOpenMenu, onBlockedDrag }) {
  const selectedForLink = Boolean(linkMode?.selectedIds?.has(card.id));
  const linkColumnHasSelection = Boolean(linkMode?.active && linkMode.selectedInstrumentIds?.has(card.instrumentId));
  const selectableForLink = Boolean(linkMode?.active && !card.played && !card.locked && (!linkColumnHasSelection || selectedForLink));
  const selectedForConflict = Boolean(conflictMode?.selectedIds?.has(card.id));
  const conflictColumnHasSelection = Boolean(conflictMode?.active && conflictMode.selectedInstrumentIds?.has(card.instrumentId));
  const conflictHasTarget = Boolean(conflictMode?.target);
  const selectableForConflict = Boolean(
    conflictMode?.active
    && card.type === 'appearance'
    && !card.played
    && !card.locked
    && (!conflictColumnHasSelection || selectedForConflict)
    && (!conflictHasTarget || selectedForConflict)
  );
  const selectionModeActive = Boolean(linkMode?.active || conflictMode?.active);
  const disabledByMode = Boolean(
    (linkMode?.active && !selectedForLink && !selectableForLink)
    || (conflictMode?.active && !selectedForConflict && !selectableForConflict)
  );
  const dragDisabled = selectionModeActive || !canDragCard(card, projection);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { card, instrumentId: instrument.instrumentId }, disabled: dragDisabled });

  function handleCardClick() {
    if (linkMode?.active) {
      if (selectedForLink || selectableForLink) onToggleLink(card);
      return;
    }
    if (conflictMode?.active) {
      if (selectedForConflict || selectableForConflict) onSelectConflict(card);
    }
  }

  const modeClickable = Boolean((linkMode?.active && (selectedForLink || selectableForLink)) || (conflictMode?.active && (selectedForConflict || selectableForConflict)));
  const modeCursor = selectionModeActive ? (modeClickable ? 'pointer' : 'not-allowed') : 'default';
  const modeLabel = disabledByMode ? 'Carte non sélectionnable dans ce mode' : selectedForLink || selectedForConflict ? 'Désélectionner cette carte' : 'Sélectionner cette carte';

  return (
    <Box
      ref={setNodeRef}
      onClick={selectionModeActive ? handleCardClick : undefined}
      role={selectionModeActive ? 'button' : undefined}
      aria-label={selectionModeActive ? modeLabel : undefined}
      aria-disabled={selectionModeActive && !modeClickable ? 'true' : undefined}
      sx={{
        width: '100%',
        height: '100%',
        transform: transformToCss(transform),
        transition: card.locked ? undefined : transition,
        opacity: isDragging ? 0.7 : 1,
        cursor: modeCursor,
        pointerEvents: selectionModeActive && !modeClickable ? 'auto' : undefined,
      }}
    >
      {card.type === 'hole'
        ? <HoleCard card={card} projection={projection} linkModeActive={linkMode?.active} selectedForLink={selectedForLink} selectionModeActive={selectionModeActive} disabledByMode={disabledByMode} onToggleLink={() => onToggleLink(card)} onToggleLock={() => onToggleLock(card)} onOpenMenu={(event) => onOpenMenu(event, card)} onBlockedDrag={() => onBlockedDrag(card)} dragListeners={listeners} dragAttributes={attributes} dragDisabled={dragDisabled} />
        : <AppearanceCard card={card} projection={projection} linkModeActive={linkMode?.active} selectedForLink={selectedForLink} selectedForConflict={selectedForConflict} selectionModeActive={selectionModeActive} disabledByMode={disabledByMode} onToggleLink={() => onToggleLink(card)} onToggleLock={() => onToggleLock(card)} onOpenMenu={(event) => onOpenMenu(event, card)} onBlockedDrag={() => onBlockedDrag(card)} dragListeners={listeners} dragAttributes={attributes} dragDisabled={dragDisabled} />}
    </Box>
  );
}


function ModeActionBar({ mode, selectedCount, canValidate, onCancel, onValidate }) {
  const isLink = mode === 'link';
  const title = isLink ? 'Mode link' : 'Mode conflict';
  const helper = isLink
    ? 'Sélectionne les cards à lier, une seule par colonne.'
    : 'Sélectionne deux appearances de colonnes différentes.';
  return (
    <Paper
      elevation={10}
      sx={{
        position: 'fixed',
        right: { xs: 16, sm: 24 },
        bottom: { xs: 16, sm: 24 },
        zIndex: MODE_BAR_Z_INDEX,
        p: 1.25,
        minWidth: { xs: 'calc(100vw - 32px)', sm: 360 },
        maxWidth: { xs: 'calc(100vw - 32px)', sm: 440 },
        border: 1,
        borderColor: isLink ? colors.state.linked : colors.state.conflict,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1}>
        <Box>
          <Typography variant="subtitle2" fontWeight={900}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">{helper} {selectedCount ? `${selectedCount} sélectionnée(s).` : ''}</Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="outlined" onClick={onCancel}>Annuler</Button>
          <Button variant="contained" disabled={!canValidate} onClick={onValidate}>Valider</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function PlateauRail({ rows, projection, onOpenCallDrawer, onTogglePlateauPlayed }) {
  return (
    <Box sx={{ minWidth: 132, flex: '0 0 132px', position: { sm: 'sticky' }, left: 0, zIndex: 1, bgcolor: 'background.paper' }}>
      <Stack spacing={0} sx={{ height: '100%' }}>
        <Box sx={{ height: TABLE_HEADER_HEIGHT, display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={900} noWrap>Plateaux</Typography>
        </Box>
        <Stack spacing={1}>
          {rows.map((row) => {
            const targets = cardsForVisualRow(row).map(targetFor).filter(Boolean);
            const played = targets.length > 0 && targets.every((target) => (target.type === 'appearance' ? projection.appearances[target.id]?.played : projection.holes[target.id]?.played));
            return (
              <Box key={row.visualIndex} sx={{ height: TABLE_ROW_HEIGHT, display: 'flex', alignItems: 'stretch' }}>
                <Paper variant="outlined" sx={{ p: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" fontWeight={900}>Plateau {row.visualIndex}</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title={played ? 'Ce plateau est déjà joué.' : 'Appeler ce plateau'}>
                      <span>
                        <IconButton size="small" aria-label="Appeler plateau" color="primary" onClick={() => onOpenCallDrawer?.(row.visualIndex)} disabled={played}>
                          <Campaign fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={played ? 'Plateau joué' : 'Marquer comme joué'}>
                      <span>
                        <IconButton size="small" aria-label={played ? 'Plateau joué' : 'Marquer comme joué'} color={played ? 'success' : 'primary'} onClick={() => onTogglePlateauPlayed(row, targets, played)} disabled={targets.length === 0}>
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              </Box>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}

function CallDrawer({ open, visualIndex, projection, jamId, clientId, clientSequenceNumber, onClose, onTransaction, onFeedback }) {
  const theme = useTheme();
  const isTabletUp = useMediaQuery(theme.breakpoints.up('sm'));
  const [missingCard, setMissingCard] = useState(null);
  const [pendingDelinkAction, setPendingDelinkAction] = useState(null);
  const columns = projection?.columns ?? [];
  const row = visualRowsForProjection(projection, columns).find((candidate) => candidate.visualIndex === visualIndex) ?? null;
  const resolvedRow = row?.resolvedRow ?? visualIndex;
  const rowCards = row?.cells ?? columns.map((column) => ({ column, card: null }));
  const targets = rowCards.map(({ card }) => targetFor(card)).filter(Boolean);
  const alreadyPlayed = targets.length > 0 && targets.every((target) => (target.type === 'appearance' ? projection.appearances[target.id]?.played : projection.holes[target.id]?.played));
  const replacementCandidates = missingCard ? replacementCandidatesForCallDrawer({ projection, sourceCard: missingCard, visualIndex, resolvedRow }) : [];
  const missingCardLinked = missingCard ? cardLinks(missingCard, projection.links).length > 0 : false;
  const missingInstrument = missingCard ? columns.find((column) => column.instrument.instrumentId === missingCard.instrumentId)?.instrument : null;
  const withoutMusicianLabel = `Plateau sans ${missingInstrument?.label ?? 'instrument'}`;
  const readOnlyBecausePlayed = alreadyPlayed;
  const pendingReplacementLinked = pendingDelinkAction?.kind === 'replacement' && cardLinks(pendingDelinkAction.replacementCard, projection.links).length > 0;
  const delinkTitle = pendingReplacementLinked ? 'Délier le remplaçant ?' : 'Délier ce passage ?';
  const delinkDescription = pendingReplacementLinked
    ? 'Ce musicien est lié à un autre passage. Pour le mettre ici, le link sera supprimé.'
    : 'Ce musicien est lié à un autre passage. Pour le repousser ou le remplacer, le link sera supprimé.';
  const delinkConfirmLabel = pendingReplacementLinked ? 'Délier et remplacer' : 'Délier et continuer';

  function close() {
    setMissingCard(null);
    setPendingDelinkAction(null);
    onClose?.();
  }

  function markPlayed() {
    onTransaction?.(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex: visualIndex - 1, visualIndex, playedResolvedRow: resolvedRow, targets, played: false, projection }));
    close();
  }

  function runReplacement(replacementCard, confirmedDelink) {
    if (readOnlyBecausePlayed || missingCard?.locked || missingCard?.played || replacementCard?.locked || replacementCard?.played) {
      onFeedback?.('Impossible de modifier ce passage.');
      return;
    }
    onTransaction?.(buildSkipWithReplacementTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard: missingCard, replacementCard, visualIndex, resolvedRow, confirmedDelink }));
    onFeedback?.('Passage repoussé et remplaçant sélectionné');
    setMissingCard(null);
    setPendingDelinkAction(null);
  }

  function chooseReplacement(replacementCard) {
    const replacementLinked = cardLinks(replacementCard, projection.links).length > 0;
    if (missingCardLinked || replacementLinked) {
      setPendingDelinkAction({ kind: 'replacement', replacementCard });
      return;
    }
    runReplacement(replacementCard, false);
  }

  function runWithoutMusician(confirmedDelink) {
    if (readOnlyBecausePlayed || missingCard?.locked || missingCard?.played) {
      onFeedback?.('Impossible de modifier ce passage.');
      return;
    }
    onTransaction?.(buildSkipWithoutMusicianTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard: missingCard, visualIndex, resolvedRow, confirmedDelink, instrumentLabel: missingInstrument?.label }));
    onFeedback?.(`${withoutMusicianLabel} préparé`);
    setMissingCard(null);
    setPendingDelinkAction(null);
  }

  function chooseWithoutMusician() {
    if (missingCardLinked) {
      setPendingDelinkAction({ kind: 'without' });
      return;
    }
    runWithoutMusician(false);
  }

  function confirmPendingDelinkAction() {
    if (pendingDelinkAction?.kind === 'replacement') runReplacement(pendingDelinkAction.replacementCard, true);
    if (pendingDelinkAction?.kind === 'without') runWithoutMusician(true);
  }

  return (
    <Drawer anchor={isTabletUp ? 'right' : 'bottom'} open={open} onClose={close} PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, height: { xs: '100%', sm: '100%' }, maxWidth: '100%' } }}>
      <Box sx={{ p: 2, pb: 10, height: '100%', overflowY: 'auto' }}>
        <Typography variant="h6" fontWeight={900}>Appel plateau {visualIndex ?? ''}</Typography>
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
                  {card?.type === 'appearance' && !card.played ? (
                    <Tooltip title={card.locked ? 'Ce passage est verrouillé.' : readOnlyBecausePlayed ? 'Ce plateau est déjà joué.' : 'Musicien introuvable'}>
                      <span>
                        <Button size="small" variant="outlined" onClick={() => setMissingCard(card)} disabled={card.locked || readOnlyBecausePlayed}>Introuvable</Button>
                      </span>
                    </Tooltip>
                  ) : null}
                </Stack>
              </ListItem>
            );
          })}
        </List>

        {missingCard ? (
          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderColor: 'warning.main' }}>
            <Typography fontWeight={900}>Musicien introuvable</Typography>
            <Typography variant="body2" color="text.secondary" mb={1}>Choisis un remplaçant dans la même colonne ou prépare un plateau sans cet instrument.</Typography>
            <Stack spacing={1}>
              {replacementCandidates.map((candidate) => {
                const participant = projection.participants[candidate.participantId];
                const presentation = replacementCandidatePresentation({ projection, candidate, sourceCard: missingCard });
                return (
                  <Button key={candidate.id} variant="outlined" onClick={() => chooseReplacement(candidate)}>
                    {participant?.name ?? 'Musicien'} · {presentation.instrumentLabel} · prochain passage · {presentation.roundLabel}
                    {presentation.linked ? ' · lié' : ''}
                    {presentation.alreadyPlayed ? ' · rejoue' : ''}
                    {presentation.willMove ? ' · déplacera ce passage' : ''}
                  </Button>
                );
              })}
              {replacementCandidates.length === 0 ? <Typography variant="caption" color="text.secondary">Aucun remplaçant disponible dans cette colonne.</Typography> : null}
              <Button color="warning" variant="contained" onClick={chooseWithoutMusician}>{withoutMusicianLabel}</Button>
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
      <ConfirmDialog
        open={Boolean(pendingDelinkAction)}
        title={delinkTitle}
        description={delinkDescription}
        confirmLabel={delinkConfirmLabel}
        onCancel={() => setPendingDelinkAction(null)}
        onConfirm={confirmPendingDelinkAction}
      />
    </Drawer>
  );
}

export function JamTable({ projection, clientId, clientSequenceNumber, onTransaction, onOpenCallDrawer, onFeedback, onEditParticipant, onInteractionModeChange }) {
  const [openVisualIndex, setOpenVisualIndex] = useState(null);
  const [menuState, setMenuState] = useState({ anchorEl: null, card: null });
  const [confirmState, setConfirmState] = useState(null);
  const [linkMode, setLinkMode] = useState({ active: false, anchor: null, selectedIds: new Set() });
  const [conflictMode, setConflictMode] = useState({ active: false, anchor: null, target: null });
  const [conflictScopeDialogOpen, setConflictScopeDialogOpen] = useState(false);
  const [playWithoutState, setPlayWithoutState] = useState({ open: false, sourceCard: null, selectedInstrumentIds: [] });
  const [pendingLinkConflictConfirm, setPendingLinkConflictConfirm] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columns = projection?.columns ?? [];
  const jamId = projection?.jam?.jamId;
  const interactionModeActive = Boolean(linkMode.active || conflictMode.active);

  useEffect(() => {
    onInteractionModeChange?.(interactionModeActive);
    return () => onInteractionModeChange?.(false);
  }, [interactionModeActive, onInteractionModeChange]);

  if (columns.length === 0) {
    return (
      <Alert severity="warning">
        Aucun instrument visible dans cette jam. Ajoute ou réactive un instrument dans la configuration pour afficher le tableau.
      </Alert>
    );
  }

  const cardById = new Map(columns.flatMap((column) => column.cards.map((card) => [card.id, { card, column }])));
  const linkSelectedInstrumentIds = new Set([...linkMode.selectedIds].map((id) => cardById.get(id)?.card?.instrumentId).filter(Boolean));
  const conflictSelectedIds = new Set([conflictMode.anchor?.id, conflictMode.target?.id].filter(Boolean));
  const conflictSelectedInstrumentIds = new Set([conflictMode.anchor?.instrumentId, conflictMode.target?.instrumentId].filter(Boolean));
  const presentedLinkMode = linkMode.active ? { ...linkMode, selectedInstrumentIds: linkSelectedInstrumentIds } : linkMode;
  const presentedConflictMode = conflictMode.active ? { ...conflictMode, selectedIds: conflictSelectedIds, selectedInstrumentIds: conflictSelectedInstrumentIds } : conflictMode;
  const hasCards = columns.some((column) => column.cards.length > 0);
  const rows = visualRowsForProjection(projection, columns);

  function dispatch(transaction) {
    if (transaction) onTransaction?.(transaction);
  }

  function revealRound(column) {
    dispatch(buildRevealRoundTransaction({ jamId, clientId, clientSequenceNumber, instrumentId: column.instrument.instrumentId, visibleRoundCount: (column.visibleRoundCount ?? 1) + 1 }));
  }

  function latestPlayedPlateauIndex() {
    const playedIndexes = Object.keys(projection.playedPlateaux ?? {}).map(Number);
    return playedIndexes.length > 0 ? Math.max(...playedIndexes) : null;
  }

  function togglePlateauPlayed(row, targets, played) {
    if (played) {
      if (latestPlayedPlateauIndex() !== row.plateauIndex) {
        onFeedback?.('Plateau unplayed impossible : seul le dernier plateau joué peut être annulé');
        return;
      }
      setConfirmState({ kind: 'plateau-unplayed', row, targets, title: 'Remettre ce plateau à venir ?', description: 'Seul le dernier plateau joué peut être remis à venir. Les positions des cards seront conservées.', confirmLabel: 'Remettre à venir' });
      return;
    }
    dispatch(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex: row.plateauIndex, visualIndex: row.visualIndex, playedResolvedRow: row.resolvedRow, targets, played, projection }));
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
    if (card.locked || card.played) {
      onFeedback?.(card.locked ? 'Suppression impossible : passage verrouillé' : 'Suppression impossible : passage joué');
      return;
    }
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
    setConfirmState({ kind: 'participant-left', card, title: 'Marquer ce musicien comme parti ?', description: 'Ses passages futurs seront retirés du tableau. Ses passages déjà joués resteront visibles dans l’historique.', confirmLabel: 'Marquer comme parti' });
  }

  function requestRemoveParticipant(card) {
    closeMenu();
    if (participantHasPlayed(projection, card.participantId)) {
      onFeedback?.('Ce musicien a déjà joué. Tu peux le marquer comme parti.');
      return;
    }
    setConfirmState({ kind: 'remove-participant', card, title: 'Supprimer ce participant ?', description: 'Le participant n’a encore jamais joué. Il sera retiré de la jam avec ses instruments.', confirmLabel: 'Supprimer participant' });
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
      dispatch(buildRemoveParticipantTransaction({ jamId, clientId, clientSequenceNumber, participantId: card.participantId }));
      onFeedback?.('Participant supprimé');
    }
    if (kind === 'plateau-unplayed') {
      dispatch(buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex: confirmState.row.plateauIndex, visualIndex: confirmState.row.visualIndex, playedResolvedRow: confirmState.row.resolvedRow, targets: confirmState.targets, played: true, projection }));
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
      onFeedback?.('Déplacement impossible : passage joué ou verrouillé');
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

  function selectConflictTarget(card) {
    if (!conflictMode.active) return;
    if (card.type !== 'appearance') {
      onFeedback?.('Conflit impossible : les trous ne sont pas concernés en V0');
      return;
    }
    if (card.played || card.locked) {
      onFeedback?.('Conflit impossible : passage joué ou verrouillé');
      return;
    }
    if (conflictMode.anchor?.id === card.id) {
      setConflictMode((current) => ({ ...current, anchor: null, target: null }));
      setConflictScopeDialogOpen(false);
      return;
    }
    if (conflictMode.target?.id === card.id) {
      setConflictMode((current) => ({ ...current, target: null }));
      setConflictScopeDialogOpen(false);
      return;
    }
    if (!conflictMode.anchor) {
      setConflictMode((current) => ({ ...current, anchor: card, target: null }));
      return;
    }
    if (card.instrumentId === conflictMode.anchor.instrumentId) {
      onFeedback?.('Conflit impossible : choisis une autre colonne');
      return;
    }
    if (conflictMode.target) {
      onFeedback?.('Conflit impossible : désélectionne d’abord la cible actuelle');
      return;
    }
    setConflictMode((current) => ({ ...current, target: card }));
  }

  function cancelConflictMode() {
    setConflictScopeDialogOpen(false);
    setConflictMode({ active: false, anchor: null, target: null });
  }

  function openConflictScopeDialog() {
    if (!conflictMode.anchor || !conflictMode.target) return;
    setConflictScopeDialogOpen(true);
  }

  function validateConflictMode(scope) {
    const { anchor, target } = conflictMode;
    if (!anchor || !target) return;
    const transaction = buildConflictModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard: anchor, targetCard: target, scope });
    if (transaction) {
      dispatch(transaction);
      if (transaction.events.some((event) => event.type === 'conflict_created')) onFeedback?.('Conflit créé');
      if (transaction.events.some((event) => event.type === 'conflict_removed')) onFeedback?.('Conflit supprimé');
    }
    setConflictScopeDialogOpen(false);
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
    if (card.played || card.locked) {
      onFeedback?.('Link impossible : passage joué ou verrouillé');
      return;
    }
    setLinkMode((current) => {
      const nextIds = new Set(current.selectedIds);
      if (nextIds.has(card.id)) {
        nextIds.delete(card.id);
        return { ...current, selectedIds: nextIds };
      }
      const sameInstrument = [...nextIds].map((id) => cardById.get(id)?.card).find((selectedCard) => selectedCard?.instrumentId === card.instrumentId);
      if (sameInstrument) {
        onFeedback?.('Link impossible : une seule cible par instrument');
        return current;
      }
      nextIds.add(card.id);
      const anchorStillSelected = current.anchor && nextIds.has(current.anchor.id);
      return { ...current, anchor: anchorStillSelected ? current.anchor : card, selectedIds: nextIds };
    });
  }

  function cancelLinkMode() {
    setLinkMode({ active: false, anchor: null, selectedIds: new Set() });
  }

  function commitLinkMode(selectedCards, conflictsToRemove = []) {
    const anchorCard = selectedCards.find((card) => card.id === linkMode.anchor?.id) ?? linkMode.anchor ?? selectedCards[0];
    const transaction = buildLinkModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, selectedCards, conflictsToRemove });
    if (transaction) {
      dispatch(transaction);
      const created = transaction.events.some((event) => event.type === 'link_created');
      if (created) onFeedback?.(selectedCardsWillMove(selectedCards) ? 'Certains passages ont été déplacés pour respecter le link' : 'Link créé');
      if (!created) onFeedback?.('Link supprimé');
    }
    setPendingLinkConflictConfirm(null);
    cancelLinkMode();
  }

  function canCommitLinkMode() {
    const selectedCards = [...linkMode.selectedIds].map((id) => cardById.get(id)?.card).filter(Boolean);
    if (selectedCards.length >= 2) return true;
    if (!linkMode.anchor) return false;
    return activeLinksForCards([linkMode.anchor, ...selectedCards], projection.links).length > 0;
  }

  function validateLinkMode() {
    const selectedCards = [...linkMode.selectedIds].map((id) => cardById.get(id)?.card).filter(Boolean);
    const isLinkRemoval = linkMode.anchor && activeLinksForCards([linkMode.anchor, ...selectedCards], projection.links).length > 0;
    if (selectedCards.length < 2 && !isLinkRemoval) {
      onFeedback?.('Sélectionne au moins deux cards à lier');
      return;
    }
    if (selectedCards.some((card) => card.played || card.locked)) {
      onFeedback?.('Link impossible : passage joué ou verrouillé');
      return;
    }
    const contradictoryConflicts = contradictoryConflictsForCards(selectedCards, projection);
    if (contradictoryConflicts.length > 0 && selectedCards.length >= 2) {
      setPendingLinkConflictConfirm({ selectedCards, conflicts: contradictoryConflicts });
      return;
    }
    commitLinkMode(selectedCards);
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

  return (
    <>
      {!hasCards ? <Alert severity="info" sx={{ mb: 2 }}>Aucun participant</Alert> : null}
      {conflictMode.active ? <Alert severity="warning" sx={{ mb: 2 }}>Mode conflict : clique les cards pour sélectionner/désélectionner. Les actions sont en bas à droite.</Alert> : null}
      {linkMode.active ? <Alert severity="info" sx={{ mb: 2 }}>Mode link : clique les cards pour sélectionner/désélectionner, une seule par colonne. Les actions sont en bas à droite.</Alert> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Box sx={{ overflowX: 'auto', pb: 2 }}>
          <Stack direction="row" spacing={1.25} alignItems="stretch" sx={{ minHeight: 360, width: 'max-content', pr: 1 }}>
            <PlateauRail rows={rows} projection={projection} onOpenCallDrawer={(visualIndex) => { setOpenVisualIndex(visualIndex); onOpenCallDrawer?.(visualIndex); }} onTogglePlateauPlayed={togglePlateauPlayed} />
            {columns.map((column) => {
              return (
                <Box key={column.instrument.instrumentId} sx={{ width: { xs: 236, sm: 272 }, flex: '0 0 auto' }}>
                  <Stack spacing={0} sx={{ height: '100%' }}>
                    <Box sx={{ height: TABLE_HEADER_HEIGHT, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={900} noWrap>{column.instrument.label}</Typography>
                    </Box>
                    <SortableContext items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
                      <Stack spacing={1}>
                        {rows.map((row) => {
                          const card = row.cells.find((cell) => cell.column.instrument.instrumentId === column.instrument.instrumentId)?.card ?? null;
                          return (
                            <Box key={`${column.instrument.instrumentId}-${row.visualIndex}`} sx={{ height: TABLE_ROW_HEIGHT, display: 'flex', alignItems: 'stretch', width: '100%' }}>
                              {card ? (
                                <SortableProjectedCard card={card} projection={projection} instrument={column.instrument} linkMode={presentedLinkMode} conflictMode={presentedConflictMode} onToggleLink={selectCardForLink} onSelectConflict={selectConflictTarget} onToggleLock={toggleLock} onOpenMenu={openMenu} onBlockedDrag={() => onFeedback?.('Déplacement impossible : passage joué ou verrouillé')} />
                              ) : (
                                <Paper variant="outlined" data-testid={`empty-cell-${column.instrument.instrumentId}-${row.visualIndex}`} sx={{ width: '100%', height: '100%', borderStyle: 'dashed', bgcolor: 'background.default' }} />
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    </SortableContext>
                    <Box sx={{ pt: 1 }}>
                      <Button size="large" variant="outlined" onClick={() => revealRound(column)}>Afficher le round suivant</Button>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </DndContext>

      {linkMode.active ? (
        <ModeActionBar
          mode="link"
          selectedCount={linkMode.selectedIds.size}
          canValidate={canCommitLinkMode()}
          onCancel={cancelLinkMode}
          onValidate={validateLinkMode}
        />
      ) : null}
      {conflictMode.active ? (
        <ModeActionBar
          mode="conflict"
          selectedCount={conflictSelectedIds.size}
          canValidate={Boolean(conflictMode.anchor && conflictMode.target)}
          onCancel={cancelConflictMode}
          onValidate={openConflictScopeDialog}
        />
      ) : null}

      <Menu anchorEl={menuState.anchorEl} open={Boolean(menuState.anchorEl)} onClose={closeMenu}>
        {menuCard?.type === 'appearance' ? (
          <MenuItem onClick={() => { const participantId = menuCard.participantId; closeMenu(); onEditParticipant?.(participantId); }}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            <ListItemText>Modifier le musicien</ListItemText>
          </MenuItem>
        ) : null}
        {menuCard?.type === 'appearance' ? (
          <MenuItem onClick={() => openPlayWithout(menuCard)}>
            <ListItemIcon><DisabledByDefault fontSize="small" /></ListItemIcon>
            <ListItemText>Jouer sans…</ListItemText>
          </MenuItem>
        ) : null}
        {menuCard?.type === 'appearance' ? (
          <MenuItem onClick={() => { const anchor = menuCard; closeMenu(); setLinkMode({ active: false, anchor: null, selectedIds: new Set() }); setConflictMode({ active: true, anchor, target: null }); }}>
            <ListItemIcon><SwordsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Créer / retirer un conflit</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => requestRemoveCard(menuCard)}>
          <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
          <ListItemText>{menuCard?.type === 'hole' ? 'Supprimer le trou' : 'Supprimer ce passage'}</ListItemText>
        </MenuItem>
        {menuCard?.type === 'appearance' && participantHasPlayed(projection, menuCard.participantId) ? (
          <MenuItem onClick={() => requestParticipantLeft(menuCard)}>
            <ListItemIcon><PersonOff fontSize="small" /></ListItemIcon>
            <ListItemText>Musicien parti</ListItemText>
          </MenuItem>
        ) : null}
        {menuCard?.type === 'appearance' && !participantHasPlayed(projection, menuCard.participantId) ? (
          <MenuItem onClick={() => requestRemoveParticipant(menuCard)}>
            <ListItemIcon><PersonOff fontSize="small" /></ListItemIcon>
            <ListItemText>Supprimer participant</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      <CallDrawer
        open={openVisualIndex != null}
        visualIndex={openVisualIndex}
        projection={projection}
        jamId={jamId}
        clientId={clientId}
        clientSequenceNumber={clientSequenceNumber}
        onClose={() => setOpenVisualIndex(null)}
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

      <Dialog open={Boolean(pendingLinkConflictConfirm)} onClose={() => setPendingLinkConflictConfirm(null)}>
        <DialogTitle>Désactiver le conflit ?</DialogTitle>
        <DialogContent>
          <Typography mb={1}>Ces passages ont déjà un conflit actif.</Typography>
          <Typography>Voulez-vous désactiver ce conflit pour créer le link ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingLinkConflictConfirm(null)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={() => commitLinkMode(pendingLinkConflictConfirm?.selectedCards ?? [], pendingLinkConflictConfirm?.conflicts ?? [])}
          >
            Désactiver le conflit et créer le link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={conflictScopeDialogOpen} onClose={() => setConflictScopeDialogOpen(false)}>
        <DialogTitle>Ce conflit concerne quoi ?</DialogTitle>
        <DialogContent>
          <Typography mb={1}>“Seulement ce passage” bloque uniquement les cards sélectionnées.</Typography>
          <Typography>“Toute la soirée” bloque les participations entre elles pour les prochains rounds.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictScopeDialogOpen(false)}>Annuler</Button>
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
