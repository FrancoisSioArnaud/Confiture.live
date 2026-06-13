import { useEffect, useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getEditingLockIdentity, lockEditing, unlockEditing } from "../../../shared/api/jamsApi";
import { createClientAction, loadJamLocalFirst, startSyncRetry, syncAction } from "../../sync/syncQueue";
import SyncStatusIndicator from "../../sync/SyncStatusIndicator";
import JamTable from "../../jamTable/components/JamTable";
import { actionTypes } from "../../jamTable/engine/actionTypes.js";
import { projectJamTable } from "../../jamTable/engine/projectJamTable.js";
import { useJamTableStore } from "../../jamTable/store/useJamTableStore.js";
import { designTokens } from "../../../theme";

function buildPlateauPayload(projection, payload) {
  const row = projection.rows.find((candidate) => candidate.rowIndex === payload.lineIndex);
  if (!row) return payload;

  const cells = Object.values(row.cells);
  return {
    ...payload,
    slotIds: cells
      .filter((cell) => cell.type !== "empty" && cell.slotId && !cell.isPlayed)
      .map((cell) => cell.slotId),
    participantEntryIds: cells
      .filter((cell) => cell.type === "entry" && cell.entryId && !cell.isPlayed)
      .map((cell) => cell.entryId),
    holeIds: cells
      .filter((cell) => cell.type === "hole" && cell.holeId && !cell.isPlayed)
      .map((cell) => cell.holeId),
  };
}

function buildSyncedPayload(type, payload, apiPayload, previousProjection, nextJamState) {
  if (type === actionTypes.ADD_HOLE && !apiPayload.hole) {
    return {
      hole: nextJamState.holes.find((hole) => (
        hole.id === payload.id
        || (hole.instrumentId === payload.instrumentId && hole.position === payload.position)
      )),
    };
  }

  if (type === actionTypes.MARK_PLATEAU_PLAYED) {
    return buildPlateauPayload(previousProjection, apiPayload);
  }

  return apiPayload;
}

export default function JamTablePage() {
  const { jamId } = useParams();
  const lockIdentity = useMemo(() => (jamId ? getEditingLockIdentity(jamId) : null), [jamId]);
  const [editLockStatus, setEditLockStatus] = useState("locking");
  const [editLockMessage, setEditLockMessage] = useState(null);
  const jamState = useJamTableStore((state) => state.jamState);
  const storedProjection = useJamTableStore((state) => state.projectedTable);
  const [visibleRoundDepthByInstrument, setVisibleRoundDepthByInstrument] = useState({});
  const projection = useMemo(() => projectJamTable(jamState, { visibleRoundDepthByInstrument }), [jamState, visibleRoundDepthByInstrument]);
  const drawerOpen = useJamTableStore((state) => state.drawerOpen);
  const insertionSelection = useJamTableStore((state) => state.insertionSelection);
  const linkMode = useJamTableStore((state) => state.linkMode);
  const syncStatus = useJamTableStore((state) => state.syncStatus);
  const loadJamState = useJamTableStore((state) => state.loadJamState);
  const setSyncStatus = useJamTableStore((state) => state.setSyncStatus);
  const openCallDrawer = useJamTableStore((state) => state.openCallDrawer);
  const closeDrawer = useJamTableStore((state) => state.closeDrawer);
  const openParticipantDrawer = useJamTableStore((state) => state.openParticipantDrawer);
  const openParticipantEditDrawer = useJamTableStore((state) => state.openParticipantEditDrawer);
  const openWantsToPlayWithoutDrawer = useJamTableStore((state) => state.openWantsToPlayWithoutDrawer);
  const openUnavailableReplacementDrawer = useJamTableStore((state) => state.openUnavailableReplacementDrawer);
  const setInsertionSelection = useJamTableStore((state) => state.setInsertionSelection);
  const clearInsertionSelection = useJamTableStore((state) => state.clearInsertionSelection);
  const addParticipant = useJamTableStore((state) => state.addParticipant);
  const updateParticipant = useJamTableStore((state) => state.updateParticipant);
  const addParticipantEntry = useJamTableStore((state) => state.addParticipantEntry);
  const updateParticipantEntry = useJamTableStore((state) => state.updateParticipantEntry);
  const addHole = useJamTableStore((state) => state.addHole);
  const removeHole = useJamTableStore((state) => state.removeHole);
  const markEntryPlayed = useJamTableStore((state) => state.markEntryPlayed);
  const markPlateauPlayed = useJamTableStore((state) => state.markPlateauPlayed);
  const undoEntryPlayed = useJamTableStore((state) => state.undoEntryPlayed);
  const markParticipantLeft = useJamTableStore((state) => state.markParticipantLeft);
  const wantsToPlayWithout = useJamTableStore((state) => state.wantsToPlayWithout);
  const replaceUnavailable = useJamTableStore((state) => state.replaceUnavailable);
  const moveEntryVertical = useJamTableStore((state) => state.moveEntryVertical);
  const moveRoundSlotVertical = useJamTableStore((state) => state.moveRoundSlotVertical);
  const ensureRoundSlots = useJamTableStore((state) => state.ensureRoundSlots);
  const startLinkMode = useJamTableStore((state) => state.startLinkMode);
  const toggleLinkSelection = useJamTableStore((state) => state.toggleLinkSelection);
  const cancelLinkMode = useJamTableStore((state) => state.cancelLinkMode);
  const linkItems = useJamTableStore((state) => state.linkItems);
  const unlinkItems = useJamTableStore((state) => state.unlinkItems);
  const { data: loadedJam, isLoading, isError, error } = useQuery({
    queryKey: ["jam-local-first", jamId],
    queryFn: () => loadJamLocalFirst({ jamId }),
    enabled: Boolean(jamId),
    retry: false,
  });

  useEffect(() => {
    if (jamId) {
      try {
        setVisibleRoundDepthByInstrument(JSON.parse(localStorage.getItem(`confiture.visibleRoundDepthByInstrument.${jamId}`) ?? "{}"));
      } catch {
        setVisibleRoundDepthByInstrument({});
      }
    }
  }, [jamId]);

  useEffect(() => {
    if (loadedJam?.jamState) {
      loadJamState(loadedJam.jamState);
      setSyncStatus(loadedJam.syncStatus);
    }
  }, [loadedJam, loadJamState, setSyncStatus]);

  useEffect(() => {
    if (!jamId || !lockIdentity) return undefined;

    let isMounted = true;
    let hasLock = false;
    setEditLockStatus("locking");
    setEditLockMessage(null);

    const releaseLock = () => {
      if (hasLock) {
        unlockEditing(jamId, lockIdentity).catch(() => {});
      }
    };

    lockEditing(jamId, lockIdentity)
      .then(() => {
        hasLock = true;
        if (isMounted) {
          setEditLockStatus("locked");
        } else {
          releaseLock();
        }
      })
      .catch((lockError) => {
        if (!isMounted) return;
        setEditLockStatus(lockError.status === 423 ? "blocked" : "error");
        setEditLockMessage(lockError.message);
      });

    window.addEventListener("pagehide", releaseLock);

    return () => {
      isMounted = false;
      window.removeEventListener("pagehide", releaseLock);
      releaseLock();
    };
  }, [jamId, lockIdentity]);

  useEffect(() => {
    if (!jamId || editLockStatus !== "locked") return undefined;
    return startSyncRetry({
      jamId,
      onStatusChange: setSyncStatus,
      onJamStateChange: loadJamState,
    });
  }, [editLockStatus, jamId, loadJamState, setSyncStatus]);

  const runAction = (type, localAction, payload, apiPayload = payload) => {
    const previousProjection = projection;
    localAction(payload);

    const nextJamState = useJamTableStore.getState().jamState;
    const syncedPayload = buildSyncedPayload(type, payload, apiPayload, previousProjection, nextJamState);

    const action = createClientAction(type, syncedPayload);
    syncAction({ jamId, action, jamState: nextJamState })
      .then((result) => {
        setSyncStatus(result.status);
        if (result.jamState) {
          loadJamState(result.jamState);
        }
      })
      .catch(() => {
        setSyncStatus("error");
      });
  };

  const actions = {
    onAddParticipant: (payload) => runAction(actionTypes.ADD_PARTICIPANT, addParticipant, payload),
    onUpdateParticipant: (payload) => runAction(actionTypes.UPDATE_PARTICIPANT, updateParticipant, payload),
    onAddParticipantEntry: (payload) => runAction(actionTypes.ADD_PARTICIPANT_ENTRY, addParticipantEntry, payload),
    onUpdateParticipantEntry: (payload) => runAction(actionTypes.UPDATE_PARTICIPANT_ENTRY, updateParticipantEntry, payload),
    onAddHole: (payload) => runAction(actionTypes.ADD_HOLE, addHole, payload),
    onRemoveHole: (payload) => runAction(actionTypes.REMOVE_HOLE, removeHole, payload),
    onMarkEntryPlayed: (payload) => runAction(actionTypes.MARK_ENTRY_PLAYED, markEntryPlayed, payload),
    onMarkPlateauPlayed: (payload) => runAction(actionTypes.MARK_PLATEAU_PLAYED, markPlateauPlayed, payload),
    onUndoEntryPlayed: (payload) => runAction(actionTypes.UNDO_ENTRY_PLAYED, undoEntryPlayed, payload),
    onMarkParticipantLeft: (participantId) => runAction(actionTypes.MARK_PARTICIPANT_LEFT, markParticipantLeft, participantId, { participantId }),
    onWantsToPlayWithout: (payload) => runAction(actionTypes.WANTS_TO_PLAY_WITHOUT, wantsToPlayWithout, payload),
    onReplaceUnavailable: (payload) => runAction(actionTypes.REPLACE_UNAVAILABLE, replaceUnavailable, payload),
    onMoveEntryVertical: (payload) => runAction(payload.slotId ? actionTypes.MOVE_ROUND_SLOT_VERTICAL : actionTypes.MOVE_ENTRY_VERTICAL, payload.slotId ? moveRoundSlotVertical : moveEntryVertical, payload),
    onLinkItems: (payload) => runAction(actionTypes.LINK_ITEMS, linkItems, payload),
    onEnsureRoundSlots: ({ instrumentId, roundNumber }) => {
      setVisibleRoundDepthByInstrument((current) => {
        const next = { ...current, [instrumentId]: roundNumber };
        localStorage.setItem(`confiture.visibleRoundDepthByInstrument.${jamId}`, JSON.stringify(next));
        return next;
      });
      runAction(actionTypes.ENSURE_ROUND_SLOTS, ensureRoundSlots, { instrumentId, roundNumber });
    },
  };

  const handleValidateLinkMode = () => {
    const selectedCount = linkMode.selectedEntryIds.length + linkMode.selectedHoleIds.length;

    if (selectedCount > 1) {
      runAction(actionTypes.LINK_ITEMS, linkItems, {
        entryIds: linkMode.selectedEntryIds,
        holeIds: linkMode.selectedHoleIds,
      });
    } else if (linkMode.source?.linkGroupId) {
      runAction(actionTypes.UNLINK_ITEMS, unlinkItems, { linkGroupId: linkMode.source.linkGroupId });
    }

    cancelLinkMode();
  };

  if (editLockStatus === "blocked") {
    return (
      <Stack spacing={`${designTokens.spacing.md}px`} component="section">
        <Typography variant="h1">Jam déjà ouverte</Typography>
        <Alert severity="warning">
          Cette jam est déjà ouverte en édition sur un autre appareil.
          <br />
          Réessaie plus tard.
        </Alert>
      </Stack>
    );
  }

  if (editLockStatus === "error") {
    return (
      <Stack spacing={`${designTokens.spacing.md}px`} component="section">
        <Typography variant="h1">Verrouillage indisponible</Typography>
        <Alert severity="error">{editLockMessage ?? "Impossible de vérifier le verrou d’édition."}</Alert>
      </Stack>
    );
  }

  if (isLoading || editLockStatus === "locking") {
    return <CircularProgress aria-label="Chargement de la jam" />;
  }

  return (
    <Stack spacing={`${designTokens.spacing.lg}px`} component="section">
      <Stack spacing={`${designTokens.spacing.sm}px`}>
        <Typography variant="h1">{jamState.jam.name}</Typography>
        <Stack direction="row" spacing={`${designTokens.spacing.sm}px`} alignItems="center" flexWrap="wrap" useFlexGap>
          <SyncStatusIndicator jamId={jamId} />
          <Typography variant="body2" color="text.secondary">
            {projection.stats.uniqueMusiciansCount} musiciens
          </Typography>
        </Stack>
        {isError ? <Alert severity="warning">Chargement API impossible — {error.message}</Alert> : null}
        {syncStatus === "error" ? <Alert severity="warning">Action gardée localement. Le serveur n’a pas encore validé la synchronisation.</Alert> : null}
      </Stack>

      <Box sx={{ mx: { xs: `-${designTokens.spacing.lg}px`, sm: 0 } }}>
        <JamTable
          jamState={jamState}
          projection={projection}
          drawerOpen={drawerOpen}
          insertionSelection={insertionSelection}
          linkMode={linkMode}
          onOpenCallDrawer={openCallDrawer}
          onCloseDrawer={closeDrawer}
          onOpenParticipantDrawer={openParticipantDrawer}
          onOpenParticipantEditDrawer={openParticipantEditDrawer}
          onOpenWantsToPlayWithoutDrawer={openWantsToPlayWithoutDrawer}
          onOpenUnavailableReplacementDrawer={openUnavailableReplacementDrawer}
          onSetInsertionSelection={setInsertionSelection}
          onClearInsertionSelection={clearInsertionSelection}
          onStartLinkMode={startLinkMode}
          onToggleLinkSelection={toggleLinkSelection}
          onCancelLinkMode={cancelLinkMode}
          onValidateLinkMode={handleValidateLinkMode}
          {...actions}
        />
      </Box>
    </Stack>
  );
}
