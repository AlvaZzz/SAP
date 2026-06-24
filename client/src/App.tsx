import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExercisesPage from './pages/ExercisesPage';
import PlayPage from './pages/PlayPage';
import ProgressPage from './pages/ProgressPage';
import RankingPage from './pages/RankingPage';
import TeacherPage from './pages/TeacherPage';
import AdminPage from './pages/AdminPage';
import DiagnosticoPage from './pages/DiagnosticoPage';
import ProfilePage from './pages/ProfilePage';

/** Exige sesión iniciada. */
function Protected({ children }: { children: JSX.Element }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="grid h-screen place-items-center text-slate-400">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Gate del diagnóstico: un estudiante nuevo que no lo completó es enviado a
 * /diagnostico antes de poder usar la app.
 */
function RequireDiagnostico({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  if (usuario?.rol === 'estudiante' && !usuario.diagnostico_completado) {
    return <Navigate to="/diagnostico" replace />;
  }
  return children;
}

export default function App() {
  const { usuario } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <LoginPage />} />

      {/* Diagnóstico: pantalla completa, fuera del layout con sidebar. */}
      <Route
        path="/diagnostico"
        element={
          <Protected>
            <DiagnosticoPage />
          </Protected>
        }
      />

      <Route
        path="/"
        element={
          <Protected>
            <RequireDiagnostico>
              <Layout />
            </RequireDiagnostico>
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="ejercicios" element={<ExercisesPage />} />
        <Route path="ejercicios/:id" element={<PlayPage />} />
        <Route path="progreso" element={<ProgressPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="docente" element={<TeacherPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
