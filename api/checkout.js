import { stripe } from "./_access.js";
import { isSku } from "./_catalog.js";

const HUMAN_SERVICES = new Set(["live_panel"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Payments aren't switched on yet." });
  const { sku } = req.body || {};
  if (!isSku(sku)) return res.status(400).json({ error: "Unknown product." });
  try {
    const s = stripe();
    const prices = await s.prices.list({ lookup_keys: [sku], active: true, limit: 1 });
    if (!prices.data[0]) return res.status(500).json({ error: "This product isn't set up in Stripe yet." });
    const origin = process.env.APP_URL || `https://${req.headers.host}`;
    const params = {
      mode: "payment",
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      metadata: { sku },
      payment_intent_data: { metadata: { sku, adv_used: "0" } },
      success_url: `${origin}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#plans`,
    };
    // Managed Payments is on by default for this Stripe account: Stripe handles worldwide tax,
    // fraud and disputes, so automatic_tax must not be sent. Live coaching involves people, so it
    // isn't eligible: that product goes through ordinary Checkout instead.
    if (HUMAN_SERVICES.has(sku)) {
      params.managed_payments = { enabled: false };
      if (process.env.STRIPE_TAX === "1") params.automatic_tax = { enabled: true };
    }
    const session = await s.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (e) {
    console.error("checkout_error", e?.type, e?.code, e?.message);
    return res.status(500).json({ error: "Checkout couldn't start. Please try again." });
  }
}
