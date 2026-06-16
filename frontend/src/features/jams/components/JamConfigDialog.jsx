import { Add, ArrowDownward, ArrowUpward, VisibilityOff } from '@mui/icons-material';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { buildJamConfigTransaction, createDraftInstrument } from '../utils/buildJamConfigTransaction';

function activeDataForInstrument(projection, instrumentId) {
  const hasParticipations = Object.values(projection.participations ?? {}).some((participation) => participation.instrumentId === instrumentId && participation.status === 'active');
  const hasLinks = Object.values(projection.links ?? {}).some((link) => link.status === 'active' && link.targets.some((target) => {
    if (target.type === 'hole') return projection.holes[target.id]?.instrumentId === instrumentId;
    return projection.appearances[target.id]?.instrumentId === instrumentId;
  }));
  return { hasParticipations, hasLinks, needsConfirmation: hasParticipations || hasLinks };
}

export function JamConfigDialog({ open, projection, clientId, clientSequenceNumber, onClose, onTransaction, onFeedback }) {
  const currentInstruments = useMemo(() => Object.values(projection.instruments ?? {}).sort((a, b) => String(a.orderKey).localeCompare(String(b.orderKey))), [projection.instruments]);
  const [draft, setDraft] = useState({ name: '', indicativeDate: '', linkReorderStrategy: 'move_to_first', instruments: [] });
  const [customInstrument, setCustomInstrument] = useState('');
  const [pendingHide, setPendingHide] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDraft({
      name: projection.jam?.name ?? '',
      indicativeDate: projection.jam?.indicativeDate ?? '',
      linkReorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_first',
      instruments: currentInstruments.map((instrument) => ({ ...instrument })),
    });
    setCustomInstrument('');
    setPendingHide(null);
  }, [currentInstruments, open, projection.jam]);

  function updateInstrument(instrumentId, patch) {
    setDraft((current) => ({ ...current, instruments: current.instruments.map((instrument) => instrument.instrumentId === instrumentId ? { ...instrument, ...patch } : instrument) }));
  }

  function moveInstrument(instrumentId, delta) {
    setDraft((current) => {
      const index = current.instruments.findIndex((instrument) => instrument.instrumentId === instrumentId);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.instruments.length) return current;
      const instruments = [...current.instruments];
      const [instrument] = instruments.splice(index, 1);
      instruments.splice(nextIndex, 0, instrument);
      return { ...current, instruments };
    });
  }

  function requestHide(instrument) {
    const activeData = activeDataForInstrument(projection, instrument.instrumentId);
    if (activeData.needsConfirmation) setPendingHide({ instrument, activeData });
    else updateInstrument(instrument.instrumentId, { visible: false, confirmedDespiteActiveLinks: false });
  }

  function confirmHide() {
    updateInstrument(pendingHide.instrument.instrumentId, { visible: false, confirmedDespiteActiveLinks: true });
    setPendingHide(null);
  }

  function addInstrument() {
    const label = customInstrument.trim();
    if (!label) return;
    setDraft((current) => ({ ...current, instruments: [...current.instruments, createDraftInstrument(label, current.instruments.length)] }));
    setCustomInstrument('');
  }

  async function save() {
    const transaction = buildJamConfigTransaction({
      jamId: projection.jam?.jamId,
      clientId,
      clientSequenceNumber,
      currentJam: projection.jam,
      currentInstruments,
      draft,
    });
    if (transaction) {
      await onTransaction(transaction);
      if (transaction.events.some((event) => event.type === 'jam_updated')) onFeedback?.('Jam mise à jour');
      if (transaction.events.some((event) => event.type === 'jam_link_reorder_strategy_changed')) onFeedback?.('Stratégie de link mise à jour');
      if (transaction.events.some((event) => event.type === 'instrument_visibility_changed')) onFeedback?.('Instrument masqué');
    }
    onClose();
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Configuration de la jam</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            <TextField label="Nom" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Date indicative" type="date" value={draft.indicativeDate} onChange={(event) => setDraft((current) => ({ ...current, indicativeDate: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <FormControl fullWidth>
              <InputLabel id="link-strategy-label">Stratégie de link</InputLabel>
              <Select labelId="link-strategy-label" label="Stratégie de link" value={draft.linkReorderStrategy} onChange={(event) => setDraft((current) => ({ ...current, linkReorderStrategy: event.target.value }))}>
                <MenuItem value="move_to_first">Déplacer vers le premier</MenuItem>
                <MenuItem value="move_to_last">Déplacer vers le dernier</MenuItem>
                <MenuItem value="average_position">Position moyenne</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} mb={1}>Instruments</Typography>
              <Stack spacing={1}>
                {draft.instruments.map((instrument, index) => (
                  <Stack key={instrument.instrumentId} direction="row" spacing={1} alignItems="center">
                    <TextField size="small" value={instrument.label} onChange={(event) => updateInstrument(instrument.instrumentId, { label: event.target.value })} fullWidth disabled={!instrument.visible} />
                    <IconButton aria-label="Monter" onClick={() => moveInstrument(instrument.instrumentId, -1)} disabled={index === 0}><ArrowUpward /></IconButton>
                    <IconButton aria-label="Descendre" onClick={() => moveInstrument(instrument.instrumentId, 1)} disabled={index === draft.instruments.length - 1}><ArrowDownward /></IconButton>
                    <Button color="warning" onClick={() => requestHide(instrument)} disabled={!instrument.visible} startIcon={<VisibilityOff />}>Masquer</Button>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField placeholder="Ajouter un instrument" value={customInstrument} onChange={(event) => setCustomInstrument(event.target.value)} fullWidth />
              <Button variant="outlined" onClick={addInstrument} startIcon={<Add />}>Ajouter</Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="contained" onClick={save}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={Boolean(pendingHide)}
        title="Masquer cet instrument ?"
        description="La colonne ne sera plus affichée dans le tableau ni dans le drawer d’appel. L’historique reste conservé."
        confirmLabel="Masquer l’instrument"
        onCancel={() => setPendingHide(null)}
        onConfirm={confirmHide}
      />
    </>
  );
}
