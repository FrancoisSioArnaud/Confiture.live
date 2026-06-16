import { ArrowBack, PersonAdd, Settings, Undo } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Fab, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getJam } from '../../../shared/api/jamsApi';
import { SyncStatusIndicator } from '../../../shared/components/SyncStatusIndicator';
import { useFeedback } from '../../../shared/feedback/FeedbackProvider';
import { jamStore } from '../../jam/jamStore';
import { buildLinearUndoTransaction, getLatestUndoableTransaction } from '../../transactions/buildUndoTransaction';
import { getSyncStatus } from '../../sync/syncStatus';
import { getOrCreateClientId } from '../../sync/clientIdentity';
import { startHeartbeat, stopHeartbeat } from '../../sync/clientSession';
import { ParticipantDrawer } from '../../participants/components/ParticipantDrawer';
import { JamTable } from '../../table/components/JamTable';
import { JamConfigDialog } from '../components/JamConfigDialog';
import { useJamStoreState } from '../hooks/useJamStoreState';

export function JamDetailPage() {
  const { jamId } = useParams();
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const [configOpen, setConfigOpen] = useState(false);
  const { enqueueFeedback } = useFeedback();
  const [participantDrawer, setParticipantDrawer] = useState({ open: false, mode: 'create', participantId: null, insertionContext: null });
  const [sessionState, setSessionState] = useState({ status: 'acquiring', message: null, canTakeover: false, activeClientId: null });
  const clientSequenceRef = useRef(0);
  const projection = useJamStoreState((state) => state.projection);
  const transactions = useJamStoreState((state) => state.transactions);
  const syncStatus = getSyncStatus(jamId);
  const nextClientSequenceNumber = (transactions.at(-1)?.clientSequenceNumber ?? 0) + 1;
  const undoTarget = getLatestUndoableTransaction(transactions);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['jam', jamId], queryFn: () => getJam(jamId, { includeSnapshot: 'true' }) });

  useEffect(() => {
    if (data) jamStore.getState().hydrateFromPayload(jamId, data).catch((error) => enqueueFeedback(`Hydratation locale impossible : ${error?.message ?? 'erreur inconnue'}`, 'warning'));
  }, [data, enqueueFeedback, jamId]);

  useEffect(() => {
    clientSequenceRef.current = Math.max(clientSequenceRef.current, transactions.at(-1)?.clientSequenceNumber ?? 0);
  }, [transactions]);

  useEffect(() => {
    let cancelled = false;
    setSessionState({ status: 'acquiring', message: null, canTakeover: false, activeClientId: null });
    jamStore.getState().acquireSession({ jamId, clientId, deviceLabel: 'Navigateur' })
      .then((session) => {
        if (cancelled) return;
        setSessionState({ status: 'active', message: null, canTakeover: false, activeClientId: null });
        const intervalMs = Math.max(1000, (session?.heartbeatIntervalSeconds ?? 10) * 1000);
        startHeartbeat({ jamId, intervalMs });
      })
      .catch((error) => {
        if (cancelled) return;
        const body = error?.payload?.body ?? error?.data ?? {};
        const locked = error?.status === 423 || error?.response?.status === 423 || body?.error === 'jam_locked_by_other_client';
        setSessionState({
          status: locked ? 'read_only' : 'unavailable',
          message: locked ? 'Cette jam est ouverte ailleurs : lecture seule pour éviter un conflit.' : `Session d’édition indisponible : ${error?.message ?? 'erreur inconnue'}`,
          canTakeover: Boolean(locked && body?.canForceTakeover),
          activeClientId: body?.activeClientId ?? null,
        });
      });
    return () => {
      cancelled = true;
      stopHeartbeat(jamId);
      jamStore.getState().releaseSession({ jamId }).catch(() => null);
    };
  }, [clientId, jamId]);

  if (isLoading) {
    return <Stack alignItems="center" py={6}><CircularProgress /><Typography mt={2}>Chargement de la jam…</Typography></Stack>;
  }
  if (isError) {
    return <Alert severity="warning">Impossible de charger cette jam. {error?.message}</Alert>;
  }

  const jam = projection?.jam ?? data?.jam;
  const canEdit = sessionState.status === 'active';

  async function takeoverEditingSession() {
    setSessionState((current) => ({ ...current, status: 'taking_over', message: 'Reprise du contrôle en cours…' }));
    try {
      const session = await jamStore.getState().takeoverSession({ jamId, clientId, previousClientId: sessionState.activeClientId, deviceLabel: 'Navigateur' });
      setSessionState({ status: 'active', message: null, canTakeover: false, activeClientId: null });
      const intervalMs = Math.max(1000, (session?.heartbeatIntervalSeconds ?? 10) * 1000);
      startHeartbeat({ jamId, intervalMs });
      enqueueFeedback('Contrôle de la jam repris');
    } catch (error) {
      setSessionState({
        status: 'read_only',
        message: `Reprise impossible : ${error?.message ?? 'erreur inconnue'}`,
        canTakeover: true,
        activeClientId: sessionState.activeClientId,
      });
    }
  }

  function withReservedClientSequence(transaction) {
    const nextSequence = Math.max(clientSequenceRef.current + 1, transaction.clientSequenceNumber ?? 1);
    clientSequenceRef.current = nextSequence;
    return {
      ...transaction,
      clientSequenceNumber: nextSequence,
      events: transaction.events.map((event) => ({ ...event, clientSequenceNumber: nextSequence })),
    };
  }

  function applyOrganizerTransaction(transaction) {
    if (!transaction) return null;
    if (!canEdit) {
      enqueueFeedback('Action impossible : cette jam est en lecture seule', 'warning');
      return null;
    }
    return jamStore.getState().applyLocalTransaction(withReservedClientSequence(transaction));
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, position: 'sticky', top: 72, zIndex: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton component={RouterLink} to="/" aria-label="Retour liste jams"><ArrowBack /></IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={900} noWrap>{jam?.name ?? 'Jam'}</Typography>
            <Typography variant="body2" color="text.secondary">{jam?.indicativeDate ?? 'Date à préciser'}</Typography>
          </Box>
          <SyncStatusIndicator status={syncStatus.status} />
          <Tooltip title={undoTarget && canEdit ? 'Annuler la dernière action' : 'Aucune action à annuler'}><span><IconButton aria-label="Undo" disabled={!undoTarget || !canEdit} onClick={() => { const transaction = buildLinearUndoTransaction({ jamId, clientId, clientSequenceNumber: nextClientSequenceNumber, transactions }); if (!transaction) { enqueueFeedback('Undo impossible : aucune action à annuler', 'warning'); return; } applyOrganizerTransaction(transaction); enqueueFeedback('Action annulée'); }}><Undo /></IconButton></span></Tooltip>
          <Tooltip title={canEdit ? 'Configuration' : 'Configuration indisponible en lecture seule'}><span><IconButton aria-label="Configuration" disabled={!canEdit} onClick={() => setConfigOpen(true)}><Settings /></IconButton></span></Tooltip>
        </Stack>
      </Paper>

      {sessionState.message ? (
        <Alert
          severity={sessionState.status === 'read_only' || sessionState.status === 'taking_over' ? 'warning' : 'error'}
          action={sessionState.canTakeover ? <Button color="inherit" size="small" onClick={takeoverEditingSession}>Reprendre le contrôle</Button> : null}
        >
          {sessionState.message}
        </Alert>
      ) : null}

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <JamTable
          projection={projection}
          clientId={clientId}
          clientSequenceNumber={nextClientSequenceNumber}
          onTransaction={applyOrganizerTransaction}
          onOpenCallDrawer={(plateauIndex) => enqueueFeedback(`Appel du plateau ${plateauIndex + 1}`, 'info')}
          onFeedback={(message) => enqueueFeedback(message)}
          onCreateParticipant={(insertionContext) => setParticipantDrawer({ open: true, mode: 'create', participantId: null, insertionContext })}
          onEditParticipant={(participantId) => setParticipantDrawer({ open: true, mode: 'edit', participantId, insertionContext: null })}
        />
      </Paper>

      <Button component={RouterLink} to="/" variant="text">Retour aux jams</Button>

      <JamConfigDialog
        open={configOpen}
        projection={projection}
        clientId={clientId}
        clientSequenceNumber={nextClientSequenceNumber}
        onClose={() => setConfigOpen(false)}
        onTransaction={applyOrganizerTransaction}
        onFeedback={(message) => enqueueFeedback(message)}
      />
      <ParticipantDrawer
        open={participantDrawer.open}
        mode={participantDrawer.mode}
        projection={projection}
        participantId={participantDrawer.participantId}
        insertionContext={participantDrawer.insertionContext}
        clientId={clientId}
        clientSequenceNumber={nextClientSequenceNumber}
        onClose={() => setParticipantDrawer({ open: false, mode: 'create', participantId: null, insertionContext: null })}
        onTransaction={applyOrganizerTransaction}
        onFeedback={(message) => enqueueFeedback(message)}
      />
      <Fab color="primary" aria-label="Ajouter un musicien" disabled={!canEdit} onClick={() => setParticipantDrawer({ open: true, mode: 'create', participantId: null, insertionContext: null })} sx={{ position: 'fixed', right: 24, bottom: 24 }}><PersonAdd /></Fab>
    </Stack>
  );
}
