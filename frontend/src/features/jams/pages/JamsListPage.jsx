import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import { fetchJams } from "../../../shared/api/jamsApi";
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
  const { data: jams = [], isLoading, isError, error } = useQuery({
    queryKey: ["jams"],
    queryFn: fetchJams,
  });
  const sortedJams = sortJamsByIndicativeDate(jams);

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
          <Card key={jam.id} component={RouterLink} to={`/jams/${jam.id}`} sx={{ textDecoration: "none" }}>
            <CardContent>
              <Stack spacing={`${designTokens.spacing.xs}px`}>
                <Typography variant="h2">{jam.name}</Typography>
                <Typography color="text.secondary">{jam.indicative_date ?? "Sans date"}</Typography>
                <Typography color="text.secondary">
                  {jam.unique_musicians_count ?? 0} musiciens · {jam.participant_entries_count ?? 0} participations · {jam.played_plateaus_count ?? 0} plateaux joués
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
