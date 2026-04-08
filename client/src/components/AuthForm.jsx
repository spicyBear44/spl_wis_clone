import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthForm({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignup) {
        await register(form);
      } else {
        await login({ username: form.username, password: form.password });
      }
      navigate("/dashboard");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h2>{isSignup ? "Create account" : "Login"}</h2>
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
        placeholder="Username"
        value={form.username}
        onChange={(event) => setForm({ ...form, username: event.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Please wait..." : isSignup ? "Sign up" : "Login"}
      </button>
      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Login here" : "Sign up here"}</Link>
      </p>
    </form>
  );
}
