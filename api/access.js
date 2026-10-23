import { entitlements } from "./_access.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const ent = await entitlements(req.body?.tokens);
    return res.json({ passUntil: ent.passUntil, advanced: ent.advanced,
      purchases: ent.purchases.map(({ id, sku, name, left }) => ({ id, sku, name, left })) });
  } catch (e) {
    return res.status(500).json({ error: "Couldn't check your access just now." });
  }
}
