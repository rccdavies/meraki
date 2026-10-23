// Creates the six Meraki products in the Stripe account for STRIPE_SECRET_KEY.
// Use a test key first:  STRIPE_SECRET_KEY=sk_test_... node scripts/seed-stripe.mjs
import Stripe from "stripe";
import { CATALOG } from "../api/_catalog.js";
const s = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
for (const [sku, item] of Object.entries(CATALOG)) {
  if ((await s.prices.list({ lookup_keys: [sku], limit: 1 })).data.length) { console.log("skip", sku); continue; }
  const p = await s.products.create({ name: item.name, description: item.description, tax_code: "txcd_10000000", metadata: { sku } });
  await s.prices.create({ product: p.id, currency: "gbp", unit_amount: item.amount, lookup_key: sku });
  console.log("created", sku);
}
