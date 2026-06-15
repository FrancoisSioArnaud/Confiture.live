import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, DialogContentText, Divider, Drawer, FormControlLabel, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { persistLocalAction } from '../../jams/services/localJamActions.js';
import { useConfirmDialog, useSnackbar } from '../../../shared/feedback/index.js';

function participationsFor(projectedState, participantId) {
  return Object.values(projectedState?.participations ?? {}).filter((participation) => participation.participantId === participantId && !participation.removed);
}

function visibleInstrumentsFor(projectedState) {
  return Object.values(projectedState?.instruments ?? {}).filter((instrument) => instrument.isVisible !== false).sort((a, b) => a.order - b.order);
}

function participationHasSensitiveImpacts(projectedState, participation) {
  const appearances = Object.values(projectedState?.appearances ?? {}).filter((appearance) => appearance.participationId === participation.participationId && !appearance.removed);
  const appearanceIds = new Set(appearances.map((appearance) => appearance.appearanceId));
  const links = Object.values(projectedState?.links ?? {}).filter((link) => !link.removed && (link.targets ?? []).some((target) => appearanceIds.has(target.id ?? target.targetId)));
  const locks = Object.values(projectedState?.locks ?? {}).filter((lock) => !lock.removed && lock.targetType === 'appearance' && appearanceIds.has(lock.targetId));
  return { appearances: appearances.length, links: links.length, locks: locks.length, hasImpacts: appearances.length + links.length + locks.length > 0 };
}

export function ParticipantDrawer({ open, onClose, jamId, projectedState, participantId = null }) {
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const { showSnackbar } = useSnackbar();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const participant = participantId ? projectedState?.participants?.[participantId] : null;
  const existingParticipations = participationsFor(projectedState, participantId);
  const visibleInstruments = visibleInstrumentsFor(projectedState);
  const [name, setName] = useState(participant?.name ?? '');
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(existingParticipations.map((participation) => participation.instrumentId));
  const [otherDetail, setOtherDetail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(participant?.name ?? '');
    setSelectedInstrumentIds(existingParticipations.map((participation) => participation.instrumentId));
    setOtherDetail('');
    setError('');
  }, [open, participantId, projectedState]);

  function toggleInstrument(instrumentId) {
    setSelectedInstrumentIds((current) => current.includes(instrumentId) ? current.filter((id) => id !== instrumentId) : [...current, instrumentId]);
  }

  async function confirmRemovedParticipations(removedParticipations) {
    if (removedParticipations.length === 0) return true;
    const impacted = removedParticipations.map((participation) => participationHasSensitiveImpacts(projectedState, participation)).filter((impact) => impact.hasImpacts);
    return confirm({
      title: 'Retirer cet instrument ?',
      description: impacted.length > 0
        ? 'Des passages, links ou verrous existent pour cet instrument. Le retrait crée un event de participation_removed et conserve l’historique déjà joué.'
        : 'Cet instrument sera retiré du musicien pour les prochains passages.',
      confirmLabel: 'Retirer l’instrument',
      confirmColor: 'error',
    });
  }

  async function saveParticipant() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom est requis.');
      return;
    }
    if (selectedInstrumentIds.length === 0) {
      setError('Sélectionne au moins un instrument.');
      return;
    }
    const duplicate = Object.values(projectedState?.participants ?? {}).some((candidate) => candidate.participantId !== participantId && !candidate.removed && candidate.name === trimmedName);
    if (duplicate) {
      setError('Un participant avec ce nom existe déjà.');
      return;
    }

    const removedParticipations = existingParticipations.filter((participation) => !selectedInstrumentIds.includes(participation.instrumentId));
    const confirmedRemoval = await confirmRemovedParticipations(removedParticipations);
    if (!confirmedRemoval) return;

    const events = [];
    const effectiveParticipantId = participantId ?? `participant_${Date.now()}`;
    if (participantId) {
      events.push({ type: 'participant_updated', payload: { participantId, name: trimmedName } });
    } else {
      events.push({ type: 'participant_created', payload: { participantId: effectiveParticipantId, name: trimmedName } });
    }

    const existingByInstrument = new Map(existingParticipations.map((participation) => [participation.instrumentId, participation]));
    const createdParticipationIds = [];
    for (const instrumentId of selectedInstrumentIds) {
      if (existingByInstrument.has(instrumentId)) continue;
      const instrument = projectedState.instruments[instrumentId];
      const participationId = `participation_${effectiveParticipantId}_${instrumentId}_${Date.now()}`;
      createdParticipationIds.push(participationId);
      events.push({ type: 'participation_added', payload: { participationId, participantId: effectiveParticipantId, instrumentId, customInstrumentLabel: instrument?.name === 'Autre' ? otherDetail || null : null, baseOrderKey: String(Date.now() + createdParticipationIds.length) } });
    }
    for (const participation of removedParticipations) {
      events.push({ type: 'participation_removed', payload: { participationId: participation.participationId, confirmedDespiteLinksOrLocks: true } });
    }

    const activeParticipationIds = [...existingParticipations.filter((participation) => selectedInstrumentIds.includes(participation.instrumentId)).map((participation) => participation.participationId), ...createdParticipationIds];
    for (let index = 0; index < activeParticipationIds.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < activeParticipationIds.length; otherIndex += 1) {
        events.push({ type: 'conflict_created', payload: { conflictId: `conflict_${effectiveParticipantId}_${index}_${otherIndex}_${Date.now()}`, scope: 'participation', targetIds: [activeParticipationIds[index], activeParticipationIds[otherIndex]], reason: 'instrument_constraint', anchorTargetId: activeParticipationIds[index] } });
      }
    }

    await persistLocalAction({ jamId, label: participantId ? 'Modifier participant' : 'Créer participant', events });
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
    showSnackbar(participantId ? 'Musicien mis à jour' : 'Musicien ajouté');
    onClose();
  }

  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: fullScreen ? '100%' : 440, maxWidth: '100%', height: '100dvh' } }}>
    <Box role="dialog" aria-modal="true" tabIndex={-1} aria-label={participantId ? 'Modifier le musicien' : 'Ajouter un musicien'} sx={{ p: { xs: 2, sm: 3 }, minHeight: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Stack spacing={2} sx={{ flex: 1 }}>
        <Box>
          <Typography variant="h5">{participantId ? 'Modifier le musicien' : 'Ajouter un musicien'}</Typography>
          <Typography color="text.secondary">Nom et instruments joués pendant la jam.</Typography>
        </Box>
        <TextField label="Nom" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        <Divider />
        <Typography variant="h6">Instruments</Typography>
        <DialogContentText>Ajoute ou retire les instruments depuis ce drawer, pas depuis le menu des cards.</DialogContentText>
        {visibleInstruments.map((instrument) => <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => toggleInstrument(instrument.instrumentId)} />} label={instrument.name} />)}
        {visibleInstruments.some((instrument) => instrument.name === 'Autre' && selectedInstrumentIds.includes(instrument.instrumentId)) ? <TextField label="Détail autre instrument" value={otherDetail} onChange={(event) => setOtherDetail(event.target.value)} /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', pt: 2, mt: 2 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={saveParticipant}>Enregistrer</Button>
      </Stack>
    </Box>
  </Drawer>;
}
