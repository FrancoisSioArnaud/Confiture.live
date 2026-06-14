import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { CardItem } from './CardItem.jsx';

export function JamTable({
  projectedState,
  visibleColumns,
  isReadOnly,
  onRevealNextRound,
  onAddHole,
  onLockToggle,
  onRemove,
  onEditParticipant,
  onMove,
  linkMode,
  onLinkClick,
  onLinkTargetClick,
  conflictMode,
  onConflictClick,
  onConflictTargetClick,
  onPlayWithout,
}) {
  if (!projectedState) return <Alert severity="info">Projection locale indisponible.</Alert>;

  return <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, overflowX: 'auto', pb: 2, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}>
    {visibleColumns.map(([instrumentId, items]) => <Card key={instrumentId} variant="outlined" sx={{ minWidth: { xs: 220, sm: 260 }, maxWidth: { xs: 260, sm: 320 }, scrollSnapAlign: 'start' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{projectedState.instruments[instrumentId]?.name ?? instrumentId}</Typography>
          <Typography variant="caption">{items.filter((item) => !item.isPlayed && item.type === 'appearance').length} à jouer</Typography>
        </Stack>
        {items.length === 0 ? <Typography color="text.secondary">Aucun participant</Typography> : <Stack spacing={1} sx={{ mt: 1 }}>
          {items.map((item) => <CardItem key={item.appearanceId ?? item.holeId} item={item} projectedState={projectedState} disabled={isReadOnly} onLockToggle={onLockToggle} onRemove={onRemove} onEditParticipant={onEditParticipant} onMove={(movedItem, direction) => onMove(movedItem, direction, items)} linkMode={linkMode} onLinkClick={onLinkClick} onLinkTargetClick={onLinkTargetClick} conflictMode={conflictMode} onConflictClick={onConflictClick} onConflictTargetClick={onConflictTargetClick} onPlayWithout={onPlayWithout} />)}
        </Stack>}
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          <Button size="small" disabled={isReadOnly} onClick={() => onRevealNextRound(instrumentId)}>Afficher le round suivant</Button>
          <Button size="small" disabled={isReadOnly} onClick={() => onAddHole(instrumentId)}>Ajouter un trou</Button>
        </Stack>
      </CardContent>
    </Card>)}
  </Box>;
}
