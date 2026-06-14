import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { persistLocalAction } from '../../jams/services/localJamActions.js';

export function ParticipantDialog({ open, onClose, jamId, projectedState, participantId = null }) {
  const queryClient = useQueryClient();
  const participant = participantId ? projectedState?.participants?.[participantId] : null;
  const existingParticipations = Object.values(projectedState?.participations ?? {}).filter((participation) => participation.participantId === participantId && !participation.removed);
  const visibleInstruments = Object.values(projectedState?.instruments ?? {}).filter((instrument) => instrument.isVisible !== false).sort((a, b) => a.order - b.order);
  const [name, setName] = useState(participant?.name ?? '');
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(existingParticipations.map((participation) => participation.instrumentId));
  const [otherDetail, setOtherDetail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(participant?.name ?? '');
    setSelectedInstrumentIds(existingParticipations.map((participation) => participation.instrumentId));
    setOtherDetail('');
    setError('');
  }, [open, participantId]);

  function toggleInstrument(instrumentId) {
    setSelectedInstrumentIds((current) => current.includes(instrumentId) ? current.filter((id) => id !== instrumentId) : [...current, instrumentId]);
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
    for (const participation of existingParticipations) {
      if (!selectedInstrumentIds.includes(participation.instrumentId)) {
        events.push({ type: 'participation_removed', payload: { participationId: participation.participationId, confirmedDespiteLinksOrLocks: true } });
      }
    }

    const activeParticipationIds = [...existingParticipations.filter((participation) => selectedInstrumentIds.includes(participation.instrumentId)).map((participation) => participation.participationId), ...createdParticipationIds];
    for (let index = 0; index < activeParticipationIds.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < activeParticipationIds.length; otherIndex += 1) {
        events.push({ type: 'conflict_created', payload: { conflictId: `conflict_${effectiveParticipantId}_${index}_${otherIndex}_${Date.now()}`, scope: 'participation', targetIds: [activeParticipationIds[index], activeParticipationIds[otherIndex]], reason: 'instrument_constraint', anchorTargetId: activeParticipationIds[index] } });
      }
    }

    await persistLocalAction({ jamId, label: participantId ? 'Modifier participant' : 'Créer participant', events });
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
    onClose();
  }

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{participantId ? 'Modifier le musicien' : 'Ajouter un musicien'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Nom" value={name} onChange={(event) => setName(event.target.value)} required />{visibleInstruments.map((instrument) => <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => toggleInstrument(instrument.instrumentId)} />} label={instrument.name} />)}{visibleInstruments.some((instrument) => instrument.name === 'Autre' && selectedInstrumentIds.includes(instrument.instrumentId)) ? <TextField label="Détail autre instrument" value={otherDetail} onChange={(event) => setOtherDetail(event.target.value)} /> : null}{error ? <Alert severity="error">{error}</Alert> : null}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Annuler</Button><Button variant="contained" onClick={saveParticipant}>Enregistrer</Button></DialogActions></Dialog>;
}
