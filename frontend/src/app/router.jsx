import { createBrowserRouter } from 'react-router-dom';
import { App } from '../App';
import { JamDetailPage } from '../features/jams/pages/JamDetailPage';
import { JamListPage } from '../features/jams/pages/JamListPage';
import { NewJamPage } from '../features/jams/pages/NewJamPage';

export const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <JamListPage /> },
    { path: 'jams/new', element: <NewJamPage /> },
    { path: 'jams/:jamId', element: <JamDetailPage /> },
  ]},
]);
