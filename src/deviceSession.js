import { supabase } from "./supabase";

/* Numero massimo di dispositivi attivi contemporaneamente.
   Versione band (futura): alza a 5, o legalo al piano dell'utente. */
export const MAX_DEVICES = 2;

const KEY = "slp_device_id";

/* ID stabile del dispositivo (persiste in questo browser) */
export function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem(KEY); } catch {}
  if (!id) {
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(KEY, id); } catch {}
  }
  return id;
}

/* Al login: rivendica uno slot e sfratta i dispositivi più vecchi oltre il limite.
   Non blocca mai il login se qualcosa va storto. */
export async function claimSession(userId) {
  const deviceId = getDeviceId();
  try {
    await supabase.from("active_sessions").upsert(
      { user_id: userId, device_id: deviceId, last_active: new Date().toISOString() },
      { onConflict: "user_id,device_id" }
    );
    const { data } = await supabase
      .from("active_sessions")
      .select("device_id,last_active")
      .eq("user_id", userId)
      .order("last_active", { ascending: false });
    if (data && data.length > MAX_DEVICES) {
      const toEvict = data.slice(MAX_DEVICES).map(r => r.device_id);
      await supabase.from("active_sessions")
        .delete()
        .eq("user_id", userId)
        .in("device_id", toEvict);
    }
  } catch (e) {
    /* silenzioso */
  }
}

/* Battito: ritorna true se lo slot esiste ancora (e ne aggiorna l'orario),
   false se è stato sfrattato. In caso di errore di rete non sfratta. */
export async function heartbeatSession(userId) {
  const deviceId = getDeviceId();
  try {
    const { data, error } = await supabase
      .from("active_sessions")
      .select("device_id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (error) return true;
    if (!data) return false; // slot sparito => sfrattato
    await supabase.from("active_sessions")
      .update({ last_active: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("device_id", deviceId);
    return true;
  } catch {
    return true;
  }
}

/* Al logout: libera lo slot di questo dispositivo */
export async function releaseSession(userId) {
  const deviceId = getDeviceId();
  try {
    await supabase.from("active_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("device_id", deviceId);
  } catch {}
}
