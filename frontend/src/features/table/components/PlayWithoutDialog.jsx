import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';

export function PlayWithoutDialog({ open, source, projectedState, selectedInstrumentIds, isReadOnly, onToggleInstrument, onCancel, onValidate }) {
  return <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
    <DialogTitle>Jouer sans…</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5}>
        <DialogContentText>Choisis les instruments à remplacer par un trou lié à ce passage.</DialogContentText>
        <Typography variant="body2" color="text.secondary">À la validation, l’app crée un hole normal puis un link avec cette appearance. Aucun event play_without dédié n’est créé.</Typography>
        <Stack>{Object.values(projectedState?.instruments ?? {}).filter((instrument) => instrument.isVisible !== false && instrument.instrumentId !== source?.instrumentId).sort((a, b) => a.order - b.order).map((instrument) => <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => onToggleInstrument(instrument.instrumentId)} />} label={instrument.name} />)}</Stack>
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onCancel}>Annuler</Button><Button variant="contained" disabled={isReadOnly || selectedInstrumentIds.length === 0} onClick={onValidate}>Créer le trou lié</Button></DialogActions>
  </Dialog>;
}
