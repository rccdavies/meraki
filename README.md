# Meraki · Lead with soul

Candidate-side search, application and interview practice for international school leaders.

Static page (`index.html`) plus Vercel functions in `api/`:
- `api/ai.js`: Anthropic proxy for Studio and Workshop (`ANTHROPIC_API_KEY`, optional `MODEL_STANDARD`, `MODEL_ADVANCED`)
- `api/checkout.js`: Stripe Checkout for one-off passes and add-ons (`STRIPE_SECRET_KEY`, optional `APP_URL`, `MANAGED_PAYMENTS=1`, `STRIPE_TAX=1`)
- `api/access.js`: checks paid Checkout Sessions (access codes) against Stripe

Create Stripe products once: `STRIPE_SECRET_KEY=sk_test_... node scripts/seed-stripe.mjs`
