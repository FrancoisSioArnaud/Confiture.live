import { Box } from "@mui/material";

import { designTokens } from "../../../theme";
import { getPlateauGridSx } from "./tableLayoutStyles";
import JamTableActionCell from "./JamTableActionCell";
import JamTableCell from "./JamTableCell";

export default function JamTableRow({ row, columns, linkLabels, linkMode, dragItems, activeDrag, columnHasItems = {}, onCall, onPlateauPlayed, onCardAction, onInsert, onToggleLinkSelection }) {
  return (
    <Box
      role="row"
      sx={{
        ...getPlateauGridSx(columns.length),
        alignItems: "stretch",
        borderBottom: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
      }}
    >
      <JamTableActionCell rowIndex={row.rowIndex} onCall={onCall} onPlateauPlayed={onPlateauPlayed} />
      {columns.map((column) => {
        const cell = row.cells[column.instrumentId];
        const dragItem = cell.type === "entry" ? dragItems[cell.entryId] : null;
        const isDragImpacted = Boolean(
          activeDrag?.linkGroupId
            && cell.linkGroupId
            && activeDrag.linkGroupId === cell.linkGroupId
            && activeDrag.entryId !== cell.entryId,
        );
        return (
          <JamTableCell
            key={column.instrumentId}
            rowIndex={row.rowIndex}
            cell={cell}
            instrumentName={column.name}
            linkLabel={linkLabels[cell.linkGroupId]}
            linkMode={linkMode}
            dragItem={dragItem}
            isDragImpacted={isDragImpacted}
            showColumnEmptyState={row.rowIndex === 0 && !columnHasItems[column.instrumentId]}
            onCardAction={onCardAction}
            onToggleLinkSelection={onToggleLinkSelection}
            onInsert={() => onInsert(row.rowIndex, column)}
          />
        );
      })}
    </Box>
  );
}
