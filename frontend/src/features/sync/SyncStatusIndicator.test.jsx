import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { muiTheme } from "../../theme";
import SyncStatusIndicator from "./SyncStatusIndicator";
import { syncStatuses } from "./syncQueue";
import { syncStatusLabel } from "./useSyncStatus";

function renderIndicator(statusOverride) {
  render(
    <ThemeProvider theme={muiTheme}>
      <SyncStatusIndicator jamId="jam-1" statusOverride={statusOverride} />
    </ThemeProvider>,
  );
}

describe("SyncStatusIndicator", () => {
  it("displays the synced label", () => {
    renderIndicator(syncStatuses.synced);
    expect(screen.getByText("Synchronisé")).toBeInTheDocument();
  });

  it("displays pending, offline and error labels", () => {
    expect(syncStatusLabel(syncStatuses.pending)).toBe("Synchronisation en attente");
    expect(syncStatusLabel(syncStatuses.offline)).toBe("Hors ligne — sauvegarde locale");
    expect(syncStatusLabel(syncStatuses.error)).toBe("Synchronisation à vérifier");
    expect(syncStatusLabel(syncStatuses.error)).not.toMatch(/connexion/i);
  });
});
