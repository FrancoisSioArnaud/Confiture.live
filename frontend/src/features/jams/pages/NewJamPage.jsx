import { useMemo, useState } from 'react';
import { Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../sync/localDb.js';
import { createClientId, createTransaction } from '../../sync/transactionFactory.js';
import { projectJamState } from '../../projection/projectJamState.js';
import { navigate } from '../../../shared/utils/navigation.js';

const DEFAULT_INSTRUMENTS = ['Chant', 'Guitare', 'Basse', 'Batterie', 'Piano', 'Autre'];

export function NewJamPage() {
  const [name, setName] = useState('Nouvelle jam');
  const [indicativeDate, setIndicativeDate] = useState('');
  const [customInstrument, setCustomInstrument] = useState('');
  const queryClient = useQueryClient();
  const instruments = useMemo(() => [...DEFAULT_INSTRUMENTS, ...(customInstrument.trim() ? [customInstrument.trim()] : [])], [customInstrument]);

  async function createJam() {
    const jamId = `jam_${Date.now()}`;
    const clientId = createClientId();
    const events = [{ type: 'jam_created', payload: { jamId, name, indicativeDate: indicativeDate || null, linkReorderStrategy: 'move_to_first' } }, ...instruments.map((instrumentName, order) => ({ type: 'instrument_added', payload: { instrumentId: `instrument_${order + 1}_${instrumentName.toLowerCase().replaceAll(' ', '_')}`, name: instrumentName, order, visible: true } }))];
    const transaction = createTransaction({ jamId, clientId, clientSequenceNumber: 1, events, label: 'Créer jam' });
    const projection = projectJamState({ events: transaction.events });
    await db.localJams.put({ jamId, name, indicativeDate: indicativeDate || null, updatedAt: new Date().toISOString(), syncStatus: 'pending' });
    await db.localTransactions.put({ ...transaction, syncStatus: 'pending' });
    await db.pendingTransactions.put({ transactionId: transaction.transactionId, jamId, clientId, clientSequenceNumber: 1, nextAttemptAt: new Date().toISOString(), attempts: 0 });
    await db.syncState.put({ jamId, status: 'pending', updatedAt: new Date().toISOString(), projectedState: projection });
    await queryClient.invalidateQueries({ queryKey: ['localJams'] });
    navigate(`/jams/${jamId}`);
  }

  return <Container maxWidth="sm" sx={{ py: 3 }}><Button onClick={() => navigate('/')}>← Retour</Button><Typography variant="h4" sx={{ my: 2 }}>Créer une jam</Typography><Stack spacing={2}><TextField label="Nom" value={name} onChange={(event) => setName(event.target.value)} required /><TextField label="Date indicative" type="date" value={indicativeDate} onChange={(event) => setIndicativeDate(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField label="Ajouter un instrument" placeholder="Ajouter un instrument" value={customInstrument} onChange={(event) => setCustomInstrument(event.target.value)} /><Typography color="text.secondary">Instruments : {instruments.join(', ')}</Typography><Button variant="contained" disabled={!name.trim()} onClick={createJam}>Créer la jam</Button></Stack></Container>;
}
