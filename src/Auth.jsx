import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onLogin(data.user);

    } else if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Registrazione completata! Controlla la tua email per confermare l'account.");

    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) setError(error.message);
      else setSuccess("Email inviata! Controlla la tua casella di posta.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8c84a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
          </svg>
          <span style={styles.logoText}>Setlist<b style={{color:"#e8c84a"}}>Pro</b></span>
        </div>

        <a
          href="https://setlistpro-landing.vercel.app"
          target="_blank"
          rel="noopener"
          style={styles.infoLink}
        >
          ℹ️ Scopri cosa fa SetlistPro →
        </a>

        <h2 style={styles.title}>
          {mode === "login" && "Bentornato!"}
          {mode === "register" && "Crea il tuo account"}
          {mode === "reset" && "Recupera password"}
        </h2>
        <p style={styles.sub}>
          {mode === "login" && "Accedi per sincronizzare le tue scalette su tutti i dispositivi."}
          {mode === "register" && "Registrati gratuitamente — nessuna carta richiesta."}
          {mode === "reset" && "Inserisci la tua email e ti mandiamo il link per reimpostare la password."}
        </p>

        {/* Form */}
        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tua@email.com"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {mode !== "reset" && (
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}

          {error && <div style={styles.error}>⚠️ {error}</div>}
          {success && <div style={styles.successMsg}>✅ {success}</div>}

          <button
            style={{...styles.btnPrimary, opacity: loading ? .7 : 1}}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Attendere…" : (
              mode === "login" ? "Accedi" :
              mode === "register" ? "Registrati" :
              "Invia email"
            )}
          </button>
        </div>

        {/* Links */}
        <div style={styles.links}>
          {mode === "login" && <>
            <button style={styles.linkBtn} onClick={() => { setMode("register"); setError(null); setSuccess(null); }}>
              Non hai un account? Registrati
            </button>
            <button style={styles.linkBtn} onClick={() => { setMode("reset"); setError(null); setSuccess(null); }}>
              Password dimenticata?
            </button>
          </>}
          {mode === "register" && (
            <button style={styles.linkBtn} onClick={() => { setMode("login"); setError(null); setSuccess(null); }}>
              Hai già un account? Accedi
            </button>
          )}
          {mode === "reset" && (
            <button style={styles.linkBtn} onClick={() => { setMode("login"); setError(null); setSuccess(null); }}>
              Torna al login
            </button>
          )}
        </div>

<p style={styles.note}>
  Continuando accetti i nostri <a href="/termini.html" target="_blank" rel="noopener" style={{color:"#4aade8"}}>Termini di Servizio</a> e l'<a href="/privacy.html" target="_blank" rel="noopener" style={{color:"#4aade8"}}>Informativa Privacy</a>.<br/>
  Supporto: <a href="mailto:supportosetlistpro@gmail.com" style={{color:"#4aade8"}}>supportosetlistpro@gmail.com</a>
</p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: "100vh",
    background: "#0d0f14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: "#1c2030",
    border: "1px solid #2a2f3d",
    borderRadius: "20px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.4rem",
    color: "#e8e8f0",
    marginBottom: "4px",
  },
  logoText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.4rem",
    color: "#e8e8f0",
  },
  infoLink: {
    fontSize: ".85rem",
    color: "#4aade8",
    textDecoration: "none",
    alignSelf: "flex-start",
    fontWeight: 500,
    marginTop: "-12px",
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.8rem",
    color: "#e8e8f0",
    margin: 0,
  },
  sub: {
    color: "#7a7f96",
    fontSize: ".9rem",
    lineHeight: 1.6,
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: ".82rem",
    color: "#7a7f96",
    fontWeight: 600,
    letterSpacing: ".05em",
    textTransform: "uppercase",
  },
  input: {
    background: "#161920",
    border: "1px solid #2a2f3d",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#e8e8f0",
    fontSize: ".95rem",
    outline: "none",
    transition: "border-color .2s",
  },
  btnPrimary: {
    background: "#e8c84a",
    color: "#0d0f14",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity .2s",
    marginTop: "4px",
  },
  error: {
    background: "rgba(232,96,74,.1)",
    border: "1px solid rgba(232,96,74,.3)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#e8604a",
    fontSize: ".85rem",
  },
  successMsg: {
    background: "rgba(74,232,122,.1)",
    border: "1px solid rgba(74,232,122,.3)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#4ae87a",
    fontSize: ".85rem",
  },
  links: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "center",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#4aade8",
    fontSize: ".85rem",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  note: {
    fontSize: ".75rem",
    color: "#7a7f96",
    textAlign: "center",
    lineHeight: 1.6,
  },
};
