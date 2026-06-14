import { Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

export function CallDrawer({ open, onClose, projectedState, callPlateauIndex, onCallPlateauIndexChange, onWithoutMusician, onMarkPlayed, isReadOnly }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Drawer d'appel</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Plateau" type="number" value={callPlateauIndex} onChange={(event) => onCallPlateauIndexChange(Number(event.target.value))} inputProps={{ min: 1, max: projectedState?.plateaus?.length ?? 1 }} />
        {Object.entries(projectedState?.plateaus?.[callPlateauIndex - 1]?.cells ?? {}).map(([instrumentId, cell]) => <Card key={instrumentId} variant="outlined">
          <CardContent>
            <Typography variant="h6">{projectedState?.instruments?.[instrumentId]?.name ?? instrumentId}</Typography>
            <Typography>{!cell ? 'Aucun passage' : cell.type === 'hole' ? 'Trou' : projectedState?.participants?.[cell.participantId]?.name}</Typography>
            {cell?.type === 'appearance' ? <Button size="small" disabled={isReadOnly} onClick={() => onWithoutMusician(cell)}>Faire sans musicien</Button> : null}
          </CardContent>
        </Card>)}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Fermer</Button><Button variant="contained" disabled={isReadOnly} onClick={onMarkPlayed}>Plateau joué</Button></DialogActions>
  </Dialog>;
}
