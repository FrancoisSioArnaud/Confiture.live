import { screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createMemoryRouter } from "react-router-dom";

import App from "../App";

const renderHome = async () => {
  const { render } = await import("@testing-library/react");
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <App />,
        children: [
          {
            index: true,
            element: <div>Liste des jams</div>,
          },
        ],
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
};

describe("App", () => {
  it("renders routed content", async () => {
    await renderHome();

    expect(screen.getByText("Liste des jams")).toBeInTheDocument();
  });
});
