import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Fab, Menu, MenuItem, Snackbar, Stack, Typography } from "@mui/material";

import { designTokens } from "../../../theme";
import ParticipantFormDrawer from "../../participants/components/ParticipantFormDrawer";
import CallPlateauDrawer from "../drawers/CallPlateauDrawer";
import InsertBetweenCardsDialog from "../drawers/InsertBetweenCardsDialog";
import UnavailableReplacementDrawer from "../drawers/UnavailableReplacementDrawer";
import WantsToPlayWithoutDrawer from "../drawers/WantsToPlayWithoutDrawer";
import { buildDragItems, getVerticalMovePayload, restrictDragToVerticalAxis } from "./dragUtils";
import JamTableHeader from "./JamTableHeader";
import JamTableRow from "./JamTableRow";

const LINK_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildLinkLabels(rows) {
  const groupIds = [...new Set(
    rows.flatMap((row) => Object.values(row.cells).map((cell) => cell.linkGroupId)).filter(Boolean),
  )].sort();

  return Object.fromEntries(groupIds.map((groupId, index) => [groupId, LINK_LABELS[index] ?? `${index + 1}`]));
}

function getSelectedInstrumentIds(rows, linkMode) {
  if (!linkMode.active) {
    return [];
  }

  return rows
    .flatMap((row) => Object.values(row.cells))
    .filter((cell) => (
      (cell.type === "entry" && linkMode.selectedEntryIds.includes(cell.entryId))
      || (cell.type === "hole" && linkMode.selectedHoleIds.includes(cell.holeId))
    ))
    .map((cell) => cell.instrumentId);
}

export default function JamTable({
  jamState,
  projection,
  drawerOpen,
  insertionSelection,
  linkMode,
  onOpenCallDrawer,
  onCloseDrawer,
  onOpenParticipantDrawer,
  onOpenParticipantEditDrawer,
  onOpenWantsToPlayWithoutDrawer,
  onOpenUnavailableReplacementDrawer,
  onSetInsertionSelection,
  onClearInsertionSelection,
  onAddParticipant,
  onUpdateParticipant,
  onAddParticipantEntry,
  onUpdateParticipantEntry,
  onAddHole,
  onRemoveHole,
  onMarkEntryPlayed,
  onMarkPlateauPlayed,
  onUndoEntryPlayed,
  onMarkParticipantLeft,
  onWantsToPlayWithout,
  onReplaceUnavailable,
  onMoveEntryVertical,
  onStartLinkMode,
  onToggleLinkSelection,
  onCancelLinkMode,
  onValidateLinkMode,
  onLinkItems,
}) {
  const [message, setMessage] = useState(null);
  const [menuState, setMenuState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }));
  const linkLabels = useMemo(() => buildLinkLabels(projection.rows), [projection.rows]);
  const linkModeForCells = useMemo(() => ({
    ...linkMode,
    selectedInstrumentIds: getSelectedInstrumentIds(projection.rows, linkMode),
  }), [linkMode, projection.rows]);
  const dragItems = useMemo(() => buildDragItems(projection), [projection]);
  const callRow = drawerOpen?.type === "call"
    ? projection.rows.find((row) => row.rowIndex === drawerOpen.rowIndex)
    : null;
  const hasAnyTableItem = jamState.entries.length > 0 || jamState.holes.length > 0;
  const columnHasItems = useMemo(() => Object.fromEntries(
    projection.columns.map((column) => [
      column.instrumentId,
      projection.rows.some((row) => row.cells[column.instrumentId]?.type !== "empty"),
    ]),
  ), [projection.columns, projection.rows]);


  const handleDragStart = ({ active }) => {
    setActiveDrag(active.data.current ?? null);
  };

  const handleDragEnd = ({ active, over }) => {
    const movePayload = getVerticalMovePayload(active.data.current, over?.data.current);
    setActiveDrag(null);

    if (movePayload) {
      onMoveEntryVertical(movePayload);
      setMessage("Ordre mis à jour");
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  const handlePlateauPlayed = (rowIndex) => {
    onMarkPlateauPlayed({ lineIndex: rowIndex });
    setMessage(`Plateau ${rowIndex + 1} joué`);
  };

  const handleCardAction = (action, cell, event) => {
    if (action === "check" && cell.type === "entry") {
      if (cell.isPlayed) {
        setConfirmState({ type: "undoEntry", cell });
      } else {
        onMarkEntryPlayed({ entryId: cell.entryId });
        setMessage(`${cell.participantName} a joué`);
      }
      return;
    }

    if (action === "link" && cell.type !== "empty") {
      if (linkMode.active) {
        onToggleLinkSelection(cell);
      } else {
        onStartLinkMode(cell);
      }
      return;
    }

    if (action === "menu") {
      setMenuState({ anchorEl: event.currentTarget, cell });
    }
  };

  const handleMenuClose = () => setMenuState(null);

  const handleMenuAction = (action) => {
    const cell = menuState?.cell;
    if (!cell) {
      return;
    }

    if (action === "left") {
      setConfirmState({ type: "left", cell });
    }

    if (action === "without") {
      onOpenWantsToPlayWithoutDrawer(cell);
    }

    if (action === "undo") {
      setConfirmState({ type: "undoEntry", cell });
    }

    if (action === "deleteHole") {
      setConfirmState({ type: "deleteHole", cell });
    }

    if (action === "edit") {
      onOpenParticipantEditDrawer(cell);
    }

    handleMenuClose();
  };

  const handleConfirm = () => {
    const cell = confirmState?.cell;
    if (!cell) {
      return;
    }

    if (confirmState.type === "undoEntry") {
      onUndoEntryPlayed({ entryId: cell.entryId });
      setMessage(`Passage annulé pour ${cell.participantName}`);
    }

    if (confirmState.type === "left") {
      onMarkParticipantLeft(cell.participantId);
      setMessage(`${cell.participantName} marqué comme parti`);
    }

    if (confirmState.type === "deleteHole") {
      onRemoveHole({ holeId: cell.holeId });
      setMessage("Trou supprimé");
    }

    setConfirmState(null);
  };

  const handleAddHole = () => {
    if (!insertionSelection) {
      return;
    }

    onAddHole({
      instrumentId: insertionSelection.column.instrumentId,
      position: insertionSelection.rowIndex,
    });
    onClearInsertionSelection();
    setMessage(`Trou ajouté en ${insertionSelection.column.name}`);
  };

  const handleOpenParticipantDrawer = () => {
    if (!insertionSelection) {
      return;
    }

    onOpenParticipantDrawer(insertionSelection);
    onClearInsertionSelection();
  };

  const handleUnavailable = (target) => {
    onCloseDrawer();
    onOpenUnavailableReplacementDrawer(target);
  };

  const confirmTitle = confirmState?.type === "left"
    ? `Marquer ${confirmState.cell.participantName} comme parti ?`
    : confirmState?.type === "deleteHole"
      ? "Supprimer ce trou ?"
      : "Annuler le passage ?";
  const confirmText = confirmState?.type === "left"
    ? "Il disparaîtra des prochains passages, mais ses passages déjà joués resteront dans l’historique."
    : confirmState?.type === "deleteHole"
      ? "Le trou volontaire sera retiré s’il n’a pas déjà été joué."
      : "Le musicien sera remis comme non joué à cette position.";
  const confirmActionLabel = confirmState?.type === "left"
    ? "Marquer comme parti"
    : confirmState?.type === "deleteHole"
      ? "Supprimer le trou"
      : "Annuler le passage";

  return (
    <>
      <DndContext
        sensors={sensors}
        modifiers={[restrictDragToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <Box
          role="table"
          aria-label="Tableau de jam"
          sx={{
            maxHeight: designTokens.table.maxViewportHeight,
            overflow: "auto",
            border: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
            borderRadius: `${designTokens.card.radius}px`,
            bgcolor: designTokens.app.background,
            scrollBehavior: "smooth",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Box sx={{ minWidth: "max-content" }}>
            <JamTableHeader columns={projection.columns} />
            {!hasAnyTableItem ? (
              <Box
                role="row"
                sx={{
                  display: "grid",
                  gridTemplateColumns: `${designTokens.table.actionColumnWidth}px minmax(0, 1fr)`,
                  borderBottom: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
                }}
              >
                <Box
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: designTokens.zIndex.stickyActionColumn,
                    width: designTokens.table.actionColumnWidth,
                    minWidth: designTokens.table.actionColumnWidth,
                    bgcolor: designTokens.app.background,
                    borderRight: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
                  }}
                />
                <Card
                  variant="outlined"
                  sx={{
                    m: `${designTokens.spacing.sm}px`,
                    minWidth: {
                      xs: designTokens.table.instrumentColumnMinWidth * Math.max(projection.columns.length, 2),
                      sm: designTokens.table.instrumentColumnTabletMinWidth * Math.max(projection.columns.length, 2),
                    },
                    bgcolor: designTokens.app.surface,
                  }}
                >
                  <CardContent>
                    <Stack spacing={`${designTokens.spacing.xs}px`}>
                      <Typography variant="h2">Aucun participant pour l’instant.</Typography>
                      <Typography color="text.secondary">Ajoute un participant pour préparer le premier plateau.</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            ) : projection.rows.map((row) => (
              <JamTableRow
                key={row.rowIndex}
                row={row}
                columns={projection.columns}
                linkLabels={linkLabels}
                linkMode={linkModeForCells}
                dragItems={dragItems}
                activeDrag={activeDrag}
                columnHasItems={columnHasItems}
                onCall={onOpenCallDrawer}
                onPlateauPlayed={handlePlateauPlayed}
                onCardAction={handleCardAction}
                onToggleLinkSelection={onToggleLinkSelection}
                onInsert={(rowIndex, column) => onSetInsertionSelection({ rowIndex, column })}
              />
            ))}
          </Box>
        </Box>
      </DndContext>

      <CallPlateauDrawer
        open={drawerOpen?.type === "call"}
        row={callRow}
        columns={projection.columns}
        onClose={onCloseDrawer}
        onMarkEntryPlayed={onMarkEntryPlayed}
        onMarkPlateauPlayed={onMarkPlateauPlayed}
        onUnavailable={handleUnavailable}
      />

      <ParticipantFormDrawer
        open={drawerOpen?.type === "participant"}
        onClose={onCloseDrawer}
        jamState={jamState}
        insertionSelection={drawerOpen?.selection}
        participant={drawerOpen?.participantId ? jamState.participants.find((participant) => participant.id === drawerOpen.participantId) : null}
        onAddParticipant={onAddParticipant}
        onUpdateParticipant={onUpdateParticipant}
        onAddParticipantEntry={onAddParticipantEntry}
        onUpdateParticipantEntry={onUpdateParticipantEntry}
        onLinkItems={onLinkItems}
      />

      <UnavailableReplacementDrawer
        open={drawerOpen?.type === "unavailableReplacement"}
        target={drawerOpen?.type === "unavailableReplacement" ? drawerOpen : null}
        projection={projection}
        linkLabels={linkLabels}
        onClose={onCloseDrawer}
        onReplaceUnavailable={onReplaceUnavailable}
      />

      <WantsToPlayWithoutDrawer
        open={drawerOpen?.type === "wantsWithout"}
        cell={drawerOpen?.cell}
        columns={projection.columns}
        onClose={onCloseDrawer}
        onValidate={(payload) => {
          onWantsToPlayWithout(payload);
          setMessage("Trous liés ajoutés");
        }}
      />

      <InsertBetweenCardsDialog
        open={Boolean(insertionSelection)}
        selection={insertionSelection}
        onClose={onClearInsertionSelection}
        onAddParticipant={handleOpenParticipantDrawer}
        onAddHole={handleAddHole}
      />

      <Menu anchorEl={menuState?.anchorEl ?? null} open={Boolean(menuState)} onClose={handleMenuClose}>
        <MenuItem onClick={() => handleMenuAction("edit")} disabled={!menuState?.cell?.participantId}>Modifier</MenuItem>
        <MenuItem onClick={() => handleMenuAction("left")} disabled={!menuState?.cell?.participantId || menuState?.cell?.isParticipantLeft}>
          Marquer comme parti
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("without")} disabled={menuState?.cell?.type !== "entry" || menuState?.cell?.isPlayed}>
          Veux jouer sans…
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("undo")} disabled={!menuState?.cell?.isPlayed || menuState?.cell?.type !== "entry"}>
          Annuler le passage
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction("deleteHole")} disabled={menuState?.cell?.type !== "hole" || menuState?.cell?.isPlayed}>
          Supprimer le trou
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(confirmState)} onClose={() => setConfirmState(null)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">{confirmText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmState(null)}>Annuler</Button>
          <Button variant="contained" onClick={handleConfirm}>{confirmActionLabel}</Button>
        </DialogActions>
      </Dialog>

      {linkMode.active ? (
        <Stack
          direction="row"
          spacing={`${designTokens.spacing.sm}px`}
          alignItems="center"
          justifyContent="flex-end"
          sx={{
            position: "sticky",
            bottom: 0,
            zIndex: designTokens.zIndex.bottomActionBar,
            mt: `${designTokens.spacing.sm}px`,
            p: `${designTokens.spacing.sm}px`,
            borderRadius: `${designTokens.card.radius}px`,
            bgcolor: designTokens.app.surface,
            border: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
            Mode link · {linkMode.selectedEntryIds.length + linkMode.selectedHoleIds.length} sélection
          </Typography>
          <Button onClick={onCancelLinkMode}>Annuler</Button>
          <Button variant="contained" onClick={onValidateLinkMode}>Valider</Button>
        </Stack>
      ) : null}

      {!drawerOpen && !insertionSelection && !confirmState && !linkMode.active ? (
        <Fab
          color="primary"
          aria-label="Ajouter un participant"
          onClick={() => onOpenParticipantDrawer(null)}
          sx={{
            position: "fixed",
            right: {
              xs: `${designTokens.spacing.lg}px`,
              sm: `${designTokens.spacing.xl}px`,
            },
            bottom: {
              xs: `calc(${designTokens.spacing.lg}px + env(safe-area-inset-bottom))`,
              sm: `${designTokens.spacing.xl}px`,
            },
            zIndex: (theme) => theme.zIndex.drawer - 1,
          }}
        >
          <PersonAddIcon />
        </Fab>
      ) : null}

      <Snackbar open={Boolean(message)} autoHideDuration={2500} onClose={() => setMessage(null)}>
        <Alert severity="info" variant="filled" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
