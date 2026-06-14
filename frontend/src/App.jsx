import { CssBaseline, ThemeProvider, Typography } from '@mui/material';
import { theme } from './app/theme.js';
export default function App(){return <ThemeProvider theme={theme}><CssBaseline/><main style={{padding:24}}><Typography variant="h4">Confiture.live</Typography><Typography>Socle event-sourcing local-first initialisé.</Typography></main></ThemeProvider>}
