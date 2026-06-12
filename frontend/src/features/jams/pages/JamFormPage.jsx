import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { fetchJam, createJam, toJamState, updateJam as updateJamApi } from "../../../shared/api/jamsApi";
import { useJamTableStore } from "../../jamTable/store/useJamTableStore.js";
import { designTokens } from "../../../theme";
import { DEFAULT_JAM_INSTRUMENT_NAMES, DEFAULT_JAM_INSTRUMENTS, getDefaultJamInstruments } from "../defaultInstruments.js";

const jamSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  indicativeDate: z.string().optional(),
  activeInstrumentIds: z.array(z.string()).min(1, "Choisis au moins un instrument."),
  customInstrumentName: z.string().optional(),
});


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
  const [createInstruments, setCreateInstruments] = useState(() => getDefaultJamInstruments());
  const sortedInstruments = mode === "create"
    ? createInstruments
    : [...jamState.instruments].sort((left, right) => left.order - right.order);
  const { data: apiJam, isLoading, isError, error } = useQuery({
    queryKey: ["jam", jamId],
    queryFn: () => fetchJam(jamId),
    enabled: mode === "edit" && Boolean(jamId),
  });
  const { control, register, handleSubmit, watch, setValue, reset, setError, clearErrors, formState: { errors } } = useForm({
    resolver: zodResolver(jamSchema),
    defaultValues: {
      name: "",
      indicativeDate: "",
      activeInstrumentIds: mode === "create"
        ? DEFAULT_JAM_INSTRUMENTS.map((instrument) => instrument.id)
        : sortedInstruments.map((instrument) => instrument.id),
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
    if (mode === "create") {
      setCreateInstruments(getDefaultJamInstruments());
      reset({
        name: "",
        indicativeDate: "",
        activeInstrumentIds: DEFAULT_JAM_INSTRUMENTS.map((instrument) => instrument.id),
        customInstrumentName: "",
      });
    }
  }, [mode, reset]);

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
    const reorderedInstruments = nextInstruments.map((nextInstrument, nextIndex) => ({
      ...nextInstrument,
      order: nextIndex,
    }));

    if (mode === "create") {
      setCreateInstruments(reorderedInstruments);
      return;
    }

    reorderInstruments({
      instrumentOrders: Object.fromEntries(reorderedInstruments.map((nextInstrument) => [nextInstrument.id, nextInstrument.order])),
    });
  };

  const handleAddCustomInstrument = () => {
    const customInstrumentName = watch("customInstrumentName")?.trim();
    if (!customInstrumentName) {
      return;
    }

    const id = makeInstrumentId(customInstrumentName);
    const duplicate = sortedInstruments.some((instrument) => (
      instrument.id === id || instrument.name.trim().toLowerCase() === customInstrumentName.toLowerCase()
    ));

    if (duplicate) {
      setError("customInstrumentName", { type: "manual", message: "Cet instrument existe déjà." });
      return;
    }

    const nextInstrument = {
      id,
      name: customInstrumentName,
      order: sortedInstruments.length,
      isDefault: false,
    };

    if (mode === "create") {
      setCreateInstruments((currentInstruments) => [...currentInstruments, nextInstrument]);
    } else {
      addInstrument({ instrument: nextInstrument });
    }

    setValue("activeInstrumentIds", [...activeInstrumentIds, id], { shouldDirty: true, shouldValidate: true });
    setValue("customInstrumentName", "", { shouldDirty: true });
    clearErrors("customInstrumentName");
  };

  const onSubmit = (values) => {
    const selectedIds = new Set(values.activeInstrumentIds);
    const instrumentPayloads = sortedInstruments
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
          Instruments par défaut : {DEFAULT_JAM_INSTRUMENT_NAMES.join(", ")}.
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
        <TextField label="Nom de la jam" placeholder="Nom de la jam" {...register("name")} error={Boolean(errors.name)} helperText={errors.name?.message} fullWidth />
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
            {activeInstrumentIds.length} {activeInstrumentIds.length === 1 ? "instrument actif" : "instruments actifs"}
          </Typography>
        </Stack>

        <TextField
          label="Instrument custom"
          placeholder="Ajouter un instrument"
          {...register("customInstrumentName")}
          error={Boolean(errors.customInstrumentName)}
          helperText={errors.customInstrumentName?.message}
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  aria-label="Ajouter l’instrument"
                  onClick={handleAddCustomInstrument}
                  disabled={!watch("customInstrumentName")?.trim()}
                  edge="end"
                >
                  <AddRoundedIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
          {mode === "create" ? "Créer la jam" : "Enregistrer"}
        </Button>
      </Stack>
    </Stack>
  );
}
