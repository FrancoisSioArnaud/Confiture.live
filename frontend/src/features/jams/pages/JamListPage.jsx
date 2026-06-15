import { Alert, Box, Button, Card, CardActions, CardContent, Container, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../sync/localDb.js';
import { useLocalJams } from '../hooks/useLocalJams.js';
import { navigate } from '../../../shared/utils/navigation.js';
import { useConfirmDialog, useSnackbar } from '../../../shared/feedback/index.js';
import { DemoToolsPanel } from '../../demo/DemoToolsPanel.jsx';

export function JamListPage() {
  const queryClient = useQueryClient();
  const { data: jams = [] } = useLocalJams();
  const { confirm } = useConfirmDialog();
  const { showSnackbar } = useSnackbar();
  const deleteMutation = useMutation({ mutationFn: async (jamId) => db.localJams.delete(jamId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['localJams'] }); showSnackbar('Jam locale supprimée.'); } });

  async function confirmDeleteJam(jam) {
    const confirmed = await confirm({
      title: 'Supprimer cette jam locale ?',
      description: 'La suppression retire seulement la copie locale de cette jam.',
      confirmLabel: 'Supprimer',
      confirmColor: 'error',
    });
    if (confirmed) deleteMutation.mutate(jam.jamId);
  }

  return <Container maxWidth="md" sx={{ py: 3 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box><Typography variant="h4">Confiture.live</Typography><Typography color="text.secondary">Jams sauvegardées sur cet appareil</Typography></Box>
      <Button variant="contained" onClick={() => navigate('/jams/new')}>Créer jam</Button>
    </Stack>
    <DemoToolsPanel />
    {jams.length === 0 ? <Alert severity="info">Aucune jam locale pour le moment.</Alert> : <Stack spacing={2}>{jams.map((jam) => <Card key={jam.jamId} variant="outlined"><CardContent><Typography variant="h6">{jam.name}</Typography><Typography color="text.secondary">{jam.indicativeDate || 'Date indicative non définie'}</Typography></CardContent><CardActions><Button onClick={() => navigate(`/jams/${jam.jamId}`)}>Ouvrir</Button><Button color="error" onClick={() => confirmDeleteJam(jam)}>Supprimer</Button></CardActions></Card>)}</Stack>}
  </Container>;
}
