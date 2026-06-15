import { memo } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { CardItem } from './CardItem.jsx';

function playedPlateauIndexes(projectedState) {
  return new Set((projectedState?.playedPlateaus ?? []).map((plateau) => plateau.plateauIndex));
}

export const JamTable = memo(function JamTable({
  projectedState,
  visibleColumns,
  isReadOnly,
  onRevealNextRound,
  onAddHole,
  onAddHoleBetween,
  onLockToggle,
  onRemove,
  onEditParticipant,
  onMove,
  onMarkPlateauPlayed,
  onMarkPlateauUnplayed,
  linkMode,
  onLinkClick,
  onLinkTargetClick,
  conflictMode,
  onConflictClick,
  onConflictTargetClick,
  onRemoveConflicts,
  onPlayWithout,
}) {
  if (!projectedState) return <Alert severity="info">Projection locale indisponible.</Alert>;

  const playedIndexes = playedPlateauIndexes(projectedState);
  const lastPlayedIndex = projectedState.playedPlateaus?.at(-1)?.plateauIndex ?? null;

  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '96px 1fr', sm: '120px 1fr' }, gap: { xs: 1, sm: 2 }, alignItems: 'start' }}>
    <Card variant="outlined" sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper' }}>
      <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
        <Typography variant="subtitle2" sx={{ minHeight: 32 }}>Plateaux</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {projectedState.plateaus.map((plateau) => {
            const plateauIndex = plateau.index;
            const isPlayed = playedIndexes.has(plateauIndex);
            return <Box key={plateauIndex} sx={{ minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 1, px: 0.5, bgcolor: isPlayed ? 'action.disabledBackground' : 'transparent', transition: 'background-color 850ms ease, opacity 850ms ease' }}>
              <Typography variant="caption" color="text.secondary">Plateau {plateauIndex}</Typography>
              {isPlayed
                ? <Button size="small" disabled={isReadOnly || lastPlayedIndex !== plateauIndex} onClick={() => onMarkPlateauUnplayed(plateauIndex)} aria-label={`Remettre le plateau ${plateauIndex} à venir`}>Remettre</Button>
                : <Button size="small" disabled={isReadOnly} onClick={() => onMarkPlateauPlayed(plateauIndex)} aria-label={`Marquer le plateau ${plateauIndex} joué`}>Joué</Button>}
            </Box>;
          })}
        </Stack>
      </CardContent>
    </Card>
    <Box role="region" aria-label="Colonnes de la jam" tabIndex={0} sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, outline: 'none', '&:focus-visible': { boxShadow: 3 }, overflowX: 'auto', overflowY: 'hidden', pb: 2, scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y', pr: { xs: 1, sm: 2 } }}>
      {visibleColumns.map(([instrumentId, items]) => <Card key={instrumentId} variant="outlined" sx={{ flex: '0 0 auto', minWidth: { xs: 228, sm: 268 }, maxWidth: { xs: 272, sm: 328 }, scrollSnapAlign: 'start' }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ minHeight: 32 }}>
            <Typography variant="h6">{projectedState.instruments[instrumentId]?.name ?? instrumentId}</Typography>
            <Typography variant="caption">{items.filter((item) => !item.isPlayed && item.type === 'appearance').length} à jouer</Typography>
          </Stack>
          {items.length === 0 ? <Typography color="text.secondary">Aucun participant</Typography> : <Stack spacing={0.75} sx={{ mt: 1 }}>
            <Button size="small" variant="text" disabled={isReadOnly} onClick={() => onAddHoleBetween(instrumentId, null, items[0], 0)} aria-label={`Ajouter un trou au début de ${projectedState.instruments[instrumentId]?.name ?? instrumentId}`}>+ trou ici</Button>
            {items.map((item, index) => <Stack key={item.appearanceId ?? item.holeId} spacing={0.75}>
              <CardItem item={item} projectedState={projectedState} disabled={isReadOnly} onLockToggle={onLockToggle} onRemove={onRemove} onEditParticipant={onEditParticipant} onMove={(movedItem, direction) => onMove(movedItem, direction, items)} linkMode={linkMode} onLinkClick={onLinkClick} onLinkTargetClick={onLinkTargetClick} conflictMode={conflictMode} onConflictClick={onConflictClick} onConflictTargetClick={onConflictTargetClick} onRemoveConflicts={onRemoveConflicts} onPlayWithout={onPlayWithout} />
              <Button size="small" variant="text" disabled={isReadOnly} onClick={() => onAddHoleBetween(instrumentId, item, items[index + 1] ?? null, index + 1)} aria-label={`Ajouter un trou après ${item.type === 'hole' ? 'ce trou' : projectedState.participants[item.participantId]?.name ?? 'ce passage'}`}>+ trou ici</Button>
            </Stack>)}
          </Stack>}
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            <Button size="small" disabled={isReadOnly} onClick={() => onRevealNextRound(instrumentId)} aria-label={`Afficher le round suivant pour ${projectedState.instruments[instrumentId]?.name ?? instrumentId}`}>Afficher le round suivant</Button>
            <Button size="small" disabled={isReadOnly} onClick={() => onAddHole(instrumentId)} aria-label={`Ajouter un trou en fin de ${projectedState.instruments[instrumentId]?.name ?? instrumentId}`}>Ajouter un trou</Button>
          </Stack>
        </CardContent>
      </Card>)}
    </Box>
  </Box>;
});
