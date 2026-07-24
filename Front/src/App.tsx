import type { ReactNode } from 'react';
import { Layout } from './components/layout';
import Home from './pages/home';
import Map from './pages/map';
import Vote from './pages/vote';
import ServiceContrats from './pages/services&contrats';
import Event from './pages/event';
import Classement from './pages/classement';
import Incidents from './pages/incidents';
import Messagerie from './pages/messagerie';
import Login from './pages/login';
import Profil from './pages/profil';
import AdminPage from './pages/admin/AdminPage';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-1 font-semibold">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Réservé aux administrateurs : le rôle vient de /auth/me (donc validé via le token côté serveur).
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-1 font-semibold">
        Chargement…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="carte" element={<Map />} />
          <Route path="services" element={<ServiceContrats />} />
          <Route path="evenements" element={<Event />} />
          <Route path="messagerie" element={<Messagerie />} />
          <Route path="votes" element={<Vote />} />
          <Route path="classement" element={<Classement />} />
          <Route path="incidents" element={<Incidents />} />

          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />

          <Route path="profil" element={<Profil />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
