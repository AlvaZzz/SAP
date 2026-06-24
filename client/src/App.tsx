import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ExercisesPage from './pages/ExercisesPage';
import PlayPage from './pages/PlayPage';
import ProgressPage from './pages/ProgressPage';
import RankingPage from './pages/RankingPage';
import TeacherPage from './pages/TeacherPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import PretestPage from './pages/PretestPage';
import PretestResultadoPage from './pages/PretestResultadoPage';

function Protected({ children }: { children: JSX.Element }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="grid h-screen place-items-center text-slate-400">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

/** Un estudiante sin pretest debe completarlo antes de usar la app. */
function RequirePretest({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  if (usuario?.rol === 'estudiante' && !usuario.pretest_completado) {
    return <Navigate to="/pretest" replace />;
  }
  return children;
}

export default function App() {
  const { usuario } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={usuario ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/registro" element={usuario ? <Navigate to="/" replace /> : <RegisterPage />} />

      {/* Pretest a pantalla completa, fuera del layout */}
      <Route path="/pretest" element={<Protected><PretestPage /></Protected>} />
      <Route path="/pretest/resultado" element={<Protected><PretestResultadoPage /></Protected>} />

      <Route
        path="/"
        element={<Protected><RequirePretest><Layout /></RequirePretest></Protected>}
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
