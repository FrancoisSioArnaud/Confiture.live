import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { deleteJam, fetchJams } from "../../../shared/api/jamsApi";
import { designTokens } from "../../../theme";

function sortJamsByIndicativeDate(jams) {
  return [...jams].sort((left, right) => {
    if (!left.indicative_date && !right.indicative_date) return left.name.localeCompare(right.name);
    if (!left.indicative_date) return 1;
    if (!right.indicative_date) return -1;
    return left.indicative_date.localeCompare(right.indicative_date);
  });
}

export default function JamsListPage() {
  const queryClient = useQueryClient();
  const [jamToDelete, setJamToDelete] = useState(null);
  const { data: jams = [], isLoading, isError, error } = useQuery({
    queryKey: ["jams"],
    queryFn: fetchJams,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteJam,
    onSuccess: () => {
      setJamToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["jams"] });
    },
  });
  const sortedJams = sortJamsByIndicativeDate(jams);

  const handleCloseDeleteDialog = () => {
    if (!deleteMutation.isPending) {
      setJamToDelete(null);
      deleteMutation.reset();
    }
  };

  const handleConfirmDelete = () => {
    if (jamToDelete) {
      deleteMutation.mutate(jamToDelete.id);
    }
  };

  return (
    <Stack spacing={`${designTokens.spacing.lg}px`} component="section">
      <Stack spacing={`${designTokens.spacing.xs}px`}>
        <Typography variant="h1">Confiture</Typography>
        <Typography color="text.secondary">Liste des jams</Typography>
      </Stack>

      <Box>
        <Button component={RouterLink} to="/jams/new" variant="contained" startIcon={<AddRoundedIcon />}>
          Nouvelle jam
        </Button>
      </Box>

      {isLoading ? <CircularProgress aria-label="Chargement des jams" /> : null}
      {isError ? <Alert severity="error">{error.message}</Alert> : null}
      {deleteMutation.isError ? <Alert severity="error">{deleteMutation.error.message}</Alert> : null}

      {!isLoading && !isError && sortedJams.length === 0 ? (
        <Card>
          <CardContent>
            <Stack spacing={`${designTokens.spacing.md}px`}>
              <Typography>Aucune jam pour l’instant.</Typography>
              <Box>
                <Button component={RouterLink} to="/jams/new" variant="contained">Créer une jam</Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Stack spacing={`${designTokens.spacing.sm}px`}>
        {sortedJams.map((jam) => (
          <Card key={jam.id}>
            <CardContent>
              <Stack spacing={`${designTokens.spacing.md}px`}>
                <Stack spacing={`${designTokens.spacing.xs}px`}>
                  <Typography variant="h2">{jam.name}</Typography>
                  <Typography color="text.secondary">{jam.indicative_date ?? "Sans date"}</Typography>
                  <Typography color="text.secondary">
                    {jam.unique_musicians_count ?? 0} musiciens · {jam.participant_entries_count ?? 0} participations · {jam.played_plateaus_count ?? 0} plateaux joués
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={`${designTokens.spacing.sm}px`} justifyContent="flex-end" alignItems="center">
                  <Button component={RouterLink} to={`/jams/${jam.id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
                    Ouvrir
                  </Button>
                  <Tooltip title={`Supprimer ${jam.name}`}>
                    <IconButton aria-label={`Supprimer ${jam.name}`} onClick={() => setJamToDelete(jam)}>
                      <DeleteRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={Boolean(jamToDelete)} onClose={handleCloseDeleteDialog} aria-labelledby="delete-jam-title">
        <DialogTitle id="delete-jam-title">Supprimer cette jam ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La jam “{jamToDelete?.name}” sera supprimée définitivement.
          </DialogContentText>
          {deleteMutation.isError ? (
            <Alert severity="error" sx={{ mt: `${designTokens.spacing.md}px` }}>
              {deleteMutation.error.message}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteMutation.isPending}>Annuler</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleteMutation.isPending}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
