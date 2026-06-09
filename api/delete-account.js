import { createClient } from "@supabase/supabase-js";

// Client admin: scavalca RLS, può cancellare utenti da auth
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request) {
  try {
    // 1) Estrai il token JWT dall'header Authorization
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Token mancante" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    // 2) Verifica il token e ricava l'utente — accetta SOLO chi è davvero loggato
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token non valido" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const email = user.email;

    // 3) Cancella prima l'utente da auth (così non può più loggarsi)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("Errore cancellazione auth user:", authDeleteError);
      return new Response(JSON.stringify({ error: authDeleteError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4) Cancella la riga in profiles (best-effort: se fallisce, la riga resta orfana ma irraggiungibile)
    if (email) {
      const { error: profileDeleteError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("email", email);
      if (profileDeleteError) {
        console.warn("Profilo orfano dopo cancellazione auth:", email, profileDeleteError);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
