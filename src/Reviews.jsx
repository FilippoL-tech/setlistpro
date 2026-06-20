import { useState, useEffect } from "react";
import { supabase } from "./supabase";

/* ---------- Stelle ---------- */
function Star({ fill = 1, size = 18, onClick, onEnter }) {
  const id = "s" + Math.random().toString(36).slice(2, 8);
  const f = Math.max(0, Math.min(1, fill));
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" onClick={onClick} onMouseEnter={onEnter}
      style={{ cursor: onClick ? "pointer" : "default", display: "block" }}>
      <defs><linearGradient id={id}>
        <stop offset={`${f * 100}%`} stopColor="#e8c84a" />
        <stop offset={`${f * 100}%`} stopColor="#2a2f3d" />
      </linearGradient></defs>
      <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5 21.2l1.4-6.8L1.3 9.8l6.9-.7z"
        fill={`url(#${id})`} stroke="#e8c84a" strokeWidth="1" strokeLinejoin="round" opacity={f > 0 ? 1 : .6} />
    </svg>
  );
}
function StarRow({ value, size = 18 }) {
  return <div style={{ display: "flex", gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} fill={value - i + 1} />)}</div>;
}
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={32} fill={(hover || value) >= i ? 1 : 0} onClick={() => onChange(i)} onEnter={() => setHover(i)} />)}
    </div>
  );
}
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };

/* ---------- Dati condivisi (hook) ---------- */
function useReviews(user) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (!error && data) setReviews(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map(s => ({ s, n: reviews.filter(r => r.rating === s).length }));
  const mine = user ? reviews.find(r => r.user_id === user.id) : null;
  return { reviews, loading, count, avg, dist, mine, load };
}

/* ---------- Pezzi UI condivisi ---------- */
function Summary({ count, avg, dist }) {
  if (!count) return null;
  return (
    <div className="rv-summary">
      <div className="rv-summary-big">
        <span className="rv-avg-lg">{avg.toFixed(1)}</span>
        <StarRow value={avg} size={16} />
        <span className="rv-count">{count} recension{count === 1 ? "e" : "i"}</span>
      </div>
      <div className="rv-dist">
        {dist.map(({ s, n }) => (
          <div key={s} className="rv-dist-row">
            <span className="rv-dist-n">{s}★</span>
            <div className="rv-bar"><div className="rv-bar-fill" style={{ width: `${count ? (n / count) * 100 : 0}%` }} /></div>
            <span className="rv-dist-c">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({ user, mine, onDone }) {
  const [rating, setRating] = useState(mine ? mine.rating : 0);
  const [text, setText] = useState(mine ? mine.body : "");
  const [band, setBand] = useState(mine ? mine.author_name : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!rating || !text.trim()) return;
    setBusy(true); setErr(null);
    const name = band.trim() || (user.email ? user.email.split("@")[0] : "Musicista");
    const { error } = await supabase.from("reviews").upsert(
      { user_id: user.id, author_name: name, rating, body: text.trim() }, { onConflict: "user_id" });
    setBusy(false);
    if (error) { setErr("Qualcosa è andato storto. Riprova."); return; }
    onDone();
  };
  const removeMine = async () => {
    if (!mine) return;
    setBusy(true);
    await supabase.from("reviews").delete().eq("id", mine.id);
    setBusy(false);
    setRating(0); setText(""); setBand("");
    onDone();
  };

  return (
    <div className="rv-form">
      <span className="rv-form-t">{mine ? "Modifica la tua recensione" : "Scrivi la tua recensione"}</span>
      <StarPicker value={rating} onChange={setRating} />
      <input className="rv-input" placeholder="Nome / band (es. Marco – Cover band)" value={band} maxLength={60} onChange={e => setBand(e.target.value)} />
      <textarea className="rv-area" placeholder="Com'è andata sul palco con SetlistPro?" value={text} maxLength={1000} rows={3} onChange={e => setText(e.target.value)} />
      {err && <span className="rv-err">{err}</span>}
      <div className="rv-form-foot">
        <span className="rv-priv">Sarà visibile a tutti gli utenti.</span>
        <div style={{ display: "flex", gap: 8 }}>
          {mine && <button className="rv-del" onClick={removeMine} disabled={busy}>Elimina</button>}
          <button className="rv-btn rv-btn-sm" onClick={submit} disabled={busy || !rating || !text.trim()}>{busy ? "…" : mine ? "Aggiorna" : "Pubblica"}</button>
        </div>
      </div>
    </div>
  );
}

function ReviewList({ reviews, mineId }) {
  if (!reviews.length) return (
    <div className="rv-empty">
      <div className="rv-empty-stars"><StarRow value={0} size={22} /></div>
      <p>Ancora nessuna recensione.<br /><b>Sii il primo a recensire SetlistPro!</b></p>
    </div>
  );
  return (
    <div className="rv-list">
      {reviews.map(r => (
        <div key={r.id} className="rv-item">
          <div className="rv-avatar">{(r.author_name || "?")[0].toUpperCase()}</div>
          <div className="rv-item-body">
            <div className="rv-item-head">
              <span className="rv-item-name">{r.author_name}{mineId && r.id === mineId && <span className="rv-you"> · la tua</span>}</span>
              <span className="rv-item-date">{fmtDate(r.created_at)}</span>
            </div>
            <StarRow value={r.rating} size={14} />
            <p className="rv-item-text">{r.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========== 1) Banner + modale per la HOME (utente loggato) ========== */
export default function ReviewsButton({ user }) {
  const { reviews, loading, count, avg, dist, mine, load } = useReviews(user);
  const [open, setOpen] = useState(false);

  return (
    <div className="rv-wrap">
      <style>{CSS}</style>
      <div className="rv-cta">
        <div className="rv-cta-left">
          <span className="rv-eyebrow">Ti piace SetlistPro?</span>
          {loading ? <p className="rv-cta-sub">…</p> : count ? (
            <div className="rv-cta-rating"><span className="rv-avg">{avg.toFixed(1)}</span><StarRow value={avg} size={20} /><span className="rv-count">{count} recension{count === 1 ? "e" : "i"}</span></div>
          ) : <p className="rv-cta-sub">Nessuna recensione ancora. La tua può essere la prima.</p>}
        </div>
        <button className="rv-btn" onClick={() => setOpen(true)}>★ {mine ? "Modifica la tua recensione" : "Lascia una recensione"}</button>
      </div>

      {open && (
        <div className="rv-overlay" onClick={() => setOpen(false)}>
          <div className="rv-modal" onClick={e => e.stopPropagation()}>
            <div className="rv-modal-head"><h3>Recensioni</h3><button className="rv-x" onClick={() => setOpen(false)}>✕</button></div>
            <div className="rv-modal-body">
              <Summary count={count} avg={avg} dist={dist} />
              <ReviewForm user={user} mine={mine} onDone={load} />
              <ReviewList reviews={reviews} mineId={mine?.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== 2) Pagina PUBBLICA (anche senza login) ========== */
export function ReviewsPage({ user }) {
  const { reviews, loading, count, avg, dist, mine, load } = useReviews(user);
  const [writing, setWriting] = useState(false);
  const home = () => { window.location.href = window.location.pathname; };

  return (
    <div className="app">
      <style>{CSS}</style>
      <header className="app-header">
        <div className="logo"><span className="logo-set">Setlist</span><b>Pro</b></div>
        <button className="rv-btn rv-btn-sm" onClick={home}>Apri l'app</button>
      </header>

      <div className="rvp-hero">
        <h1>Dicono di SetlistPro</h1>
        <p>Il parere dei musicisti che la usano sul palco.</p>
      </div>

      <div className="rvp-body">
        <Summary count={count} avg={avg} dist={dist} />

        {/* Banner scrittura: solo registrati */}
        {user ? (
          writing ? (
            <ReviewForm user={user} mine={mine} onDone={() => { setWriting(false); load(); }} />
          ) : (
            <button className="rv-btn rvp-write" onClick={() => setWriting(true)}>★ {mine ? "Modifica la tua recensione" : "Scrivi la tua recensione"}</button>
          )
        ) : (
          <div className="rvp-banner">
            <div>
              <span className="rv-eyebrow">Usi SetlistPro?</span>
              <p className="rv-cta-sub">Registrati per lasciare la tua recensione — è gratis.</p>
            </div>
            <button className="rv-btn" onClick={home}>Registrati gratis</button>
          </div>
        )}

        {loading ? <p className="rv-cta-sub" style={{ textAlign: "center", padding: 30 }}>Carico le recensioni…</p>
          : <ReviewList reviews={reviews} mineId={mine?.id} />}

        {!user && count > 0 && (
          <div className="rvp-footer">
            <p>Vuoi creare le tue scalette e portarle sul palco?</p>
            <button className="rv-btn" onClick={home} style={{ marginTop: 10 }}>Prova SetlistPro gratis</button>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.rv-wrap{margin-top:28px;}
.rv-cta{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(135deg, rgba(232,200,74,.10), rgba(232,200,74,.02));border:1px solid rgba(232,200,74,.28);border-radius:var(--radius,14px);padding:20px 22px;}
.rv-eyebrow{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:2px;font-size:.85rem;color:var(--accent);}
.rv-cta-rating{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap;}
.rv-avg{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:900;}
.rv-count{color:var(--muted);font-size:.85rem;}
.rv-cta-sub{color:var(--muted);font-size:.9rem;margin:6px 0 0;}
.rv-btn{background:linear-gradient(180deg,#ffdf9f,#e8c84a);color:#1a1206;border:none;border-radius:10px;padding:13px 20px;font-weight:700;font-size:.95rem;cursor:pointer;white-space:nowrap;box-shadow:0 10px 26px -12px rgba(232,200,74,.6);}
.rv-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;}
.rv-btn-sm{padding:9px 16px;font-size:.85rem;}
.rv-del{background:none;border:1px solid rgba(232,96,74,.4);color:#e8604a;border-radius:10px;padding:10px 14px;font-size:.85rem;cursor:pointer;}
.rv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60;}
.rv-modal{background:var(--card);border:1px solid var(--border);border-radius:18px;width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 40px 100px -30px rgba(0,0,0,.8);}
.rv-modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);}
.rv-modal-head h3{font-family:'Playfair Display',serif;font-size:1.4rem;margin:0;}
.rv-x{background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;}
.rv-modal-body{padding:20px 22px;overflow-y:auto;}
.rv-summary{display:flex;gap:24px;align-items:center;padding-bottom:20px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-wrap:wrap;}
.rv-summary-big{display:flex;flex-direction:column;gap:6px;align-items:flex-start;}
.rv-avg-lg{font-family:'Playfair Display',serif;font-size:2.6rem;font-weight:900;line-height:1;}
.rv-dist{flex:1;min-width:180px;display:flex;flex-direction:column;gap:5px;}
.rv-dist-row{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--muted);}
.rv-dist-n{width:24px;}
.rv-bar{flex:1;height:7px;background:var(--surface);border-radius:5px;overflow:hidden;}
.rv-bar-fill{height:100%;background:var(--accent);border-radius:5px;}
.rv-dist-c{width:18px;text-align:right;}
.rv-form{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;margin-bottom:22px;}
.rv-form-t{font-weight:600;font-size:.95rem;}
.rv-input,.rv-area{background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px 12px;color:var(--text);font-family:inherit;font-size:.9rem;outline:none;}
.rv-area{resize:vertical;}
.rv-input:focus,.rv-area:focus{border-color:var(--accent);}
.rv-err{color:#e8604a;font-size:.8rem;}
.rv-form-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.rv-priv{font-size:.75rem;color:var(--muted);}
.rv-empty{text-align:center;padding:30px 10px;color:var(--muted);}
.rv-empty-stars{display:flex;justify-content:center;margin-bottom:12px;opacity:.5;}
.rv-empty b{color:var(--text);}
.rv-list{display:flex;flex-direction:column;gap:18px;}
.rv-item{display:flex;gap:12px;}
.rv-avatar{flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:rgba(232,200,74,.15);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Oswald',sans-serif;}
.rv-item-body{flex:1;}
.rv-item-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.rv-item-name{font-weight:600;}
.rv-you{color:var(--accent);font-weight:500;font-size:.8rem;}
.rv-item-date{color:var(--muted);font-size:.75rem;white-space:nowrap;}
.rv-item-text{margin:6px 0 0;color:#c9cfe0;line-height:1.55;font-size:.92rem;white-space:pre-wrap;}
/* pagina pubblica */
.rvp-hero{padding:24px 0 20px;}
.rvp-hero h1{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,6vw,2.6rem);margin-bottom:8px;}
.rvp-hero p{color:var(--muted);}
.rvp-body{max-width:620px;}
.rvp-write{width:100%;margin-bottom:22px;}
.rvp-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(135deg, rgba(232,200,74,.10), rgba(232,200,74,.02));border:1px solid rgba(232,200,74,.28);border-radius:var(--radius,14px);padding:18px 20px;margin-bottom:24px;}
.rvp-footer{text-align:center;padding:28px 0 8px;color:var(--muted);border-top:1px solid var(--border);margin-top:26px;}
@media (max-width:480px){.rv-cta,.rvp-banner{flex-direction:column;align-items:flex-start;}.rv-cta .rv-btn,.rvp-banner .rv-btn{width:100%;}}
`;
