import { entitlements, spendAdvanced, TRIAL_ADVANCED } from "./_access.js";

const MODELS = {
  standard: process.env.MODEL_STANDARD || "claude-sonnet-5-5",
  advanced: process.env.MODEL_ADVANCED || "claude-opus-5-5",
};

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "unavailable", error: "AI isn't switched on yet." });
  const { prompt, tier, images, tokens, trialAdvUsed } = req.body || {};
  if (typeof prompt !== "string" || prompt.length < 20 || prompt.length > 60000)
    return res.status(400).json({ code: "bad_request", error: "Nothing to read." });

  const adv = tier === "advanced";
  if (adv) {
    const ent = await entitlements(tokens).catch(() => null);
    const trialOk = ent && ent.advanced < 1 && ent.trial && (Number(trialAdvUsed) || 0) < TRIAL_ADVANCED;
    if (!ent || (ent.advanced < 1 && !trialOk)) return res.status(402).json({ code: "no_credits", error: "You're out of Advanced credits. Top up on the Plans page." });
    if (!trialOk) await spendAdvanced(ent);
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
        max_tokens: 8000,
        system: "Answer by calling the respond tool once. Put the complete answer object, with exactly the keys the user asks for, in the tool input.",
        tools: [{ name: "respond", description: "Return the answer as a JSON object.", input_schema: { type: "object", additionalProperties: true } }],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content }],
      }),
    });
    if (r.status === 429 || r.status === 529) return res.status(429).json({ code: "rate_limited", error: "Busy right now. Try again in a minute." });
    if (!r.ok) {
      console.error("anthropic_error", r.status, (await r.text()).slice(0, 500));
      return res.status(502).json({ code: "upstream", error: "The AI didn't respond. Try again." });
    }
    const data = await r.json();
    const tool = (data.content || []).find(c => c.type === "tool_use");
    if (tool && tool.input && typeof tool.input === "object" && Object.keys(tool.input).length) {
      // Some models wrap the answer in a single key; unwrap if so.
      const keys = Object.keys(tool.input);
      const out = keys.length === 1 && typeof tool.input[keys[0]] === "object" && !Array.isArray(tool.input[keys[0]]) ? tool.input[keys[0]] : tool.input;
      return res.json({ json: out });
    }
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    const a2 = text.indexOf("{"), b2 = text.lastIndexOf("}");
    try { return res.json({ json: JSON.parse(text.slice(a2, b2 + 1)) }); }
    catch {
      console.error("invalid_json", data.stop_reason, text.slice(0, 300));
      return res.status(502).json({ code: "invalid_json", error: "The reply came back garbled. Try again." });
    }
  } catch {
    return res.status(502).json({ code: "upstream", error: "The AI didn't respond. Try again." });
  }
}
