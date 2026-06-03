import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import PasswordResetPage from "./pages/PasswordResetPage";

function ProtectedRoute({ children }) {
  const { authChecking, token } = useAuth();

  if (authChecking) {
    return (
      <main className="auth-shell auth-check-shell">
        <div className="auth-logo-mark">
          <img src="/images/wiselysplit-leaf-logo.svg" alt="WiselySplit logo" />
          <span>WiselySplit</span>
        </div>
        <p className="loading-copy">Checking your session...</p>
      </main>
    );
  }

  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { authChecking, token } = useAuth();

  if (authChecking) {
    return (
      <main className="auth-shell auth-check-shell">
        <div className="auth-logo-mark">
          <img src="/images/wiselysplit-leaf-logo.svg" alt="WiselySplit logo" />
          <span>WiselySplit</span>
        </div>
        <p className="loading-copy">Checking your session...</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<PasswordResetPage mode="forgot" />} />
      <Route path="/reset-password/:token" element={<PasswordResetPage mode="reset" />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
