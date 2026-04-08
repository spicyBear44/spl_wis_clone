import AuthForm from "../components/AuthForm";

export default function AuthPage({ mode }) {
  return (
    <main className="auth-shell">
      <div className="brand-block">
        <h1>WiselySplit That Benjamins</h1>
        <p>Track shared spending, split balances cleanly, and settle up without the mess.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode={mode} />
        <div className="auth-mascot-card">
          <img src="/images/auth-coin-mascot.png" alt="Mascot holding coins" className="auth-mascot-image" />
        </div>
      </div>
    </main>
  );
}
