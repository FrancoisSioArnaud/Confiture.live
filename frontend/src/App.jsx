import { Container } from "@mui/material";
import { Outlet } from "react-router-dom";

import { designTokens } from "./theme";

export default function App() {
  return (
    <Container
      maxWidth="md"
      sx={{
        minHeight: "100vh",
        py: { xs: `${designTokens.spacing.lg}px`, sm: `${designTokens.spacing.xl}px` },
      }}
    >
      <Outlet />
    </Container>
  );
}
