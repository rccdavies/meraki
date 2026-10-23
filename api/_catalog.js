// What each product grants. Amounts in pence (GBP). Prices live in Stripe, found by lookup_key = sku.
export const CATALOG = {
  pass_1m:    { name: "Meraki Search Pass · 1 month",  description: "One month of full access. One payment, no renewal.", amount: 2500, passDays: 30, advancedCredits: 5 },
  pass_2m:    { name: "Meraki Search Pass · 2 months", description: "Two months of full access. One payment, no renewal.", amount: 3900, passDays: 61, advancedCredits: 10 },
  pass_3m:    { name: "Meraki Search Pass · 3 months", description: "Three months of full access. One payment, no renewal.", amount: 5500, passDays: 92, advancedCredits: 20 },
  credits_10: { name: "Advanced AI · 10 credits", description: "Deeper-model reads, follow-up probes and delivery feedback.", amount: 1200, advancedCredits: 10 },
  sprint:     { name: "Application sprint", description: "14 days of full access, 10 Advanced credits and a school intelligence pack for one brief.", amount: 6500, passDays: 14, advancedCredits: 10 },
  live_panel: { name: "Live mock panel", description: "60 minutes on video with a former head and a search partner, plus a written debrief. We email you to book.", amount: 11900 },
};
export const isSku = (s) => typeof s === "string" && Object.prototype.hasOwnProperty.call(CATALOG, s);
