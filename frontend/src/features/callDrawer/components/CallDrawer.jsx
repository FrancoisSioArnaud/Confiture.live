import { Box, Button, Card, CardContent, DialogContentText, Drawer, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';

function participantName(projectedState, cell) {
  if (!cell) return 'Aucun passage';
  if (cell.type === 'hole') return 'Trou';
  return projectedState?.participants?.[cell.participantId]?.name ?? 'Musicien';
}

function replacementSuggestions(projectedState, cell) {
  if (!cell || cell.type !== 'appearance') return [];
  return (projectedState?.columns?.[cell.instrumentId] ?? [])
    .filter((candidate) => candidate.type === 'appearance')
    .filter((candidate) => candidate.appearanceId !== cell.appearanceId)
    .filter((candidate) => !candidate.isPlayed && !candidate.isLocked)
    .slice(0, 3);
}

export function CallDrawer({ open, onClose, projectedState, callPlateauIndex, onCallPlateauIndexChange, onWithoutMusician, onReplaceMusician, onMarkPlayed, isReadOnly }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const plateau = projectedState?.plateaus?.[callPlateauIndex - 1];

  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: fullScreen ? '100%' : 560, maxWidth: '100%', height: '100dvh' } }}>
    <Box role="dialog" aria-modal="true" tabIndex={-1} aria-label="Drawer d'appel" sx={{ p: { xs: 2, sm: 3 }, minHeight: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Stack spacing={2} sx={{ flex: 1 }}>
        <Box>
          <Typography variant="h5">Drawer d'appel</Typography>
          <Typography color="text.secondary">Appelle le plateau, remplace un musicien introuvable ou fais sans musicien.</Typography>
        </Box>
        <TextField label="Plateau" type="number" value={callPlateauIndex} onChange={(event) => onCallPlateauIndexChange(Number(event.target.value))} inputProps={{ min: 1, max: projectedState?.plateaus?.length ?? 1 }} />
        {Object.entries(plateau?.cells ?? {}).map(([instrumentId, cell]) => {
          const suggestions = replacementSuggestions(projectedState, cell);
          return <Card key={instrumentId} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="h6">{projectedState?.instruments?.[instrumentId]?.name ?? instrumentId}</Typography>
                  <Typography>{participantName(projectedState, cell)}</Typography>
                  {cell?.isLinked ? <Typography variant="caption" color="text.secondary">Ce passage est lié : une confirmation de delink sera demandée avant remplacement.</Typography> : null}
                </Box>
                {cell?.type === 'appearance' ? <Stack spacing={1}>
                  <Button size="small" variant="outlined" disabled={isReadOnly} onClick={() => onWithoutMusician(cell)}>Faire sans musicien</Button>
                  <DialogContentText>Suggestions de remplacement</DialogContentText>
                  {suggestions.length === 0 ? <Typography variant="body2" color="text.secondary">Aucune suggestion disponible.</Typography> : suggestions.map((candidate) => <Button key={candidate.appearanceId} size="small" disabled={isReadOnly} onClick={() => onReplaceMusician(cell, candidate)}>{participantName(projectedState, candidate)}</Button>)}
                </Stack> : null}
              </Stack>
            </CardContent>
          </Card>;
        })}
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', pt: 2, mt: 2 }}>
        <Button onClick={onClose}>Fermer</Button>
        <Button variant="contained" disabled={isReadOnly || !plateau} onClick={onMarkPlayed}>Plateau joué</Button>
      </Stack>
    </Box>
  </Drawer>;
}
