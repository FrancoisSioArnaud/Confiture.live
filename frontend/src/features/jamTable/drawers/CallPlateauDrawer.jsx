import { Button, Card, CardContent, Stack, Typography } from "@mui/material";

import AppDrawer from "../../../shared/components/AppDrawer";
import { designTokens } from "../../../theme";

function getCellLabel(cell, columnName) {
  if (!cell || cell.type === "empty") {
    return "—";
  }
  if (cell.type === "hole") {
    return `Sans ${columnName.toLowerCase()}`;
  }
  return cell.customInstrumentLabel ? `${cell.participantName} — ${cell.customInstrumentLabel}` : cell.participantName;
}

export default function CallPlateauDrawer({ open, row, columns, onClose, onMarkEntryPlayed, onMarkPlateauPlayed, onUnavailable }) {
  const rowNumber = row ? row.rowIndex + 1 : "";

  const handlePlateauPlayed = () => {
    if (row) {
      onMarkPlateauPlayed({ lineIndex: row.rowIndex });
    }
    onClose();
  };

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title="Appel des musiciens"
      subtitle={`Plateau ${rowNumber}`}
      fullScreenOnMobile
      actions={(
        <>
          <Button onClick={onClose}>Fermer</Button>
          <Button variant="contained" onClick={handlePlateauPlayed}>Plateau joué</Button>
        </>
      )}
    >
      <Stack spacing={`${designTokens.spacing.md}px`}>
        {columns.map((column) => {
          const cell = row?.cells[column.instrumentId];
          return (
            <Card key={column.instrumentId} variant="outlined">
              <CardContent>
                <Stack spacing={`${designTokens.spacing.sm}px`}>
                  <Typography variant="subtitle2" color="text.secondary">{column.name}</Typography>
                  <Typography variant="h2">{getCellLabel(cell, column.name)}</Typography>
                  {cell?.type === "entry" && !cell.isPlayed ? (
                    <Stack direction="row" spacing={`${designTokens.spacing.sm}px`}>
                      <Button variant="outlined" onClick={() => onMarkEntryPlayed({ entryId: cell.entryId })}>
                        A joué
                      </Button>
                      <Button onClick={() => onUnavailable({ rowIndex: row.rowIndex, cell, column })}>
                        N’est pas disponible
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </AppDrawer>
  );
}
