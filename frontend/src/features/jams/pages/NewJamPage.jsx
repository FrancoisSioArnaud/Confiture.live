import { Add, ArrowDownward, ArrowUpward, CheckCircle } from '@mui/icons-material';
import { Alert, Box, Button, Checkbox, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jamStore } from '../../jam/jamStore';
import { getOrCreateClientId } from '../../sync/clientIdentity';
import { buildCreateJamTransaction } from '../utils/createJamTransaction';
import { DEFAULT_INSTRUMENTS } from '../utils/defaultInstruments';
import { createId } from '../../../shared/utils/createId';

const DEFAULT_INSTRUMENT_ROWS = DEFAULT_INSTRUMENTS.map((instrument) => ({ ...instrument, isDefault: true }));

export function NewJamPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [indicativeDate, setIndicativeDate] = useState('');
  const [instruments, setInstruments] = useState(() => DEFAULT_INSTRUMENT_ROWS);
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(() => DEFAULT_INSTRUMENT_ROWS.map((instrument) => instrument.instrumentId));
  const [customInstrument, setCustomInstrument] = useState('');
  const clientId = useMemo(() => getOrCreateClientId(), []);

  const mutation = useMutation({
    mutationFn: async () => {
      const transaction = buildCreateJamTransaction({
        name: name.trim() || 'Nouvelle jam',
        indicativeDate: indicativeDate || null,
        clientId,
        selectedInstrumentIds,
        orderedInstruments: instruments,
      });
      await jamStore.getState().applyLocalTransaction(transaction, { sync: false });
      jamStore.getState().pushPending().catch(() => {});
      navigate(`/jams/${transaction.jamId}`);
    },
  });

  function toggleInstrument(instrumentId) {
    setSelectedInstrumentIds((current) => current.includes(instrumentId) ? current.filter((id) => id !== instrumentId) : [...current, instrumentId]);
  }

  function moveInstrument(instrumentId, delta) {
    setInstruments((current) => {
      const index = current.findIndex((instrument) => instrument.instrumentId === instrumentId);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const instruments = [...current];
      const [instrument] = instruments.splice(index, 1);
      instruments.splice(nextIndex, 0, instrument);
      return instruments;
    });
  }

  function addCustomInstrument() {
    const label = customInstrument.trim();
    if (!label) return;
    const instrument = { instrumentId: createId('instrument'), label, isDefault: false };
    setInstruments((current) => [...current, instrument]);
    setSelectedInstrumentIds((current) => [...current, instrument.instrumentId]);
    setCustomInstrument('');
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Stack spacing={3} component="form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Nouvelle jam</Typography>
          <Typography color="text.secondary">Configure les instruments de départ. Tu pourras ajuster la jam ensuite.</Typography>
        </Box>
        {mutation.isError ? <Alert severity="error">Impossible de créer la jam localement. Vérifie le navigateur puis réessaie.</Alert> : null}
        <TextField label="Nom" placeholder="Nom de la jam" value={name} onChange={(event) => setName(event.target.value)} fullWidth autoFocus />
        <TextField label="Date indicative" type="date" value={indicativeDate} onChange={(event) => setIndicativeDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
        <Box>
          <Typography variant="subtitle1" fontWeight={800} mb={1}>Instruments actifs</Typography>
          <Stack spacing={0.5}>
            {instruments.map((instrument, index) => (
              <Stack key={instrument.instrumentId} direction="row" spacing={1} alignItems="center">
                <Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => toggleInstrument(instrument.instrumentId)} inputProps={{ 'aria-label': instrument.label }} />
                <Typography sx={{ flexGrow: 1 }}>{instrument.label}</Typography>
                <IconButton aria-label={`Monter ${instrument.label}`} onClick={() => moveInstrument(instrument.instrumentId, -1)} disabled={index === 0}><ArrowUpward /></IconButton>
                <IconButton aria-label={`Descendre ${instrument.label}`} onClick={() => moveInstrument(instrument.instrumentId, 1)} disabled={index === instruments.length - 1}><ArrowDownward /></IconButton>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField placeholder="Ajouter un instrument" value={customInstrument} onChange={(event) => setCustomInstrument(event.target.value)} fullWidth />
          <Button variant="outlined" onClick={addCustomInstrument} startIcon={<Add />} sx={{ whiteSpace: 'nowrap' }}>Ajouter</Button>
        </Stack>
        <Button type="submit" size="large" variant="contained" disabled={mutation.isPending || selectedInstrumentIds.length === 0} startIcon={<CheckCircle />}>Créer la jam</Button>
      </Stack>
    </Paper>
  );
}
