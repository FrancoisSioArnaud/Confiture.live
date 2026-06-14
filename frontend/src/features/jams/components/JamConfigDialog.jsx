import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { persistLocalAction } from '../services/localJamActions.js';

const LINK_STRATEGIES = ['move_to_first', 'move_to_last', 'average_position'];

export function JamConfigDialog({ open, onClose, jamId, localJam, projectedState }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(localJam?.name ?? projectedState?.jam?.name ?? '');
  const [indicativeDate, setIndicativeDate] = useState(localJam?.indicativeDate ?? projectedState?.jam?.indicativeDate ?? '');
  const [strategy, setStrategy] = useState(projectedState?.jam?.linkReorderStrategy ?? 'move_to_first');
  const [instrumentName, setInstrumentName] = useState('');

  useEffect(() => {
    setName(localJam?.name ?? projectedState?.jam?.name ?? '');
    setIndicativeDate(localJam?.indicativeDate ?? projectedState?.jam?.indicativeDate ?? '');
    setStrategy(projectedState?.jam?.linkReorderStrategy ?? 'move_to_first');
  }, [localJam, projectedState, open]);

  async function saveMetadata() {
    await persistLocalAction({ jamId, label: 'Modifier jam', jamPatch: { name, indicativeDate: indicativeDate || null }, events: [{ type: 'jam_updated', payload: { name, indicativeDate: indicativeDate || null } }, { type: 'jam_link_reorder_strategy_changed', payload: { previousStrategy: projectedState?.jam?.linkReorderStrategy, nextStrategy: strategy } }] });
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
    await queryClient.invalidateQueries({ queryKey: ['localJam', jamId] });
    await queryClient.invalidateQueries({ queryKey: ['localJams'] });
    onClose();
  }

  async function addInstrument() {
    const trimmed = instrumentName.trim();
    if (!trimmed) return;
    const order = Object.keys(projectedState?.instruments ?? {}).length;
    await persistLocalAction({ jamId, label: 'Ajouter instrument', events: [{ type: 'instrument_added', payload: { instrumentId: `instrument_${Date.now()}`, name: trimmed, order, visible: true } }] });
    setInstrumentName('');
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
  }

  async function toggleInstrumentVisibility(instrumentId, visible) {
    await persistLocalAction({ jamId, label: visible ? 'Afficher instrument' : 'Masquer instrument', events: [{ type: 'instrument_visibility_changed', payload: { instrumentId, visible, confirmedDespiteActiveLinks: true } }] });
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
  }

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Configuration jam</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Nom" value={name} onChange={(event) => setName(event.target.value)} /><TextField label="Date indicative" type="date" value={indicativeDate ?? ''} onChange={(event) => setIndicativeDate(event.target.value)} InputLabelProps={{ shrink: true }} /><FormControl><InputLabel>Stratégie link</InputLabel><Select label="Stratégie link" value={strategy} onChange={(event) => setStrategy(event.target.value)}>{LINK_STRATEGIES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl><Stack direction="row" spacing={1}><TextField fullWidth label="Nouvel instrument" value={instrumentName} onChange={(event) => setInstrumentName(event.target.value)} /><Button onClick={addInstrument}>Ajouter</Button></Stack><Typography variant="h6">Instruments</Typography>{Object.values(projectedState?.instruments ?? {}).sort((a, b) => a.order - b.order).map((instrument) => <Stack key={instrument.instrumentId} direction="row" justifyContent="space-between" alignItems="center"><Typography>{instrument.name}</Typography><Button onClick={() => toggleInstrumentVisibility(instrument.instrumentId, instrument.isVisible === false)}>{instrument.isVisible === false ? 'Afficher' : 'Masquer'}</Button></Stack>)}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Fermer</Button><Button variant="contained" onClick={saveMetadata}>Enregistrer</Button></DialogActions></Dialog>;
}
