import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import { lockEditing } from "../../../shared/api/jamsApi";
import { syncAction } from "../../sync/syncQueue";
import JamTablePage from "./JamTablePage";

vi.mock("../../jamTable/components/JamTable", () => ({
  default: ({ onMarkEntryPlayed, onMarkPlateauPlayed }) => (
    <>
      <button type="button" onClick={() => onMarkEntryPlayed({ entryId: "10" })}>mark played</button>
      <button type="button" onClick={() => onMarkPlateauPlayed({ lineIndex: 0 })}>plateau played</button>
    </>
  ),
}));

vi.mock("../../sync/SyncStatusIndicator", () => ({
  default: () => <span>Synchronisé</span>,
}));

vi.mock("../../sync/syncQueue", () => ({
  createClientAction: vi.fn((type, payload) => ({
    client_action_id: "client-action-1",
    type,
    payload,
    created_at: "2026-06-10T00:00:00.000Z",
  })),
  loadJamLocalFirst: vi.fn(async () => ({
    syncStatus: "synced",
    source: "backend",
    jamState: {
      jam: { id: "1", name: "Jam API", indicativeDate: "2026-06-12" },
      instruments: [{ id: "2", name: "Guitare", order: 0, isDefault: true }],
      participants: [{ id: "3", jamId: "1", name: "Nicolas", status: "active" }],
      entries: [{ id: "10", jamId: "1", participantId: "3", instrumentId: "2", customInstrumentLabel: null, baseOrder: 0 }],
      holes: [],
      linkGroups: [],
      playedPassages: [],
    },
  })),
  startSyncRetry: vi.fn(() => () => {}),
  syncAction: vi.fn(async () => ({ status: "synced", ok: true })),
}));

vi.mock("../../../shared/api/jamsApi", async () => {
  const actual = await vi.importActual("../../../shared/api/jamsApi");
  return {
    ...actual,
    getEditingLockIdentity: vi.fn(() => ({ clientId: "client-1", editingLockToken: "lock-1" })),
    lockEditing: vi.fn(async () => ({ status: "locked" })),
    unlockEditing: vi.fn(async () => ({ status: "unlocked" })),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: "/jams/:jamId", element: <JamTablePage /> }], { initialEntries: ["/jams/1"] });
  render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("JamTablePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockEditing.mockResolvedValue({ status: "locked" });
  });


  it("shows the musicians count without the route id", async () => {
    renderPage();

    expect(await screen.findByText("1 musiciens")).toBeInTheDocument();
    expect(screen.queryByText(/route 1/)).not.toBeInTheDocument();
  });

  it("queues and syncs table actions after applying them locally", async () => {
    renderPage();

    (await screen.findByRole("button", { name: "mark played" })).click();

    await waitFor(() => {
      expect(syncAction).toHaveBeenCalledWith(expect.objectContaining({
        jamId: "1",
        action: expect.objectContaining({
          type: "MARK_ENTRY_PLAYED",
          payload: { entryId: "10" },
        }),
      }));
    });
  });



  it("reloads the store with the authoritative jam returned after sync", async () => {
    syncAction.mockResolvedValueOnce({
      status: "synced",
      ok: true,
      jamState: {
        jam: { id: "1", name: "Jam API", indicativeDate: "2026-06-12" },
        instruments: [{ id: "2", name: "Guitare", order: 0, isDefault: true }],
        participants: [],
        entries: [],
        holes: [],
        linkGroups: [],
        playedPassages: [],
      },
    });

    renderPage();

    (await screen.findByRole("button", { name: "mark played" })).click();

    await waitFor(() => {
      expect(screen.getByText("0 musiciens")).toBeInTheDocument();
    });
  });

  it("queues plateau actions with the projected row entry ids for the backend", async () => {
    renderPage();

    (await screen.findByRole("button", { name: "plateau played" })).click();

    await waitFor(() => {
      expect(syncAction).toHaveBeenCalledWith(expect.objectContaining({
        action: expect.objectContaining({
          type: "MARK_PLATEAU_PLAYED",
          payload: expect.objectContaining({
            lineIndex: 0,
            participantEntryIds: ["10"],
          }),
        }),
      }));
    });
  });

  it("shows a blocking message when the edit lock is refused", async () => {
    const lockError = new Error("Cette jam est déjà ouverte en édition sur un autre appareil.");
    lockError.status = 423;
    lockEditing.mockRejectedValueOnce(lockError);

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Cette jam est déjà ouverte en édition sur un autre appareil.");
    expect(alert).toHaveTextContent("Réessaie plus tard.");
    expect(screen.queryByRole("button", { name: "mark played" })).not.toBeInTheDocument();
  });
});
