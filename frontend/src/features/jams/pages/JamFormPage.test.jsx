import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { muiTheme } from "../../../theme";
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
  const router = createMemoryRouter([{ path: "/jams/new", element: <JamFormPage mode="create" /> }], { initialEntries: ["/jams/new"] });
  render(
    <ThemeProvider theme={muiTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("JamFormPage", () => {
  it("creates a jam through the API", async () => {
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Nouvelle jam" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(createJam).toHaveBeenCalledWith(expect.objectContaining({
        name: "Nouvelle jam",
        indicativeDate: null,
        instrumentPayloads: expect.arrayContaining([expect.objectContaining({ name: "Chant", order: 0 })]),
      }));
    });
  });
});
