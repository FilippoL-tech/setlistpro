import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { email } = await request.json();

    // Base URL per i redirect: usa l'origin della richiesta, con fallback all'env
    const origin =
      request.headers.get("origin") ||
      process.env.APP_URL ||
      "https://setlistpro-eight.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment", // pagamento una tantum (Lifetime), NON ricorrente
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // email del cliente, usata anche per ricollegare l'acquisto all'utente
      customer_email: email || undefined,
      client_reference_id: email || undefined,
      metadata: { app: "setlistpro", email: email || "" },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
