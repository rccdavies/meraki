import Stripe from "stripe";
import { CATALOG, isSku } from "./_catalog.js";

// Managed Payments needs API version 2025-03-31.basil or later.
export const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });

// An access code is a paid Checkout Session id. Stripe is the record of what was bought,
// so no database is needed. Advanced credits used are counted on the PaymentIntent metadata.
export async function entitlements(tokens) {
  const ids = [...new Set((Array.isArray(tokens) ? tokens : []).filter(t => typeof t === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(t)))].slice(0, 20);
  if (!ids.length || !process.env.STRIPE_SECRET_KEY) return { passUntil: null, advanced: 0, purchases: [] };
  const s = stripe();
  const sessions = (await Promise.all(ids.map(id =>
    s.checkout.sessions.retrieve(id, { expand: ["payment_intent"] }).catch(() => null))))
    .filter(x => x && x.payment_status === "paid" && isSku(x.metadata?.sku))
    .sort((a, b) => a.created - b.created);

  let until = 0, advanced = 0;
  const purchases = [];
  for (const x of sessions) {
    const item = CATALOG[x.metadata.sku];
    const start = x.created * 1000;
    if (item.passDays) until = Math.max(until, start) + item.passDays * 86400000;
    const pi = typeof x.payment_intent === "object" ? x.payment_intent : null;
    const used = pi ? parseInt(pi.metadata?.adv_used || "0", 10) : 0;
    const left = Math.max(0, (item.advancedCredits || 0) - used);
    advanced += left;
    purchases.push({ id: x.id, sku: x.metadata.sku, name: item.name, left, pi: pi?.id || null, used });
  }
  return { passUntil: until > Date.now() ? new Date(until).toISOString() : null, advanced, purchases };
}

export async function spendAdvanced(ent) {
  const p = ent.purchases.find(p => p.left > 0 && p.pi);
  if (!p) return false;
  await stripe().paymentIntents.update(p.pi, { metadata: { adv_used: String(p.used + 1) } });
  return true;
}
