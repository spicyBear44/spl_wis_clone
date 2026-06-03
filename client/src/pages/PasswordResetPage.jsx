import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { authApi } from "../services/api";

const RESET_SUCCESS_MESSAGE = "If an account with that email exists, a reset link has been sent.";

export default function PasswordResetPage({ mode }) {
  const isReset = mode === "reset";
  const { token } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await authApi.forgotPassword({ email });
      setMessage(response.message || RESET_SUCCESS_MESSAGE);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.resetPassword(token, { password: form.password });
      setMessage(response.message || "Password updated. You can now log in.");
      window.setTimeout(() => navigate("/login"), 900);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-logo-mark">
        <img src="/images/wiselysplit-leaf-logo.svg" alt="WiselySplit logo" />
        <span>WiselySplit</span>
      </div>
      <div className="brand-block">
        <h1>{isReset ? "Choose A New Password" : "Reset Your Password"}</h1>
        <p>{isReset ? "Create a fresh password for your account." : "Enter your email and we will send a secure reset link."}</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card password-reset-card" onSubmit={isReset ? handleResetSubmit : handleForgotSubmit}>
          <h2>{isReset ? "New password" : "Forgot password"}</h2>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}

          {isReset ? (
            <>
              <input
                type="password"
                placeholder="New password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={form.confirmPassword}
                onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              />
            </>
          ) : (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isReset ? "Update password" : "Send reset link"}
          </button>
          <p className="auth-switch">
            Remembered it? <Link to="/login">Back to login</Link>
          </p>
        </form>
        <div className="auth-mascot-card">
          <img src="/images/auth-coin-mascot.png" alt="Mascot holding coins" className="auth-mascot-image" />
        </div>
      </div>
    </main>
  );
}
