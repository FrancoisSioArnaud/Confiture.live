import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function AppShell({ children }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64, sm: 72 } }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 900, minWidth: 0 }} noWrap>Confiture.live</Typography>
          <Button component={RouterLink} to="/" color="inherit" sx={{ minWidth: 56 }}>Jams</Button>
          <Button component={RouterLink} to="/jams/new" variant="contained" size="small" sx={{ minWidth: 88 }}>Créer</Button>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 1.5, sm: 4 }, px: { xs: 1.25, sm: 3 } }}>{children}</Container>
    </Box>
  );
}
