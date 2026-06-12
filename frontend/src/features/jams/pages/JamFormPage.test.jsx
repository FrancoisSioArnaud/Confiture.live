import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
import { useJamTableStore } from "../../jamTable/store/useJamTableStore.js";
import JamFormPage from "./JamFormPage";
import { createJam } from "../../../shared/api/jamsApi";

vi.mock("../../../shared/api/jamsApi", async () => {
  const actual = await vi.importActual("../../../shared/api/jamsApi");
  return {
    ...actual,
    createJam: vi.fn(async () => ({ id: 42, name: "Nouvelle jam" })),
    fetchJam: vi.fn(),
    updateJam: vi.fn(),
  };
});

function renderCreatePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([
    { path: "/jams/new", element: <JamFormPage mode="create" /> },
    { path: "/jams/:jamId", element: <div>Jam créée</div> },
  ], { initialEntries: ["/jams/new"] });
  render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

function loadPreviousJamWithCustomInstrument() {
  useJamTableStore.getState().loadJamState({
    jam: { id: "previous-jam", name: "Jam précédente", indicativeDate: null },
    instruments: [
      { id: "vocal", name: "Chant", order: 0, isDefault: true },
      { id: "sax", name: "Saxophone", order: 1, isDefault: false },
    ],
    participants: [],
    entries: [],
    linkGroups: [],
    holes: [],
    playedPassages: [],
  });
}

describe("JamFormPage", () => {
  beforeEach(() => {
    createJam.mockClear();
  });

  it("creates a jam through the API", async () => {
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Nom de la jam"), { target: { value: "Nouvelle jam" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la jam" }));

    await waitFor(() => {
      expect(createJam).toHaveBeenCalledWith(expect.objectContaining({
        name: "Nouvelle jam",
        indicativeDate: null,
        instrumentPayloads: expect.arrayContaining([expect.objectContaining({ name: "Chant", order: 0 })]),
      }), expect.anything());
    });
  });

  it("shows the default creation instruments and active instrument count", () => {
    renderCreatePage();

    expect(screen.getByText("Instruments par défaut : Chant, Guitare, Basse, Batterie, Piano, Autre.")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").map((checkbox) => checkbox.getAttribute("name") ?? checkbox.labels[0].textContent)).toEqual([
      "Chant",
      "Guitare",
      "Basse",
      "Batterie",
      "Piano",
      "Autre",
    ]);
    expect(screen.getByText("6 instruments actifs")).toBeInTheDocument();
  });


  it("adds a custom instrument inline before creating the jam", async () => {
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Nom de la jam"), { target: { value: "Nouvelle jam" } });
    fireEvent.change(screen.getByPlaceholderText("Ajouter un instrument"), { target: { value: "Saxophone" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter l’instrument" }));

    expect(createJam).not.toHaveBeenCalled();
    const saxophoneCheckbox = screen.getByLabelText("Saxophone");
    expect(saxophoneCheckbox).toBeInTheDocument();
    expect(saxophoneCheckbox).toBeChecked();
    expect(screen.getByPlaceholderText("Ajouter un instrument")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Créer la jam" }));

    await waitFor(() => {
      expect(createJam).toHaveBeenCalledWith(expect.objectContaining({
        instrumentPayloads: expect.arrayContaining([expect.objectContaining({
          id: "instrument-saxophone",
          name: "Saxophone",
          is_default: false,
        })]),
      }), expect.anything());
    });
  });

  it("does not reuse instruments from a previously loaded jam in create mode", () => {
    loadPreviousJamWithCustomInstrument();

    renderCreatePage();

    expect(screen.getByLabelText("Chant")).toBeInTheDocument();
    expect(screen.getByLabelText("Guitare")).toBeInTheDocument();
    expect(screen.getByLabelText("Basse")).toBeInTheDocument();
    expect(screen.getByLabelText("Batterie")).toBeInTheDocument();
    expect(screen.getByLabelText("Piano")).toBeInTheDocument();
    expect(screen.getByLabelText("Autre")).toBeInTheDocument();
    expect(screen.queryByText("Saxophone")).not.toBeInTheDocument();
  });
});
