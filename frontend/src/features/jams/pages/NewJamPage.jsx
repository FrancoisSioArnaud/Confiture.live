import { Add, CheckCircle } from '@mui/icons-material';
import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJam as createJamApi } from '../../../shared/api/jamsApi';
import { jamStore } from '../../jam/jamStore';
import { getOrCreateClientId } from '../../sync/clientIdentity';
import { markTransactionSynced, saveSyncState } from '../../sync/localDb';
import { buildCreateJamTransaction } from '../utils/createJamTransaction';
import { DEFAULT_INSTRUMENTS } from '../utils/defaultInstruments';

export function NewJamPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [indicativeDate, setIndicativeDate] = useState('');
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState(() => DEFAULT_INSTRUMENTS.map((instrument) => instrument.instrumentId));
  const [customInstrument, setCustomInstrument] = useState('');
  const [customInstruments, setCustomInstruments] = useState([]);
  const clientId = useMemo(() => getOrCreateClientId(), []);

  const mutation = useMutation({
    mutationFn: async () => {
      const transaction = buildCreateJamTransaction({
        name: name.trim() || 'Nouvelle jam',
        indicativeDate: indicativeDate || new Date().toISOString().slice(0, 10),
        clientId,
        selectedInstrumentIds,
        customInstruments,
      });
      await jamStore.getState().applyLocalTransaction(transaction, { sync: false });
      try {
        const response = await createJamApi({ clientId, transaction });
        const ack = response?.transactionAck;
        if (ack) {
          await markTransactionSynced(transaction.jamId, transaction.transactionId, ack);
          await saveSyncState(transaction.jamId, { lastServerSequenceNumber: response.latestServerSequenceNumber ?? ack.serverSequenceNumberEnd, status: 'synced' });
          await jamStore.getState().reloadFromLocalDb(transaction.jamId);
        }
      } finally {
        navigate(`/jams/${transaction.jamId}`);
      }
    },
  });

  function toggleInstrument(instrumentId) {
    setSelectedInstrumentIds((current) => current.includes(instrumentId) ? current.filter((id) => id !== instrumentId) : [...current, instrumentId]);
  }

  function addCustomInstrument() {
    const label = customInstrument.trim();
    if (!label) return;
    setCustomInstruments((current) => [...current, label]);
    setCustomInstrument('');
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Stack spacing={3} component="form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Nouvelle jam</Typography>
          <Typography color="text.secondary">Configure les instruments de départ. Tu pourras ajuster la jam ensuite.</Typography>
        </Box>
        <TextField label="Nom" placeholder="Nom de la jam" value={name} onChange={(event) => setName(event.target.value)} fullWidth autoFocus />
        <TextField label="Date indicative" type="date" value={indicativeDate} onChange={(event) => setIndicativeDate(event.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
        <Box>
          <Typography variant="subtitle1" fontWeight={800} mb={1}>Instruments actifs</Typography>
          <Stack spacing={0.5}>
            {DEFAULT_INSTRUMENTS.map((instrument) => (
              <FormControlLabel key={instrument.instrumentId} control={<Checkbox checked={selectedInstrumentIds.includes(instrument.instrumentId)} onChange={() => toggleInstrument(instrument.instrumentId)} />} label={instrument.label} />
            ))}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField placeholder="Ajouter un instrument" value={customInstrument} onChange={(event) => setCustomInstrument(event.target.value)} fullWidth />
          <Button variant="outlined" onClick={addCustomInstrument} startIcon={<Add />} sx={{ whiteSpace: 'nowrap' }}>Ajouter</Button>
        </Stack>
        {customInstruments.length ? <Typography color="text.secondary">Ajoutés : {customInstruments.join(', ')}</Typography> : null}
        <Button type="submit" size="large" variant="contained" disabled={mutation.isPending || selectedInstrumentIds.length + customInstruments.length === 0} startIcon={<CheckCircle />}>Créer la jam</Button>
      </Stack>
    </Paper>
  );
}
