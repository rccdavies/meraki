import { entitlements, spendAdvanced } from "./_access.js";

const MODELS = {
  standard: process.env.MODEL_STANDARD || "claude-sonnet-5-5",
  advanced: process.env.MODEL_ADVANCED || "claude-opus-5-5",
};

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "unavailable", error: "AI isn't switched on yet." });
  const { prompt, tier, images, tokens } = req.body || {};
  if (typeof prompt !== "string" || prompt.length < 20 || prompt.length > 60000)
    return res.status(400).json({ code: "bad_request", error: "Nothing to read." });

  const adv = tier === "advanced";
  if (adv) {
    const ent = await entitlements(tokens).catch(() => null);
    if (!ent || ent.advanced < 1) return res.status(402).json({ code: "no_credits", error: "You're out of Advanced credits. Top up on the Plans page." });
    await spendAdvanced(ent);
  }

  const content = [];
  for (const b64 of (Array.isArray(images) ? images : []).slice(0, 4)) {
    if (typeof b64 === "string" && b64.length < 1_500_000)
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
  }
  content.push({ type: "text", text: prompt });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: adv ? MODELS.advanced : MODELS.standard,
        max_tokens: 2500,
        system: "You return only valid JSON, with no markdown fences and no text before or after it.",
        messages: [{ role: "user", content }],
      }),
    });
    if (r.status === 429 || r.status === 529) return res.status(429).json({ code: "rate_limited", error: "Busy right now. Try again in a minute." });
    if (!r.ok) return res.status(502).json({ code: "upstream", error: "The AI didn't respond. Try again." });
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    try { return res.json({ json: JSON.parse(text.slice(a, b + 1)) }); }
    catch { return res.status(502).json({ code: "invalid_json", error: "The reply came back garbled. Try again." }); }
  } catch {
    return res.status(502).json({ code: "upstream", error: "The AI didn't respond. Try again." });
  }
}
