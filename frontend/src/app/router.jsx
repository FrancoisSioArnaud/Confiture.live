import { createBrowserRouter } from "react-router-dom";

import App from "../App";
import JamFormPage from "../features/jams/pages/JamFormPage";
import JamsListPage from "../features/jams/pages/JamsListPage";
import JamTablePage from "../features/jams/pages/JamTablePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <JamsListPage /> },
      { path: "jams/new", element: <JamFormPage mode="create" /> },
      { path: "jams/:jamId", element: <JamTablePage /> },
      { path: "jams/:jamId/edit", element: <JamFormPage mode="edit" /> },
    ],
  },
]);
