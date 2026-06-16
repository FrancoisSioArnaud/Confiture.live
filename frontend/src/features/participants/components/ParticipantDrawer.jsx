import { Alert, Box, Button, Checkbox, Divider, Drawer, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import {
  buildCreateParticipantTransaction,
  buildEditParticipantTransaction,
  impactedRemovedParticipations,
  validateParticipantDraft,
} from '../utils/buildParticipantDrawerTransaction';

function visibleInstruments(projection) {
  return Object.values(projection.instruments ?? {}).filter((instrument) => instrument.visible !== false).sort((a, b) => String(a.orderKey).localeCompare(String(b.orderKey)));
}

function activeParticipationsFor(projection, participantId) {
  return Object.values(projection.participations ?? {}).filter((participation) => participation.participantId === participantId && participation.status === 'active');
}

function pairKey(leftInstrumentId, rightInstrumentId) {
  return [leftInstrumentId, rightInstrumentId].sort().join('__');
}

function appearanceIdFor(participationId, appearanceIndex = 1) {
  return `appearance_${participationId}_${appearanceIndex}`;
}

function selectedInstrumentPairs(selectedInstrumentIds) {
  const ids = [...selectedInstrumentIds];
  return ids.flatMap((leftId, index) => ids.slice(index + 1).map((rightId) => ({ leftId, rightId, key: pairKey(leftId, rightId) })));
}

function initialLinkedPairsFor(projection, participations) {
  const pairs = [];
  participations.forEach((left, leftIndex) => {
    participations.slice(leftIndex + 1).forEach((right) => {
      const leftAppearanceId = appearanceIdFor(left.participationId, left.startAppearanceIndex ?? 1);
      const rightAppearanceId = appearanceIdFor(right.participationId, right.startAppearanceIndex ?? 1);
      const hasLink = Object.values(projection.links ?? {}).some((link) => link.status === 'active' && link.targets?.some((target) => target.type === 'appearance' && target.id === leftAppearanceId) && link.targets?.some((target) => target.type === 'appearance' && target.id === rightAppearanceId));
      if (hasLink) pairs.push(pairKey(left.instrumentId, right.instrumentId));
    });
  });
  return pairs;
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizedCustomLabels(labels, selectedInstrumentIds) {
  return Object.fromEntries(selectedInstrumentIds.map((instrumentId) => [instrumentId, (labels[instrumentId] ?? '').trim()]).filter(([, value]) => value));
}

function draftHasChanges({ mode, draft, participant, activeParticipations, initialLinkedPairs }) {
  if (mode === 'create') return Boolean(draft.name.trim()) || draft.selectedInstrumentIds.length > 0;
  const currentInstrumentIds = activeParticipations.map((participation) => participation.instrumentId);
  const addedInstrumentIds = draft.selectedInstrumentIds.filter((instrumentId) => !currentInstrumentIds.includes(instrumentId));
  return participant?.name !== draft.name.trim()
    || !arraysEqual(currentInstrumentIds, draft.selectedInstrumentIds)
    || !arraysEqual([...initialLinkedPairs].sort(), [...draft.initialLinkedInstrumentPairs].sort())
    || JSON.stringify(normalizedCustomLabels({}, addedInstrumentIds)) !== JSON.stringify(normalizedCustomLabels(draft.customInstrumentLabels, addedInstrumentIds));
}

export function ParticipantDrawer({ open, mode = 'create', projection, participantId = null, clientId, clientSequenceNumber, onClose, onTransaction, onFeedback }) {
  const instruments = useMemo(() => visibleInstruments(projection), [projection]);
  const participant = participantId ? projection.participants[participantId] : null;
  const activeParticipations = useMemo(() => activeParticipationsFor(projection, participantId), [participantId, projection]);
  const editableActiveParticipations = useMemo(() => {
    const visibleInstrumentIds = new Set(instruments.map((instrument) => instrument.instrumentId));
    return activeParticipations.filter((participation) => visibleInstrumentIds.has(participation.instrumentId));
  }, [activeParticipations, instruments]);
  const [draft, setDraft] = useState({ name: '', selectedInstrumentIds: [], customInstrumentLabels: {}, initialLinkedInstrumentPairs: [] });
  const [error, setError] = useState('');
  const [pendingRemovalConfirm, setPendingRemovalConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const labels = Object.fromEntries(editableActiveParticipations.filter((participation) => participation.customInstrumentLabel).map((participation) => [participation.instrumentId, participation.customInstrumentLabel]));
    const visibleInstrumentIds = instruments.map((instrument) => instrument.instrumentId);
    const selectedInstrumentIds = mode === 'create'
      ? []
      : visibleInstrumentIds.filter((instrumentId) => editableActiveParticipations.some((participation) => participation.instrumentId === instrumentId));
    setDraft({
      name: participant?.name ?? '',
      selectedInstrumentIds,
      customInstrumentLabels: labels,
      initialLinkedInstrumentPairs: mode === 'edit' ? initialLinkedPairsFor(projection, editableActiveParticipations) : [],
    });
    setError('');
    setPendingRemovalConfirm(null);
    setIsSaving(false);
  }, [editableActiveParticipations, instruments, mode, open, participant, projection]);

  function toggleInstrument(instrumentId) {
    setDraft((current) => {
      const selected = new Set(current.selectedInstrumentIds);
      if (selected.has(instrumentId)) selected.delete(instrumentId);
      else selected.add(instrumentId);
      const orderedSelectedInstrumentIds = instruments.map((instrument) => instrument.instrumentId).filter((candidateId) => selected.has(candidateId));
      return { ...current, selectedInstrumentIds: orderedSelectedInstrumentIds };
    });
  }

  function toggleInitialLinkPair(key) {
    setDraft((current) => {
      const selectedPairs = new Set(current.initialLinkedInstrumentPairs);
      if (selectedPairs.has(key)) selectedPairs.delete(key);
      else selectedPairs.add(key);
      return { ...current, initialLinkedInstrumentPairs: [...selectedPairs] };
    });
  }

  function updateCustomLabel(instrumentId, value) {
    setDraft((current) => ({ ...current, customInstrumentLabels: { ...current.customInstrumentLabels, [instrumentId]: value } }));
  }

  async function save({ confirmedRemovedParticipationIds = [] } = {}) {
    if (isSaving) return;
    const validation = validateParticipantDraft({ draft, projection, participantId, instruments });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    if (mode === 'edit') {
      const impacted = impactedRemovedParticipations({ projection, participantId, selectedInstrumentIds: validation.draft.selectedInstrumentIds, instruments });
      const unconfirmed = impacted.filter((participation) => !confirmedRemovedParticipationIds.includes(participation.participationId));
      if (unconfirmed.length > 0) {
        setPendingRemovalConfirm(unconfirmed);
        return;
      }
    }

    const result = mode === 'create'
      ? buildCreateParticipantTransaction({ jamId: projection.jam?.jamId, clientId, clientSequenceNumber, projection, draft: validation.draft, instruments })
      : buildEditParticipantTransaction({ jamId: projection.jam?.jamId, clientId, clientSequenceNumber, projection, participantId, draft: validation.draft, instruments, confirmedRemovedParticipationIds });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setIsSaving(true);
    try {
      if (result.transaction) {
        await Promise.resolve(onTransaction(result.transaction));
        const eventTypes = result.transaction.events.map((event) => event.type);
        if (mode === 'edit' && eventTypes.includes('participation_added')) onFeedback?.('Instrument ajouté au musicien');
        if (mode === 'edit' && eventTypes.includes('participation_removed')) onFeedback?.('Instrument retiré');
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  const selected = new Set(draft.selectedInstrumentIds);
  const initialLinkedPairs = mode === 'edit' ? initialLinkedPairsFor(projection, editableActiveParticipations) : [];
  const hasChanges = draftHasChanges({ mode, draft, participant, activeParticipations: editableActiveParticipations, initialLinkedPairs });
  const isLeftParticipant = mode === 'edit' && participant?.status === 'left';
  const pairOptions = selectedInstrumentPairs(draft.selectedInstrumentIds);
  const instrumentById = new Map(instruments.map((instrument) => [instrument.instrumentId, instrument]));
  const selectedLinkedPairs = new Set(draft.initialLinkedInstrumentPairs);
  const editableActiveByInstrument = new Set(editableActiveParticipations.map((participation) => participation.instrumentId));

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}>
        <Box sx={{ p: 2, pb: 10 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={900}>{mode === 'create' ? 'Ajouter un musicien' : 'Modifier le musicien'}</Typography>
              <Typography variant="body2" color="text.secondary">Nom, instruments joués et liens initiaux simples du même musicien.</Typography>
            </Box>
            {isLeftParticipant ? <Alert severity="warning">Ce musicien est marqué parti : tu peux corriger son nom ou retirer un instrument visible, mais pas ajouter de nouvel instrument.</Alert> : null}
            <TextField label="Nom du musicien" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} error={Boolean(error)} helperText={error} fullWidth autoFocus />
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Instruments</Typography>
              <FormGroup>
                {instruments.map((instrument) => {
                  const isOther = instrument.label.trim().toLowerCase() === 'autre';
                  return (
                    <Box key={instrument.instrumentId}>
                      <FormControlLabel control={<Checkbox checked={selected.has(instrument.instrumentId)} disabled={isLeftParticipant && !selected.has(instrument.instrumentId)} onChange={() => toggleInstrument(instrument.instrumentId)} />} label={instrument.label} />
                      {isOther && selected.has(instrument.instrumentId) ? <TextField size="small" label="Préciser l’instrument" value={draft.customInstrumentLabels[instrument.instrumentId] ?? ''} disabled={mode === 'edit' && editableActiveByInstrument.has(instrument.instrumentId)} onChange={(event) => updateCustomLabel(instrument.instrumentId, event.target.value)} fullWidth sx={{ mb: 1 }} /> : null}
                    </Box>
                  );
                })}
              </FormGroup>
            </Box>
            {pairOptions.length > 0 ? (
              <Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={800}>Faire passer ensemble</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Ces choix concernent uniquement les instruments de ce musicien.</Typography>
                <FormGroup>
                  {pairOptions.map((pair) => (
                    <FormControlLabel
                      key={pair.key}
                      control={<Checkbox checked={selectedLinkedPairs.has(pair.key)} onChange={() => toggleInitialLinkPair(pair.key)} />}
                      label={`${instrumentById.get(pair.leftId)?.label ?? pair.leftId} + ${instrumentById.get(pair.rightId)?.label ?? pair.rightId}`}
                    />
                  ))}
                </FormGroup>
              </Box>
            ) : null}
          </Stack>
        </Box>
        <Box sx={{ position: 'sticky', bottom: 0, p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose} disabled={isSaving} fullWidth>Annuler</Button>
            <Button variant="contained" onClick={() => save()} disabled={!hasChanges || isSaving} loading={isSaving} fullWidth>{mode === 'create' ? 'Ajouter le musicien' : 'Enregistrer'}</Button>
          </Stack>
        </Box>
      </Drawer>
      <ConfirmDialog
        open={Boolean(pendingRemovalConfirm)}
        title="Retirer cet instrument ?"
        description="Les passages futurs sur cet instrument seront retirés. Les passages déjà joués resteront dans l’historique."
        confirmLabel="Retirer l’instrument"
        onCancel={() => setPendingRemovalConfirm(null)}
        onConfirm={() => {
          const ids = pendingRemovalConfirm.map((participation) => participation.participationId);
          setPendingRemovalConfirm(null);
          save({ confirmedRemovedParticipationIds: ids });
        }}
      />
    </>
  );
}
