import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Box, ButtonBase, Typography } from "@mui/material";

import { designTokens } from "../../../theme";
import HoleCard from "./HoleCard";
import ParticipantCard from "./ParticipantCard";

export default function JamTableCell({ rowIndex, cell, instrumentName, linkLabel, linkMode, dragItem, isDragImpacted, showColumnEmptyState = false, onCardAction, onInsert, onToggleLinkSelection }) {
  const selectedEntryIds = linkMode?.selectedEntryIds ?? [];
  const selectedHoleIds = linkMode?.selectedHoleIds ?? [];
  const sameInstrumentSelected = linkMode?.selectedInstrumentIds?.includes(cell.instrumentId);
  const isLinkSelected = cell.type === "entry"
    ? selectedEntryIds.includes(cell.entryId)
    : selectedHoleIds.includes(cell.holeId);
  const isLinkDisabled = Boolean(
    linkMode?.active
      && cell.type !== "empty"
      && (cell.isPlayed || cell.isParticipantLeft || (sameInstrumentSelected && !isLinkSelected)),
  );
  const dragDisabled = !dragItem || cell.type !== "entry" || cell.isPlayed || cell.isLoop || cell.isParticipantLeft;
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragItem?.id ?? `disabled:${cell.instrumentId}:${rowIndex}:${cell.entryId ?? cell.holeId ?? "empty"}`,
    data: dragItem,
    disabled: dragDisabled,
  });
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: dragItem ? `drop:${dragItem.id}` : `drop-disabled:${cell.instrumentId}:${rowIndex}:${cell.entryId ?? cell.holeId ?? "empty"}`,
    data: dragItem,
    disabled: !dragItem,
  });
  const setDragNodeRef = (node) => {
    setDraggableNodeRef(node);
    setDroppableNodeRef(node);
  };
  const verticalTransform = transform ? { ...transform, x: 0 } : null;

  const handleAction = (action) => (event) => {
    event.stopPropagation();
    onCardAction(action, cell, event);
  };
  const handleSelect = () => {
    if (linkMode?.active && cell.type !== "empty" && !isLinkDisabled) {
      onToggleLinkSelection(cell);
    }
  };
  const commonActions = {
    isLinkSelected,
    isLinkDisabled,
    isDragImpacted,
    onCheck: handleAction("check"),
    onLink: handleAction("link"),
    onMenu: handleAction("menu"),
    onSelect: handleSelect,
  };

  return (
    <Box
      role="cell"
      sx={{
        minWidth: {
          xs: designTokens.table.instrumentColumnMinWidth,
          sm: designTokens.table.instrumentColumnTabletMinWidth,
        },
        p: `${designTokens.spacing.xs}px`,
      }}
    >
      {cell.type === "entry" ? (
        <Box
          ref={setDragNodeRef}
          {...attributes}
          {...listeners}
          sx={{
            transform: CSS.Translate.toString(verticalTransform),
            opacity: isDragging ? 0.88 : 1,
            touchAction: dragDisabled ? "auto" : "none",
            transition: isDragging ? "none" : `box-shadow ${designTokens.transitions.fast}`,
            boxShadow: isOver && !dragDisabled ? `0 0 0 ${designTokens.card.borderWidth}px ${designTokens.colors.primary}` : "none",
          }}
        >
          <ParticipantCard cell={cell} linkLabel={linkLabel} {...commonActions} />
        </Box>
      ) : null}
      {cell.type === "hole" ? (
        <HoleCard cell={cell} instrumentName={instrumentName} linkLabel={linkLabel} {...commonActions} />
      ) : null}
      {cell.type === "empty" ? (
        <Box
          sx={{
            minHeight: designTokens.card.minHeight,
            borderRadius: `${designTokens.card.radius}px`,
            bgcolor: designTokens.colors.emptyCellBg,
            display: "flex",
            alignItems: "center",
            px: `${designTokens.spacing.sm}px`,
          }}
        >
          {showColumnEmptyState ? (
            <Typography variant="caption" color="text.secondary">Aucun inscrit</Typography>
          ) : null}
        </Box>
      ) : null}
      <ButtonBase
        aria-label={`Ajouter ici ${instrumentName}`}
        onClick={onInsert}
        sx={{
          mt: `${designTokens.spacing.xs}px`,
          width: "100%",
          minHeight: designTokens.spacing.md,
          borderRadius: `${designTokens.card.radius}px`,
          color: designTokens.app.textSecondary,
          opacity: 0.75,
          "&:focus-visible": {
            outline: `${designTokens.card.borderWidth}px solid ${designTokens.colors.primary}`,
          },
        }}
      >
        <AddRoundedIcon fontSize="inherit" />
      </ButtonBase>
    </Box>
  );
}
