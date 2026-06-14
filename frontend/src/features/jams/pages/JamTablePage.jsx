import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Snackbar, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../sync/localDb.js';
import { useJamClientSession } from '../../sync/clientSession.js';
import { recoverJamProjection } from '../services/localJamActions.js';
import { navigate } from '../../../shared/utils/navigation.js';
import { JamConfigDialog } from '../components/JamConfigDialog.jsx';
import { ParticipantDialog } from '../../participants/components/ParticipantDialog.jsx';
import { CallDrawer } from '../../callDrawer/components/CallDrawer.jsx';
import { JamTable } from '../../table/components/JamTable.jsx';
import { TableModeActionBar } from '../../table/components/TableModeActionBar.jsx';
import { PlayWithoutDialog } from '../../table/components/PlayWithoutDialog.jsx';
import { ConflictScopeDialog } from '../../table/components/ConflictScopeDialog.jsx';
import { RemoveTargetDialog } from '../../table/components/RemoveTargetDialog.jsx';
import { useJamTableActions } from '../hooks/useJamTableActions.js';
import { LeaseStatusBanner } from '../components/LeaseStatusBanner.jsx';
import { RecoveryWarning } from '../components/RecoveryWarning.jsx';

export function JamTablePage({ jamId }) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [snackbarQueue, setSnackbarQueue] = useState([]);
  const clientSession = useJamClientSession(jamId);
  const isReadOnly = clientSession.readOnly;
  const { data: syncState } = useQuery({ queryKey: ['syncState', jamId], queryFn: () => db.syncState.get(jamId) });
  const { data: localJam } = useQuery({ queryKey: ['localJam', jamId], queryFn: () => db.localJams.get(jamId) });
  const projectedState = syncState?.projectedState;
  const visibleColumns = useMemo(() => projectedState ? Object.entries(projectedState.columns ?? {}) : [], [projectedState]);

  async function refreshProjection() {
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
  }

  function notify(message, severity = 'success') {
    setSnackbarQueue((current) => [...current, { id: `${Date.now()}_${current.length}`, message, severity }]);
  }

  function closeSnackbar() {
    setSnackbarQueue((current) => current.slice(1));
  }

  const actions = useJamTableActions({ jamId, projectedState, notify, refreshProjection });

  useEffect(() => {
    void recoverJamProjection(jamId).then(() => queryClient.invalidateQueries({ queryKey: ['syncState', jamId] }));
  }, [jamId, queryClient]);

  async function takeoverControl() {
    await clientSession.takeover();
    notify('Contrôle repris sur cette jam.');
  }

  return <Container maxWidth={false} sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1, sm: 3 } }}>
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box>
        <Button onClick={() => navigate('/')}>← Liste</Button>
        <Typography variant="h4">{localJam?.name ?? projectedState?.jam?.name ?? 'Jam'}</Typography>
        <Typography color="text.secondary">{syncState?.status === 'synced' ? 'Synchronisé' : 'Sauvegardé sur cet appareil'}</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button sx={{ minHeight: 40 }} disabled={isReadOnly || !projectedState?.activeTransactionIds?.length} onClick={actions.undoLastTransaction}>Undo</Button>
        <Button sx={{ minHeight: 40 }} disabled={isReadOnly || !projectedState?.playedPlateaus?.length} onClick={actions.markLastPlateauUnplayed}>Dernier plateau non joué</Button>
        <Button sx={{ minHeight: 40 }} variant="outlined" disabled={isReadOnly} onClick={() => actions.setCallDrawerOpen(true)}>Drawer d'appel</Button>
        <Button sx={{ minHeight: 40 }} variant="outlined" disabled={isReadOnly} onClick={() => { setEditingParticipantId(null); setParticipantDialogOpen(true); }}>Ajouter participant</Button>
        <Button sx={{ minHeight: 40 }} variant="outlined" disabled={isReadOnly} onClick={() => setConfigOpen(true)}>Config</Button>
      </Stack>
    </Stack>

    <LeaseStatusBanner clientSession={clientSession} onTakeover={takeoverControl} />
    <RecoveryWarning syncState={syncState} onRetrySync={async () => { await recoverJamProjection(jamId); await refreshProjection(); notify('Synchronisation relancée.'); }} />
    <TableModeActionBar linkMode={actions.linkMode} conflictMode={actions.conflictMode} onValidateLink={actions.validateLinkMode} onCancelLink={() => actions.setLinkMode(null)} onOpenConflictScope={() => actions.setConflictScopeOpen(true)} onCancelConflict={() => actions.setConflictMode(null)} />

    <JamTable projectedState={projectedState} visibleColumns={visibleColumns} isReadOnly={isReadOnly} onRevealNextRound={actions.revealNextRound} onAddHole={actions.addHole} onLockToggle={actions.lockToggle} onRemove={actions.setTargetToRemove} onEditParticipant={(participantId) => { setEditingParticipantId(participantId); setParticipantDialogOpen(true); }} onMove={actions.moveVertically} linkMode={actions.linkMode} onLinkClick={actions.handleLinkClick} onLinkTargetClick={actions.handleLinkTargetClick} conflictMode={actions.conflictMode} onConflictClick={actions.handleConflictClick} onConflictTargetClick={actions.handleConflictTargetClick} onPlayWithout={actions.openPlayWithout} />

    <JamConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} jamId={jamId} localJam={localJam} projectedState={projectedState} />
    <ParticipantDialog open={participantDialogOpen} onClose={() => setParticipantDialogOpen(false)} jamId={jamId} projectedState={projectedState} participantId={editingParticipantId} />
    <CallDrawer open={actions.callDrawerOpen} onClose={() => actions.setCallDrawerOpen(false)} projectedState={projectedState} callPlateauIndex={actions.callPlateauIndex} onCallPlateauIndexChange={actions.setCallPlateauIndex} onWithoutMusician={actions.callDrawerWithoutMusician} onMarkPlayed={actions.markCalledPlateauPlayed} isReadOnly={isReadOnly} />

    <PlayWithoutDialog open={Boolean(actions.playWithoutSource)} source={actions.playWithoutSource} projectedState={projectedState} selectedInstrumentIds={actions.playWithoutInstrumentIds} isReadOnly={isReadOnly} onToggleInstrument={actions.togglePlayWithoutInstrument} onCancel={() => actions.setPlayWithoutSource(null)} onValidate={actions.validatePlayWithout} />
    <ConflictScopeDialog open={actions.conflictScopeOpen} isReadOnly={isReadOnly} onClose={() => actions.setConflictScopeOpen(false)} onCreateConflict={actions.createConflict} />
    <RemoveTargetDialog target={actions.targetToRemove} isReadOnly={isReadOnly} onCancel={() => actions.setTargetToRemove(null)} onRemove={actions.removeTarget} />

    <Snackbar open={snackbarQueue.length > 0} autoHideDuration={3000} onClose={closeSnackbar}><Alert severity={snackbarQueue[0]?.severity ?? 'success'} onClose={closeSnackbar} sx={{ width: '100%' }}>{snackbarQueue[0]?.message}</Alert></Snackbar>
  </Container>;
}
