import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, IconButton, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { fetchJam, createJam, toJamState, updateJam as updateJamApi } from "../../../shared/api/jamsApi";
import { useJamTableStore } from "../../jamTable/store/useJamTableStore.js";
import { designTokens } from "../../../theme";

const jamSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  indicativeDate: z.string().optional(),
  activeInstrumentIds: z.array(z.string()).min(1, "Choisis au moins un instrument."),
  customInstrumentName: z.string().optional(),
});

const defaultInstrumentNames = ["Chant", "Guitare", "Basse", "Batterie", "Piano", "Autres"];

function makeInstrumentId(name) {
  return `instrument-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function JamFormPage({ mode = "create" }) {
  const { jamId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const jamState = useJamTableStore((state) => state.jamState);
  const stats = useJamTableStore((state) => state.projectedTable.stats);
  const loadJamState = useJamTableStore((state) => state.loadJamState);
  const updateJamLocal = useJamTableStore((state) => state.updateJam);
  const addInstrument = useJamTableStore((state) => state.addInstrument);
  const reorderInstruments = useJamTableStore((state) => state.reorderInstruments);
  const sortedInstruments = [...jamState.instruments].sort((left, right) => left.order - right.order);
  const { data: apiJam, isLoading, isError, error } = useQuery({
    queryKey: ["jam", jamId],
    queryFn: () => fetchJam(jamId),
    enabled: mode === "edit" && Boolean(jamId),
  });
  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(jamSchema),
    defaultValues: {
      name: "",
      indicativeDate: "",
      activeInstrumentIds: sortedInstruments.map((instrument) => instrument.id),
      customInstrumentName: "",
    },
  });
  const activeInstrumentIds = watch("activeInstrumentIds");
  const createMutation = useMutation({
    mutationFn: createJam,
    onSuccess: (createdJam) => {
      queryClient.invalidateQueries({ queryKey: ["jams"] });
      navigate(`/jams/${createdJam.id}`);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (payload) => updateJamApi(jamId, payload),
    onSuccess: (updatedJam) => {
      queryClient.invalidateQueries({ queryKey: ["jams"] });
      queryClient.setQueryData(["jam", jamId], updatedJam);
      navigate(`/jams/${jamId}`);
    },
  });

  useEffect(() => {
    if (apiJam) {
      const nextJamState = toJamState(apiJam);
      loadJamState(nextJamState);
      reset({
        name: nextJamState.jam.name,
        indicativeDate: nextJamState.jam.indicativeDate ?? "",
        activeInstrumentIds: nextJamState.instruments.map((instrument) => instrument.id),
        customInstrumentName: "",
      });
    }
  }, [apiJam, loadJamState, reset]);

  const moveInstrument = (instrumentId, direction) => {
    const nextInstruments = [...sortedInstruments];
    const index = nextInstruments.findIndex((instrument) => instrument.id === instrumentId);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nextInstruments.length) {
      return;
    }
    const [instrument] = nextInstruments.splice(index, 1);
    nextInstruments.splice(targetIndex, 0, instrument);
    reorderInstruments({
      instrumentOrders: Object.fromEntries(nextInstruments.map((nextInstrument, nextIndex) => [nextInstrument.id, nextIndex])),
    });
  };

  const onSubmit = (values) => {
    const customInstrumentName = values.customInstrumentName?.trim();
    const submittedInstruments = [...sortedInstruments];

    if (customInstrumentName) {
      submittedInstruments.push({
        id: makeInstrumentId(customInstrumentName),
        name: customInstrumentName,
        order: submittedInstruments.length,
        isDefault: false,
      });
    }

    const selectedIds = new Set(values.activeInstrumentIds);
    if (customInstrumentName) {
      selectedIds.add(makeInstrumentId(customInstrumentName));
    }

    const instrumentPayloads = submittedInstruments
      .filter((instrument) => selectedIds.has(instrument.id))
      .map((instrument, order) => ({
        id: instrument.id,
        name: instrument.name,
        order,
        is_default: instrument.isDefault,
      }));
    const payload = { name: values.name.trim(), indicativeDate: values.indicativeDate || null, instrumentPayloads };

    if (mode === "create") {
      createMutation.mutate(payload);
      return;
    }

    updateJamLocal({ updates: payload });

    if (customInstrumentName) {
      addInstrument({
        instrument: {
          id: makeInstrumentId(customInstrumentName),
          name: customInstrumentName,
          order: jamState.instruments.length,
          isDefault: false,
        },
      });
      setValue("customInstrumentName", "");
    }

    updateMutation.mutate(payload);
  };

  if (mode === "edit" && isLoading) {
    return <CircularProgress aria-label="Chargement de la jam" />;
  }

  return (
    <Stack spacing={`${designTokens.spacing.lg}px`} component="section">
      <Stack spacing={`${designTokens.spacing.xs}px`}>
        <Typography variant="h1">{mode === "edit" ? "Modifier la jam" : "Nouvelle jam"}</Typography>
        <Typography color="text.secondary">
          Instruments par défaut : {defaultInstrumentNames.join(", ")}.
        </Typography>
      </Stack>

      {isError ? <Alert severity="error">{error.message}</Alert> : null}
      {createMutation.isError ? <Alert severity="error">{createMutation.error.message}</Alert> : null}
      {updateMutation.isError ? <Alert severity="warning">Synchronisation en attente — {updateMutation.error.message}</Alert> : null}

      {mode === "edit" ? (
        <Card>
          <CardContent>
            <Stack spacing={`${designTokens.spacing.xs}px`}>
              <Typography variant="subtitle2">Stats</Typography>
              <Typography>{stats.uniqueMusiciansCount} musiciens uniques</Typography>
              <Typography>{stats.participantEntriesCount} participations instrumentales</Typography>
              <Typography>{stats.playedPlateausCount} plateaux joués</Typography>
              <Typography>{stats.unplayedActiveEntriesCount} participations actives n’ayant jamais joué</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Stack component="form" spacing={`${designTokens.spacing.lg}px`} onSubmit={handleSubmit(onSubmit)}>
        <TextField label="Nom" {...register("name")} error={Boolean(errors.name)} helperText={errors.name?.message} fullWidth />
        <TextField label="Date indicative" type="date" {...register("indicativeDate")} InputLabelProps={{ shrink: true }} fullWidth />

        <Stack spacing={`${designTokens.spacing.sm}px`}>
          <Typography variant="subtitle2">Instruments actifs et ordre</Typography>
          <Controller
            control={control}
            name="activeInstrumentIds"
            render={({ field }) => (
              <Stack spacing={`${designTokens.spacing.xs}px`}>
                {sortedInstruments.map((instrument) => (
                  <Stack key={instrument.id} direction="row" alignItems="center" spacing={`${designTokens.spacing.sm}px`}>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={field.value.includes(instrument.id)}
                          onChange={(event) => {
                            field.onChange(event.target.checked
                              ? [...field.value, instrument.id]
                              : field.value.filter((instrumentId) => instrumentId !== instrument.id));
                          }}
                        />
                      )}
                      label={instrument.name}
                      sx={{ flex: 1 }}
                    />
                    <IconButton aria-label={`Monter ${instrument.name}`} onClick={() => moveInstrument(instrument.id, -1)}>
                      <ArrowUpwardRoundedIcon />
                    </IconButton>
                    <IconButton aria-label={`Descendre ${instrument.name}`} onClick={() => moveInstrument(instrument.id, 1)}>
                      <ArrowDownwardRoundedIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          />
          {errors.activeInstrumentIds ? <Typography color="error">{errors.activeInstrumentIds.message}</Typography> : null}
          <Typography variant="caption" color="text.secondary">
            {activeInstrumentIds.length} colonne(s) active(s) pour cette version locale.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={`${designTokens.spacing.sm}px`}>
          <TextField label="Instrument custom" {...register("customInstrumentName")} fullWidth />
          <Button type="submit" variant="contained" startIcon={<AddRoundedIcon />} disabled={createMutation.isPending || updateMutation.isPending}>
            Enregistrer
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
