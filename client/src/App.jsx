import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import { initApi } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import Profile from './pages/Profile';

export default function App() {
  const { accessToken, setToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    initApi(() => useAuthStore.getState().accessToken, setToken);
  }, []);

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/lobby" /> : <Landing />} />
      <Route path="/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      <Route path="/room/:code" element={<ProtectedRoute><Room /></ProtectedRoute>} />
      <Route path="/game/:code" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
