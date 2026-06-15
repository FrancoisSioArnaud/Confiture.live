import { Outlet } from 'react-router-dom';
import { AppShell } from './shared/components/AppShell';

export function App() {
  return <AppShell><Outlet /></AppShell>;
}
