import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { Chip } from "@mui/material";

import { designTokens } from "../../theme";
import { syncStatuses } from "./syncQueue";
import { syncStatusLabel, useSyncStatus } from "./useSyncStatus";

function getStatusStyle(status) {
  if (status === syncStatuses.synced) {
    return { color: designTokens.colors.success, icon: <CheckRoundedIcon /> };
  }

  if (status === syncStatuses.offline) {
    return { color: designTokens.colors.warning, icon: <CloudOffRoundedIcon /> };
  }

  if (status === syncStatuses.error) {
    return { color: designTokens.colors.danger, icon: <ErrorOutlineRoundedIcon /> };
  }

  return { color: designTokens.colors.syncPendingText, icon: <SyncRoundedIcon /> };
}

export default function SyncStatusIndicator({ jamId, statusOverride }) {
  const { syncStatus } = useSyncStatus(jamId, { enabled: statusOverride === undefined });
  const status = statusOverride ?? syncStatus;
  const style = getStatusStyle(status);

  return (
    <Chip
      icon={style.icon}
      label={syncStatusLabel(status)}
      size="small"
      sx={{
        alignSelf: "flex-start",
        bgcolor: designTokens.colors.syncPendingBg,
        color: style.color,
        borderRadius: `${designTokens.tags.radius}px`,
        "& .MuiChip-icon": {
          color: style.color,
        },
      }}
    />
  );
}
