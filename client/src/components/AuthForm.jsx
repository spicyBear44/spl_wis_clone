import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AUTH_TRANSITION_MS = 2000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function AuthForm({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const startedAt = Date.now();

    try {
      if (isSignup) {
        await register(form);
      } else {
        await login({ username: form.username, password: form.password });
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < AUTH_TRANSITION_MS) {
        await wait(AUTH_TRANSITION_MS - elapsed);
      }
      navigate("/dashboard");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>{isSignup ? "Create An Account" : "Welcome Back!"}</h2>
        {error ? <p className="form-error">{error}</p> : null}
        {isSignup ? (
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        ) : null}
        <input
          type="text"
          placeholder={isSignup ? "Username" : "Username or email"}
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
        />
        {isSignup ? (
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        ) : null}
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        {!isSignup ? (
          <Link className="forgot-password-link" to="/forgot-password">
            Forgot password?
          </Link>
        ) : null}
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignup ? "Sign up" : "Login"}
        </button>
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Login here" : "Sign up here"}</Link>
        </p>
      </form>
      {loading ? (
        <div className="status-toast auth-status-toast is-loading" role="status" aria-live="polite">
          <span className="status-spinner" aria-hidden="true" />
          <div>
            <strong>{isSignup ? "Creating account..." : "Signing in..."}</strong>
          </div>
        </div>
      ) : null}
    </>
  );
}
