import { Routes, Route, Navigate } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import VideosPage from './pages/VideosPage';
import VideoDetailPage from './pages/VideoDetailPage';
import GraphViewerPage from './pages/GraphViewerPage';
import SearchPage from './pages/SearchPage';
import ExportsPage from './pages/ExportsPage';
import LoginPage from './pages/LoginPage';
import './App.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!keycloak.authenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="videos/:id/graph" element={<GraphViewerPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="exports" element={<ExportsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
