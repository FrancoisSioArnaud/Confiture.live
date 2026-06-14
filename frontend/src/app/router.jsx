import { usePath } from '../shared/utils/navigation.js';
import { JamListPage } from '../features/jams/pages/JamListPage.jsx';
import { NewJamPage } from '../features/jams/pages/NewJamPage.jsx';
import { JamTablePage } from '../features/jams/pages/JamTablePage.jsx';

export function Router() {
  const path = usePath();
  if (path === '/jams/new') return <NewJamPage />;
  const jamMatch = path.match(/^\/jams\/([^/]+)$/);
  if (jamMatch) return <JamTablePage jamId={decodeURIComponent(jamMatch[1])} />;
  return <JamListPage />;
}
