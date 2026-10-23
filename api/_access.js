import Stripe from "stripe";
import { CATALOG, isSku } from "./_catalog.js";

// Managed Payments needs API version 2025-03-31.basil or later.
// Free trial codes: unlimited standard AI and full access until the expiry (UTC).
// Add a line to issue a new code; delete it to withdraw one.
export const TRIALS = {
  "MERAKI-3PQVT": "2026-10-24T10:15:00Z", // 24-hour friends trial, issued 23 Oct 2026
};

export const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });

// An access code is a paid Checkout Session id. Stripe is the record of what was bought,
// so no database is needed. Advanced credits used are counted on the PaymentIntent metadata.
export async function entitlements(tokens) {
  const all = (Array.isArray(tokens) ? tokens : []).filter(t => typeof t === "string");
  let trialUntil = 0;
  for (const t of all) {
    const exp = TRIALS[t.trim().toUpperCase()];
    if (exp) trialUntil = Math.max(trialUntil, Date.parse(exp));
  }
  const ids = [...new Set(all.filter(t => /^cs_(test|live)_[A-Za-z0-9]+$/.test(t)))].slice(0, 20);
  const trialPass = trialUntil > Date.now() ? new Date(trialUntil).toISOString() : null;
  if (!ids.length || !process.env.STRIPE_SECRET_KEY) return { passUntil: trialPass, advanced: 0, purchases: [], trial: !!trialPass };
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
  until = Math.max(until, trialUntil);
  return { passUntil: until > Date.now() ? new Date(until).toISOString() : null, advanced, purchases, trial: trialUntil > Date.now() };
}

export async function spendAdvanced(ent) {
  const p = ent.purchases.find(p => p.left > 0 && p.pi);
  if (!p) return false;
  await stripe().paymentIntents.update(p.pi, { metadata: { adv_used: String(p.used + 1) } });
  return true;
}
