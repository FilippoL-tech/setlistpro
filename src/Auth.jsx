import { useState } from "react";
import { supabase } from "./supabase";

/* Sfondo "palco" ambra fisso — puro CSS, nessun asset */
function StageBg() {
  const bars = Array.from({ length: 28 });
  return (
    <div className="slp-stage" aria-hidden="true">
      <div className="slp-vignette" />
      <div className="slp-spot" />
      <div className="slp-rim" />
      <div className="slp-beam" />
      <div className="slp-eq">
        {bars.map((_, i) => {
          const c = Math.abs(i - 14);
          const peak = 1 - c / 20;
          return (
            <span
              key={i}
              className="slp-eqbar"
              style={{
                "--peak": Math.max(0.18, peak).toFixed(2),
                animationDelay: `${(i % 7) * 0.18}s`,
                animationDuration: `${2.2 + (i % 5) * 0.4}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* Logo completo: onda ciano + wordmark + tagline */
function BrandLogo() {
  const lines = Array.from({ length: 18 });
  return (
    <div className="slp-brand">
      <svg className="slp-brand-wave" viewBox="0 0 700 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs><linearGradient id="slpwave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a5f3fc"/><stop offset="50%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#2dd4bf"/>
        </linearGradient></defs>
        {lines.map((_, i) => {
          const t = i / (lines.length - 1), amp = 150 * (0.06 + 0.23 * t), phase = t * 2.5, yoff = 150 * 0.52 + (t - 0.5) * 150 * 0.05;
          let d = "M";
          for (let x = 0; x <= 700; x += 10) {
            const env = Math.exp(-Math.pow((x - 350) / 200, 2));
            const y = yoff + Math.sin(x * 0.017 + phase) * amp * (0.16 + env * 0.95) - env * 150 * 0.22 * t;
            d += (x === 0 ? "" : "L") + x + " " + y.toFixed(1) + " ";
          }
          const op = (0.22 + 0.65 * (1 - Math.abs(t - 0.5) * 1.5)).toFixed(2);
          return <path key={i} d={d} fill="none" stroke="url(#slpwave)" strokeWidth="1" opacity={op} />;
        })}
      </svg>
      <div className="slp-brand-wm"><span className="s">Setlist</span><b>Pro</b></div>
      <div className="slp-brand-tag"><span className="ln" /><span>L'app italiana per musicisti live</span><span className="ln" /></div>
    </div>
  );
}

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
      <style>{STAGE_CSS}</style>
      <StageBg />

      <div style={styles.card}>
        {/* Logo */}
        <BrandLogo />

        <a
          href="https://setlistpro.it"
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

/* CSS dello sfondo palco (ambra fisso) */
const STAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap');
.slp-stage{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 90% at 50% -10%, #101830 0%, #080B14 60%);}
.slp-vignette{position:absolute;inset:0;background:radial-gradient(110% 110% at 50% 45%, transparent 55%, rgba(0,0,0,.65) 100%);}
.slp-spot{position:absolute;left:50%;top:-22%;width:120vmin;height:120vmin;transform:translateX(-50%);background:radial-gradient(closest-side, rgba(255,226,172,.30) 0%, rgba(244,182,92,.16) 32%, transparent 70%);filter:blur(8px);animation:slpBreath 9s ease-in-out infinite;}
.slp-rim{position:absolute;left:-15%;bottom:-25%;width:80vmin;height:80vmin;background:radial-gradient(closest-side, rgba(110,81,168,.22) 0%, transparent 70%);filter:blur(10px);animation:slpGlow 11s ease-in-out infinite;}
.slp-beam{position:absolute;left:50%;top:-30%;width:64vmin;height:130vmin;transform:translateX(-50%);background:linear-gradient(to bottom, rgba(255,226,172,.16) 0%, transparent 70%);clip-path:polygon(40% 0, 60% 0, 90% 100%, 10% 100%);filter:blur(6px);}
.slp-eq{position:absolute;left:0;right:0;bottom:0;height:24vmin;display:flex;align-items:flex-end;justify-content:center;gap:1.1vmin;padding:0 4vmin;opacity:.5;-webkit-mask-image:linear-gradient(to top,#000 10%,transparent 95%);mask-image:linear-gradient(to top,#000 10%,transparent 95%);}
.slp-eqbar{flex:1 1 auto;max-width:14px;height:calc(22vmin * var(--peak,.5));border-radius:6px 6px 0 0;background:linear-gradient(to top, transparent, #e8c84a);transform-origin:bottom;transform:scaleY(.25);animation:slpEq ease-in-out infinite alternate;}
@keyframes slpEq{from{transform:scaleY(.22);}to{transform:scaleY(1);}}
@keyframes slpBreath{0%,100%{opacity:.85;transform:translateX(-50%) scale(1);}50%{opacity:1;transform:translateX(-50%) scale(1.04);}}
@keyframes slpGlow{0%,100%{opacity:.85;}50%{opacity:1;}}
@media (prefers-reduced-motion: reduce){.slp-eqbar,.slp-spot,.slp-rim{animation:none !important;}.slp-eqbar{transform:scaleY(var(--peak,.5));}}
.slp-brand{display:flex;flex-direction:column;align-items:center;margin-bottom:4px;}
.slp-brand-wave{width:min(280px,78%);height:auto;display:block;margin-bottom:2px;}
.slp-brand-wm{display:flex;align-items:baseline;line-height:1;text-transform:uppercase;letter-spacing:.04em;}
.slp-brand-wm .s{font-family:'Playfair Display',serif;font-weight:500;font-size:2.3rem;color:#f4f1ea;}
.slp-brand-wm b{font-family:'Oswald',sans-serif;font-weight:700;font-size:2.3rem;color:#e8c84a;}
.slp-brand-tag{display:flex;align-items:center;gap:9px;margin-top:10px;text-transform:uppercase;letter-spacing:.2em;font-size:.58rem;color:#cfd4e2;white-space:nowrap;}
.slp-brand-tag .ln{width:20px;height:1px;background:#22d3ee;}
`;

const styles = {
  overlay: {
    position: "relative",
    minHeight: "100vh",
    background: "#080B14",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    position: "relative",
    zIndex: 2,
    background: "rgba(20,26,40,.66)",
    border: "1px solid rgba(232,200,74,.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderRadius: "20px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    boxShadow: "0 30px 80px -30px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.05)",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "4px",
  },
  logoText: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: "1.9rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "2px",
    color: "#e8e8f0",
    lineHeight: 1,
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
    color: "#9aa3b8",
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
    color: "#9aa3b8",
    fontWeight: 600,
    letterSpacing: ".05em",
    textTransform: "uppercase",
  },
  input: {
    background: "rgba(8,11,20,.55)",
    border: "1px solid rgba(122,127,150,.3)",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#e8e8f0",
    fontSize: ".95rem",
    outline: "none",
    transition: "border-color .2s",
  },
  btnPrimary: {
    background: "linear-gradient(180deg, #ffdf9f, #e8c84a)",
    color: "#1a1206",
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity .2s, transform .12s",
    marginTop: "4px",
    boxShadow: "0 10px 30px -10px rgba(232,200,74,.5)",
  },
  error: {
    background: "rgba(232,96,74,.12)",
    border: "1px solid rgba(232,96,74,.35)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#e8604a",
    fontSize: ".85rem",
  },
  successMsg: {
    background: "rgba(74,232,122,.12)",
    border: "1px solid rgba(74,232,122,.35)",
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
