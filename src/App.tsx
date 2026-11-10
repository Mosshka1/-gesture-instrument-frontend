import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Instrument from './pages/Instrument';
import Modes from './pages/Modes';
import Presets from './pages/Presets';
import Profile from './pages/Profile';
import Tutorial from './pages/Tutorial';
import Recordings from './pages/Recordings';
import Sounds from './pages/Sounds';
import SharedRecording from './pages/SharedRecording';
import Legal from './pages/Legal';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/s/:token" element={<SharedRecording />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/play" element={<Instrument />} />
          <Route path="/modes" element={<Modes />} />
          <Route path="/presets" element={<Presets />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/sounds" element={<Sounds />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/play" />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
