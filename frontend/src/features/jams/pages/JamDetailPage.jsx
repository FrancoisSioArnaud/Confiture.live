import { ArrowBack, PersonAdd, Redo, Settings, Undo } from '@mui/icons-material';
import { Alert, Box, CircularProgress, Fab, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getJam } from '../../../shared/api/jamsApi';
import { SyncStatusIndicator } from '../../../shared/components/SyncStatusIndicator';
import { useFeedback } from '../../../shared/feedback/FeedbackProvider';
import { jamStore } from '../../jam/jamStore';
import { buildLinearRedoTransaction, buildLinearUndoTransaction, getLatestRedoableTransaction, getLatestUndoableTransaction } from '../../transactions/buildUndoTransaction';
import { getNextClientSequenceNumber, getLatestClientSequenceNumber } from '../../sync/clientSequence';
import { useSyncStatus } from '../../sync/syncStatus';
import { getOrCreateClientId } from '../../sync/clientIdentity';
import { ParticipantDrawer } from '../../participants/components/ParticipantDrawer';
import { JamTable } from '../../table/components/JamTable';
import { JamConfigDialog } from '../components/JamConfigDialog';
import { useJamStoreState } from '../hooks/useJamStoreState';

export function JamDetailPage() {
  const { jamId } = useParams();
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const [configOpen, setConfigOpen] = useState(false);
  const { enqueueFeedback } = useFeedback();
  const [participantDrawer, setParticipantDrawer] = useState({ open: false, mode: 'create', participantId: null });
  const [tableInteractionModeActive, setTableInteractionModeActive] = useState(false);
  const clientSequenceRef = useRef(0);
  const projection = useJamStoreState((state) => state.projection);
  const transactions = useJamStoreState((state) => state.transactions);
  const syncStatus = useSyncStatus(jamId);
  const nextClientSequenceNumber = getNextClientSequenceNumber(transactions, clientId);
  const undoTarget = getLatestUndoableTransaction(transactions);
  const redoTarget = getLatestRedoableTransaction(transactions);
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['jam', jamId], queryFn: () => getJam(jamId, { includeSnapshot: 'true' }) });


  useEffect(() => {
    if (data) jamStore.getState().hydrateFromPayload(jamId, data).catch((error) => enqueueFeedback(`Hydratation locale impossible : ${error?.message ?? 'erreur inconnue'}`, 'warning'));
  }, [data, enqueueFeedback, jamId]);

  useEffect(() => {
    clientSequenceRef.current = Math.max(clientSequenceRef.current, getLatestClientSequenceNumber(transactions, clientId));
  }, [clientId, transactions]);


  if (isLoading) {
    return <Stack alignItems="center" py={6}><CircularProgress /><Typography mt={2}>Chargement de la jam…</Typography></Stack>;
  }
  if (isError) {
    return <Alert severity="warning">Impossible de charger cette jam. {error?.message}</Alert>;
  }

  const jam = projection?.jam ?? data?.jam;
  const canEdit = Boolean(projection) && !isLoading && !isError;


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
      enqueueFeedback('Action impossible : la jam n’est pas disponible pour l’édition', 'warning');
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
          <Tooltip title={redoTarget && canEdit ? 'Rétablir la dernière action annulée' : 'Aucune action à rétablir'}><span><IconButton aria-label="Redo" disabled={!redoTarget || !canEdit} onClick={() => { const transaction = buildLinearRedoTransaction({ jamId, clientId, clientSequenceNumber: nextClientSequenceNumber, transactions }); if (!transaction) { enqueueFeedback('Redo impossible : aucune action à rétablir', 'warning'); return; } applyOrganizerTransaction(transaction); enqueueFeedback('Action rétablie'); }}><Redo /></IconButton></span></Tooltip>
          <Tooltip title={canEdit ? 'Configuration' : 'Configuration indisponible'}><span><IconButton aria-label="Configuration" disabled={!canEdit} onClick={() => setConfigOpen(true)}><Settings /></IconButton></span></Tooltip>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <JamTable
          projection={projection}
          clientId={clientId}
          clientSequenceNumber={nextClientSequenceNumber}
          onTransaction={applyOrganizerTransaction}
          onOpenCallDrawer={(plateauIndex) => enqueueFeedback(`Appel du plateau ${plateauIndex + 1}`, 'info')}
          onFeedback={(message) => enqueueFeedback(message)}
          onEditParticipant={(participantId) => setParticipantDrawer({ open: true, mode: 'edit', participantId })}
          onInteractionModeChange={setTableInteractionModeActive}
        />
      </Paper>


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
        clientId={clientId}
        clientSequenceNumber={nextClientSequenceNumber}
        onClose={() => setParticipantDrawer({ open: false, mode: 'create', participantId: null })}
        onTransaction={applyOrganizerTransaction}
        onFeedback={(message) => enqueueFeedback(message)}
      />
      {!tableInteractionModeActive ? <Fab color="primary" aria-label="Ajouter un musicien" disabled={!canEdit} onClick={() => setParticipantDrawer({ open: true, mode: 'create', participantId: null })} sx={{ position: 'fixed', right: 24, bottom: 24 }}><PersonAdd /></Fab> : null}
    </Stack>
  );
}
