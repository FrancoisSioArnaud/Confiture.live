import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Stack } from '@mui/material';

export function PlayWithoutDialog({ open, source, projectedState, selectedInstrumentIds, isReadOnly, onToggleInstrument, onCancel, onValidate }) {
  return <Dialog open={open} onClose={onCancel}>
    <DialogTitle>Jouer sans…</DialogTitle>
    <DialogContent>
      <DialogContentText>Choisis les instruments à remplacer par un trou lié à ce passage.</DialogContentText>
      <Stack sx={{ mt: 1 }}>{Object.values(projectedState?.instruments ?? {}).filter((instrument) => instrument.isVisible !== false && instrument.instrumentId !== source?.instrumentId).sort((a, b) => a.order - b.order).map((instrument) => <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => onToggleInstrument(instrument.instrumentId)} />} label={instrument.name} />)}</Stack>
    </DialogContent>
    <DialogActions><Button onClick={onCancel}>Annuler</Button><Button variant="contained" disabled={isReadOnly || selectedInstrumentIds.length === 0} onClick={onValidate}>Valider</Button></DialogActions>
  </Dialog>;
}
