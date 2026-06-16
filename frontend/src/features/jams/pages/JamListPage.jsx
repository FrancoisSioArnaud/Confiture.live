import { Add, DeleteOutline, OpenInNew } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardActions, CardContent, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { archiveJam, listJams } from '../../../shared/api/jamsApi';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { useFeedback } from '../../../shared/feedback/FeedbackProvider';
import { isDemoToolsEnabled } from '../../demo/demoSeeds';
import { importDemoSeedLocally } from '../../demo/importDemoSeed';

export function JamListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [jamToDelete, setJamToDelete] = useState(null);
  const { enqueueFeedback } = useFeedback();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['jams'], queryFn: listJams });
  const deleteMutation = useMutation({
    mutationFn: archiveJam,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jams'] }); enqueueFeedback('Jam supprimée'); },
    onSettled: () => setJamToDelete(null),
  });
  const jams = data?.results ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h4" fontWeight={900}>Jams</Typography>
          <Typography color="text.secondary">Ouvre une jam existante ou prépare une nouvelle session.</Typography>
        </Box>
        <Button component={RouterLink} to="/jams/new" variant="contained" startIcon={<Add />}>Créer une jam</Button>
      </Stack>

      {isDemoToolsEnabled() ? <Alert severity="info" action={<Button color="inherit" size="small" onClick={async () => { const { jam } = await importDemoSeedLocally('complex'); enqueueFeedback('Seed démo importé localement'); navigate(`/jams/${jam.jamId}`); }}>Importer local</Button>}>Outils démo actifs : lance <strong>python manage.py seed_demo_jams</strong> côté backend ou importe le seed complexe dans IndexedDB.</Alert> : null}

      {isLoading ? <Stack alignItems="center" py={6}><CircularProgress /><Typography mt={2}>Chargement des jams…</Typography></Stack> : null}
      {isError ? <Alert severity="warning">Impossible de charger les jams. {error?.message}</Alert> : null}
      {!isLoading && !isError && jams.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography variant="h6">Aucune jam créée pour l’instant.</Typography><Typography color="text.secondary" mt={1}>Crée ta première jam pour commencer à organiser les passages.</Typography></CardContent><CardActions><Button component={RouterLink} to="/jams/new" variant="contained">Créer une jam</Button></CardActions></Card>
      ) : null}

      <Grid container spacing={2}>
        {jams.map((jam) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={jam.jamId}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800}>{jam.name}</Typography>
                <Typography color="text.secondary">{jam.indicativeDate || 'Date à préciser'}</Typography>
                <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                  <Typography variant="body2">{jam.summary?.uniqueParticipantsCount ?? 0} musiciens</Typography>
                  <Typography variant="body2">{jam.summary?.playedPlateausCount ?? 0} plateaux joués</Typography>
                </Stack>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Button startIcon={<OpenInNew />} onClick={() => navigate(`/jams/${jam.jamId}`)}>Ouvrir</Button>
                <Button color="error" startIcon={<DeleteOutline />} onClick={() => setJamToDelete(jam)}>Supprimer</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ConfirmDialog
        open={Boolean(jamToDelete)}
        title="Supprimer cette jam ?"
        description="La jam sera archivée. Son historique d’events reste conservé."
        confirmLabel="Supprimer"
        onCancel={() => setJamToDelete(null)}
        onConfirm={() => deleteMutation.mutate(jamToDelete.jamId)}
      />
    </Stack>
  );
}
