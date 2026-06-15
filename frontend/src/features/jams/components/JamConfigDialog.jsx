import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { persistLocalAction } from '../services/localJamActions.js';
import { useConfirmDialog, useSnackbar } from '../../../shared/feedback/index.js';

const LINK_STRATEGIES = ['move_to_first', 'move_to_last', 'average_position'];

function orderedInstruments(projectedState) {
  return Object.values(projectedState?.instruments ?? {}).sort((a, b) => a.order - b.order);
}

function instrumentActivity(projectedState, instrumentId) {
  const participations = Object.values(projectedState?.participations ?? {}).filter((participation) => participation.instrumentId === instrumentId && !participation.removed);
  const appearances = Object.values(projectedState?.appearances ?? {}).filter((appearance) => appearance.instrumentId === instrumentId && !appearance.removed);
  const holes = Object.values(projectedState?.holes ?? {}).filter((hole) => hole.instrumentId === instrumentId && !hole.removed);
  const targetIds = new Set([...appearances.map((appearance) => appearance.appearanceId), ...holes.map((hole) => hole.holeId)]);
  const links = Object.values(projectedState?.links ?? {}).filter((link) => !link.removed && (link.targets ?? []).some((target) => targetIds.has(target.id ?? target.targetId)));
  return { participations: participations.length, appearances: appearances.length, holes: holes.length, links: links.length, isActive: participations.length + appearances.length + holes.length + links.length > 0 };
}

export function JamConfigDialog({ open, onClose, jamId, localJam, projectedState }) {
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const { showSnackbar } = useSnackbar();
  const [name, setName] = useState(localJam?.name ?? projectedState?.jam?.name ?? '');
  const [indicativeDate, setIndicativeDate] = useState(localJam?.indicativeDate ?? projectedState?.jam?.indicativeDate ?? '');
  const [strategy, setStrategy] = useState(projectedState?.jam?.linkReorderStrategy ?? 'move_to_first');
  const [instrumentName, setInstrumentName] = useState('');
  const [instrumentDrafts, setInstrumentDrafts] = useState({});
  const instruments = useMemo(() => orderedInstruments(projectedState), [projectedState]);

  useEffect(() => {
    setName(localJam?.name ?? projectedState?.jam?.name ?? '');
    setIndicativeDate(localJam?.indicativeDate ?? projectedState?.jam?.indicativeDate ?? '');
    setStrategy(projectedState?.jam?.linkReorderStrategy ?? 'move_to_first');
    setInstrumentDrafts(Object.fromEntries(orderedInstruments(projectedState).map((instrument) => [instrument.instrumentId, instrument.name ?? ''])));
  }, [localJam, projectedState, open]);

  async function refreshJamQueries() {
    await queryClient.invalidateQueries({ queryKey: ['syncState', jamId] });
    await queryClient.invalidateQueries({ queryKey: ['localJam', jamId] });
    await queryClient.invalidateQueries({ queryKey: ['localJams'] });
  }

  async function saveMetadata() {
    const events = [{ type: 'jam_updated', payload: { name, indicativeDate: indicativeDate || null } }];
    if (strategy !== projectedState?.jam?.linkReorderStrategy) {
      events.push({ type: 'jam_link_reorder_strategy_changed', payload: { previousStrategy: projectedState?.jam?.linkReorderStrategy, nextStrategy: strategy } });
    }
    await persistLocalAction({ jamId, label: 'Modifier jam', jamPatch: { name, indicativeDate: indicativeDate || null }, events });
    await refreshJamQueries();
    showSnackbar(strategy !== projectedState?.jam?.linkReorderStrategy ? 'Jam mise à jour · stratégie de link mise à jour' : 'Jam mise à jour');
    onClose();
  }

  async function addInstrument() {
    const trimmed = instrumentName.trim();
    if (!trimmed) return;
    const order = instruments.length;
    await persistLocalAction({ jamId, label: 'Ajouter instrument', events: [{ type: 'instrument_added', payload: { instrumentId: `instrument_${Date.now()}`, name: trimmed, order, visible: true } }] });
    setInstrumentName('');
    await refreshJamQueries();
    showSnackbar('Instrument ajouté');
  }

  async function renameInstrument(instrument) {
    const trimmed = (instrumentDrafts[instrument.instrumentId] ?? '').trim();
    if (!trimmed || trimmed === instrument.name) return;
    await persistLocalAction({ jamId, label: 'Renommer instrument', events: [{ type: 'instrument_updated', payload: { instrumentId: instrument.instrumentId, name: trimmed } }] });
    await refreshJamQueries();
    showSnackbar('Instrument renommé');
  }

  async function reorderInstrument(instrumentId, direction) {
    const index = instruments.findIndex((instrument) => instrument.instrumentId === instrumentId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= instruments.length) return;
    const reordered = [...instruments];
    const [instrument] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, instrument);
    await persistLocalAction({ jamId, label: 'Réordonner instruments', events: [{ type: 'instruments_reordered', payload: { orderedInstrumentIds: reordered.map((item) => item.instrumentId) } }] });
    await refreshJamQueries();
    showSnackbar('Ordre des instruments mis à jour');
  }

  async function toggleInstrumentVisibility(instrument) {
    const visible = instrument.isVisible === false;
    if (!visible) {
      const activity = instrumentActivity(projectedState, instrument.instrumentId);
      if (activity.isActive) {
        const confirmed = await confirm({
          title: 'Masquer cet instrument ?',
          description: activity.links > 0
            ? 'Cet instrument contient des passages liés à d’autres colonnes. Les links existants restent dans l’historique, mais la colonne sera masquée pour la suite.'
            : 'La colonne ne sera plus affichée dans le tableau ni dans le drawer d’appel. L’historique reste conservé.',
          confirmLabel: 'Masquer l’instrument',
          confirmColor: 'error',
        });
        if (!confirmed) return;
      }
    }
    await persistLocalAction({ jamId, label: visible ? 'Afficher instrument' : 'Masquer instrument', events: [{ type: 'instrument_visibility_changed', payload: { instrumentId: instrument.instrumentId, visible, confirmedDespiteActiveLinks: true } }] });
    await refreshJamQueries();
    showSnackbar(visible ? 'Instrument affiché' : 'Instrument masqué');
  }

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>Configuration jam</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Nom" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Date indicative" type="date" value={indicativeDate ?? ''} onChange={(event) => setIndicativeDate(event.target.value)} InputLabelProps={{ shrink: true }} />
        <FormControl>
          <InputLabel>Stratégie link</InputLabel>
          <Select label="Stratégie link" value={strategy} onChange={(event) => setStrategy(event.target.value)}>
            {LINK_STRATEGIES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </Select>
        </FormControl>
        <DialogContentText>La stratégie de link s’applique aux prochains links. Les links existants restent conservés dans l’historique.</DialogContentText>
        <Divider />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField fullWidth label="Nouvel instrument" value={instrumentName} onChange={(event) => setInstrumentName(event.target.value)} />
          <Button onClick={addInstrument}>Ajouter</Button>
        </Stack>
        <Typography variant="h6">Instruments</Typography>
        {instruments.map((instrument, index) => <Stack key={instrument.instrumentId} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField fullWidth label="Nom instrument" value={instrumentDrafts[instrument.instrumentId] ?? ''} onChange={(event) => setInstrumentDrafts((current) => ({ ...current, [instrument.instrumentId]: event.target.value }))} />
          <Button onClick={() => renameInstrument(instrument)}>Renommer</Button>
          <Button disabled={index === 0} onClick={() => reorderInstrument(instrument.instrumentId, -1)}>Monter</Button>
          <Button disabled={index === instruments.length - 1} onClick={() => reorderInstrument(instrument.instrumentId, 1)}>Descendre</Button>
          <Button color={instrument.isVisible === false ? 'primary' : 'error'} onClick={() => toggleInstrumentVisibility(instrument)}>{instrument.isVisible === false ? 'Afficher' : 'Masquer'}</Button>
        </Stack>)}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Fermer</Button><Button variant="contained" onClick={saveMetadata}>Enregistrer</Button></DialogActions>
  </Dialog>;
}
