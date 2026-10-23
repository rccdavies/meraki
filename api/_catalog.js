// What each product grants. Amounts in pence (GBP). Prices live in Stripe, found by lookup_key = sku.
export const CATALOG = {
  pass_1m:    { name: "Meraki Search Pass · 1 month",  description: "One month of full access. One payment, no renewal.", amount: 2499, passDays: 30, advancedCredits: 5 },
  pass_2m:    { name: "Meraki Search Pass · 2 months", description: "Two months of full access. One payment, no renewal.", amount: 3999, passDays: 61, advancedCredits: 10 },
  pass_3m:    { name: "Meraki Search Pass · 3 months", description: "Three months of full access. One payment, no renewal.", amount: 4999, passDays: 92, advancedCredits: 20 },
  credits_10: { name: "Advanced AI · 10 credits", description: "Deeper-model reads, follow-up probes and delivery feedback.", amount: 999, advancedCredits: 10 },
  sprint:     { name: "Application sprint", description: "14 days of full access, 10 Advanced credits and a school intelligence pack for one brief.", amount: 2999, passDays: 14, advancedCredits: 10 },
};
export const isSku = (s) => typeof s === "string" && Object.prototype.hasOwnProperty.call(CATALOG, s);
