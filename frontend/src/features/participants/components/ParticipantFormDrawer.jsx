import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo } from "react";
import { z } from "zod";

import AppDrawer from "../../../shared/components/AppDrawer";
import { designTokens } from "../../../theme";

const participantSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  instrumentIds: z.array(z.string()).min(1, "Choisis au moins un instrument."),
  customInstrumentLabel: z.string().optional(),
  linkedPairs: z.array(z.string()).optional(),
});

function makeId(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "participant";
}

function buildPairs(instruments) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < instruments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < instruments.length; rightIndex += 1) {
      pairs.push([instruments[leftIndex], instruments[rightIndex]]);
    }
  }
  return pairs;
}

export default function ParticipantFormDrawer({
  open,
  onClose,
  jamState,
  insertionSelection,
  participant = null,
  onAddParticipant,
  onUpdateParticipant,
  onAddParticipantEntry,
  onUpdateParticipantEntry,
  onLinkItems,
}) {
  const isEditing = Boolean(participant);
  const preselectedInstrumentId = insertionSelection?.column.instrumentId;
  const participantEntries = useMemo(
    () => (participant ? jamState.entries.filter((entry) => entry.participantId === participant.id) : []),
    [jamState.entries, participant],
  );
  const existingNames = jamState.participants
    .filter((existingParticipant) => existingParticipant.id !== participant?.id)
    .map((existingParticipant) => existingParticipant.name.trim().toLowerCase());
  const { control, register, handleSubmit, watch, formState: { errors }, reset, setError } = useForm({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: "",
      instrumentIds: preselectedInstrumentId ? [preselectedInstrumentId] : [],
      customInstrumentLabel: "",
      linkedPairs: [],
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: participant?.name ?? "",
        instrumentIds: participantEntries.length > 0
          ? participantEntries.map((entry) => entry.instrumentId)
          : preselectedInstrumentId ? [preselectedInstrumentId] : [],
        customInstrumentLabel: participantEntries.find((entry) => entry.customInstrumentLabel)?.customInstrumentLabel ?? "",
        linkedPairs: [],
      });
    }
  }, [open, participant, participantEntries, preselectedInstrumentId, reset]);
  const instrumentIds = watch("instrumentIds");
  const selectedInstruments = jamState.instruments
    .filter((instrument) => instrumentIds.includes(instrument.id))
    .sort((left, right) => left.order - right.order);
  const selectedPairs = buildPairs(selectedInstruments);
  const otherInstrument = jamState.instruments.find((instrument) => (
    instrument.id === "other" || instrument.name === "Autre" || instrument.name === "Autres"
  ));
  const showCustomInstrument = otherInstrument && instrumentIds.includes(otherInstrument.id);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values) => {
    if (existingNames.includes(values.name.trim().toLowerCase())) {
      setError("name", { message: "Ce nom existe déjà dans cette jam. Ajoute une initiale ou un détail." });
      return;
    }

    const participantId = participant?.id ?? `participant-${makeId(values.name)}-${jamState.participants.length + 1}`;
    const entries = values.instrumentIds.map((instrumentId) => {
      const existingEntry = participantEntries.find((entry) => entry.instrumentId === instrumentId);
      return {
        id: existingEntry?.id ?? `entry-${participantId}-${instrumentId}`,
        jamId: jamState.jam.id,
        participantId,
        instrumentId,
        customInstrumentLabel: instrumentId === otherInstrument?.id ? values.customInstrumentLabel || null : null,
        baseOrder: existingEntry?.baseOrder ?? (insertionSelection?.column.instrumentId === instrumentId
          ? insertionSelection.rowIndex
          : jamState.entries.filter((entry) => entry.instrumentId === instrumentId).length),
      };
    });

    if (isEditing) {
      onUpdateParticipant?.({ participantId, updates: { name: values.name.trim() } });
      entries.forEach((entry) => {
        const existingEntry = participantEntries.find((candidate) => candidate.id === entry.id);
        if (!existingEntry) {
          onAddParticipantEntry?.({ entry });
        } else if (existingEntry.customInstrumentLabel !== entry.customInstrumentLabel) {
          onUpdateParticipantEntry?.({ entryId: entry.id, updates: { customInstrumentLabel: entry.customInstrumentLabel } });
        }
      });
    } else {
      onAddParticipant({
        participant: {
          id: participantId,
          jamId: jamState.jam.id,
          name: values.name.trim(),
          status: "active",
        },
        entries,
      });
    }

    for (const pairKey of values.linkedPairs ?? []) {
      const [leftInstrumentId, rightInstrumentId] = pairKey.split("+");
      const entryIds = entries
        .filter((entry) => entry.instrumentId === leftInstrumentId || entry.instrumentId === rightInstrumentId)
        .map((entry) => entry.id);
      if (entryIds.length === 2) {
        onLinkItems({ entryIds, holeIds: [] });
      }
    }

    handleClose();
  };

  return (
    <AppDrawer
      open={open}
      onClose={handleClose}
      title={isEditing ? "Modifier un participant" : "Ajouter un participant"}
      subtitle={isEditing ? "Édition rapide" : preselectedInstrumentId ? `${insertionSelection.column.name} précoché` : "Inscription musicien"}
      fullScreenOnMobile
      actions={(
        <>
          <Button onClick={handleClose}>Annuler</Button>
          <Button variant="contained" type="submit" form="participant-form">Valider</Button>
        </>
      )}
    >
      <Stack id="participant-form" component="form" spacing={`${designTokens.spacing.lg}px`} onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label="Nom"
          {...register("name")}
          error={Boolean(errors.name)}
          helperText={errors.name?.message}
          fullWidth
        />

        <Stack spacing={`${designTokens.spacing.sm}px`}>
          <Typography variant="subtitle2">Instruments</Typography>
          <Controller
            control={control}
            name="instrumentIds"
            render={({ field }) => (
              <Stack spacing={`${designTokens.spacing.xs}px`}>
                {[...jamState.instruments].sort((left, right) => left.order - right.order).map((instrument) => (
                  <FormControlLabel
                    key={instrument.id}
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
                  />
                ))}
              </Stack>
            )}
          />
          {errors.instrumentIds ? <Typography color="error">{errors.instrumentIds.message}</Typography> : null}
        </Stack>

        {showCustomInstrument ? (
          <TextField label="Instrument autre" {...register("customInstrumentLabel")} fullWidth />
        ) : null}

        {selectedPairs.length > 0 ? (
          <Stack spacing={`${designTokens.spacing.sm}px`}>
            <Typography variant="subtitle2">Faire passer en même temps ?</Typography>
            <Controller
              control={control}
              name="linkedPairs"
              render={({ field }) => (
                <Stack spacing={`${designTokens.spacing.xs}px`}>
                  {selectedPairs.map(([left, right]) => {
                    const value = `${left.id}+${right.id}`;
                    return (
                      <FormControlLabel
                        key={value}
                        control={(
                          <Checkbox
                            checked={field.value.includes(value)}
                            onChange={(event) => {
                              field.onChange(event.target.checked
                                ? [...field.value, value]
                                : field.value.filter((pairValue) => pairValue !== value));
                            }}
                          />
                        )}
                        label={`${left.name} + ${right.name}`}
                      />
                    );
                  })}
                </Stack>
              )}
            />
          </Stack>
        ) : null}
      </Stack>
    </AppDrawer>
  );
}
