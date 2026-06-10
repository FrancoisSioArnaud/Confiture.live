import { Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import AppDrawer from "../../../shared/components/AppDrawer";
import { designTokens } from "../../../theme";

export default function WantsToPlayWithoutDrawer({ open, cell, columns, onClose, onValidate }) {
  const [instrumentIds, setInstrumentIds] = useState([]);
  const availableColumns = columns.filter((column) => column.instrumentId !== cell?.instrumentId);

  useEffect(() => {
    if (open) {
      setInstrumentIds([]);
    }
  }, [open, cell?.entryId]);

  const handleValidate = () => {
    if (cell?.entryId && instrumentIds.length > 0) {
      onValidate({ entryId: cell.entryId, instrumentIds });
    }
    onClose();
  };

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title="Veux jouer sans…"
      subtitle={cell?.participantName ? `${cell.participantName} veut jouer sans…` : undefined}
      actions={(
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="contained" onClick={handleValidate} disabled={instrumentIds.length === 0}>Valider</Button>
        </>
      )}
    >
      <Stack spacing={`${designTokens.spacing.md}px`}>
        <Typography color="text.secondary">Choisis les instruments à remplacer par des trous liés.</Typography>
        {availableColumns.map((column) => (
          <FormControlLabel
            key={column.instrumentId}
            control={(
              <Checkbox
                checked={instrumentIds.includes(column.instrumentId)}
                onChange={(event) => {
                  setInstrumentIds(event.target.checked
                    ? [...instrumentIds, column.instrumentId]
                    : instrumentIds.filter((instrumentId) => instrumentId !== column.instrumentId));
                }}
              />
            )}
            label={column.name}
          />
        ))}
      </Stack>
    </AppDrawer>
  );
}
