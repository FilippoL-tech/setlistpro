import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text(); // raw body necessario per verificare la firma

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Verifica firma webhook fallita:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Ignora i checkout di altri prodotti/app nello stesso account Stripe:
    // agiamo solo sulle sessioni etichettate come SetlistPro.
    if (session.metadata?.app !== "setlistpro") {
      console.log("Evento ignorato: non è un acquisto SetlistPro");
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const email =
      session.client_reference_id ||
      session.customer_email ||
      session.customer_details?.email ||
      session.metadata?.email;

    if (!email) {
      console.warn("checkout.session.completed senza email associata");
      return new Response(JSON.stringify({ received: true, warning: "no email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // .select() ci restituisce le righe aggiornate: se è vuoto, nessuna riga corrispondeva
    const { data, error } = await supabase
      .from("profiles")
      .update({ is_pro: true })
      .eq("email", email)
      .select();

    if (error) {
      console.error("Errore update Supabase:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      console.warn("Nessuna riga profiles per:", email, "— PRO non assegnato");
    } else {
      console.log("PRO attivato per:", email);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
