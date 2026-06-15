import { Button, Card, CardActions, CardContent, Stack, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../sync/localDb.js';
import { useConfirmDialog, useSnackbar } from '../../shared/feedback/index.js';

const DEMO_TOOLS_ENABLED = import.meta.env.VITE_ENABLE_DEMO_TOOLS === 'true';

export function DemoToolsPanel() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const { showSnackbar } = useSnackbar();

  if (!DEMO_TOOLS_ENABLED) return null;

  async function reloadBackendDemoJams() {
    await queryClient.invalidateQueries({ queryKey: ['localJams'] });
    showSnackbar('Demo tools : rechargement des jams backend demandé.');
  }

  async function clearLocalState() {
    const confirmed = await confirm({
      title: 'Effacer les données locales de démo ?',
      description: 'Cette action vide IndexedDB sur ce navigateur. Les seeds backend ne sont pas supprimés.',
      confirmLabel: 'Effacer local',
      confirmColor: 'error',
    });
    if (!confirmed) return;
    await Promise.all([db.localJams.clear(), db.localTransactions.clear(), db.pendingTransactions.clear(), db.snapshots.clear(), db.syncState.clear(), db.clientSessions.clear()]);
    await queryClient.invalidateQueries({ queryKey: ['localJams'] });
    showSnackbar('Demo tools : état local vidé.');
  }

  return <Card variant="outlined" sx={{ mb: 2, borderStyle: 'dashed' }}>
    <CardContent>
      <Stack spacing={0.5}>
        <Typography variant="h6">Demo tools</Typography>
        <Typography color="text.secondary">Outils locaux activés par VITE_ENABLE_DEMO_TOOLS=true pour vérifier les seeds backend et la projection IndexedDB.</Typography>
      </Stack>
    </CardContent>
    <CardActions sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button onClick={reloadBackendDemoJams}>Recharger les jams backend</Button>
      <Button color="error" onClick={clearLocalState}>Effacer IndexedDB local</Button>
    </CardActions>
  </Card>;
}
