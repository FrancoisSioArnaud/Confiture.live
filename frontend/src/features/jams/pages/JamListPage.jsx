import { Alert, Box, Button, Card, CardActions, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { db } from '../../sync/localDb.js';
import { useLocalJams } from '../hooks/useLocalJams.js';
import { navigate } from '../../../shared/utils/navigation.js';

export function JamListPage() {
  const queryClient = useQueryClient();
  const { data: jams = [] } = useLocalJams();
  const [jamToDelete, setJamToDelete] = useState(null);
  const deleteMutation = useMutation({ mutationFn: async (jamId) => db.localJams.delete(jamId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['localJams'] }) });

  return <Container maxWidth="md" sx={{ py: 3 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box><Typography variant="h4">Confiture.live</Typography><Typography color="text.secondary">Jams sauvegardées sur cet appareil</Typography></Box>
      <Button variant="contained" onClick={() => navigate('/jams/new')}>Créer jam</Button>
    </Stack>
    {jams.length === 0 ? <Alert severity="info">Aucune jam locale pour le moment.</Alert> : <Stack spacing={2}>{jams.map((jam) => <Card key={jam.jamId} variant="outlined"><CardContent><Typography variant="h6">{jam.name}</Typography><Typography color="text.secondary">{jam.indicativeDate || 'Date indicative non définie'}</Typography></CardContent><CardActions><Button onClick={() => navigate(`/jams/${jam.jamId}`)}>Ouvrir</Button><Button color="error" onClick={() => setJamToDelete(jam)}>Supprimer</Button></CardActions></Card>)}</Stack>}
    <Dialog open={Boolean(jamToDelete)} onClose={() => setJamToDelete(null)}><DialogTitle>Supprimer cette jam locale ?</DialogTitle><DialogContent><DialogContentText>La suppression retire seulement la copie locale de cette jam.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setJamToDelete(null)}>Annuler</Button><Button color="error" onClick={() => { deleteMutation.mutate(jamToDelete.jamId); setJamToDelete(null); }}>Supprimer</Button></DialogActions></Dialog>
  </Container>;
}
