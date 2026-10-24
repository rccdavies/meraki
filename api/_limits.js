import crypto from "node:crypto";

// Fair-use caps, counted server-side in Upstash Redis (Vercel Marketplace → Upstash for Redis).
// If no Redis is connected the caps are skipped (fail open) and a warning is logged.
export const LIMITS = {
  passDaily: 60,      // Standard AI uses per paid access code per day (shared if a code is shared)
  trialDaily: 40,     // Standard AI uses per trial code, per network, per day
  trialAdvanced: 3,   // Advanced uses per trial code, per network, for the life of the trial
  freePerMonth: 30,   // Standard AI uses per network per 30 days without a pass (devices also cap at 10)
};

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const limitsOn = () => !!(URL_ && TOKEN);

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map(x => x.result);
}

// Network identity: a salted hash of the IP address. The raw address is never stored.
export function netId(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim() || "unknown";
  return crypto.createHash("sha256").update((process.env.LIMIT_SALT || "meraki") + ip).digest("hex").slice(0, 20);
}
const h = s => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 20);
const today = () => new Date().toISOString().slice(0, 10);

// Count one use against a key. Returns {ok, used, limit}. Fails open on Redis errors.
async function take(key, limit, ttlSec) {
  if (!limitsOn()) return { ok: true, skipped: true };
  try {
    const [n] = await redis([["INCR", key], ["EXPIRE", key, String(ttlSec), "NX"]]);
    if (n > limit) { await redis([["DECR", key]]); return { ok: false, used: n - 1, limit }; }
    return { ok: true, used: n, limit };
  } catch (e) { console.error("limits_error", e.message); return { ok: true, skipped: true }; }
}

// Decide which bucket a Standard request falls into.
export function standardBucket(ent, tokens, net) {
  const paid = (ent?.purchases || []).find(p => /^pass_|^sprint/.test(p.sku));
  if (ent?.passUntil && paid) return { key: `fu:pass:${h(paid.id)}:${today()}`, limit: LIMITS.passDaily, ttl: 90000, kind: "pass" };
  if (ent?.passUntil && ent.trial) {
    const code = (tokens || []).find(t => typeof t === "string" && !/^cs_/.test(t)) || "trial";
    return { key: `fu:trial:${h(code.toUpperCase())}:${net}:${today()}`, limit: LIMITS.trialDaily, ttl: 90000, kind: "trial" };
  }
  if (ent?.passUntil) return { key: `fu:pass:${h(JSON.stringify(tokens))}:${today()}`, limit: LIMITS.passDaily, ttl: 90000, kind: "pass" };
  return { key: `fu:free:${net}`, limit: LIMITS.freePerMonth, ttl: 30 * 86400, kind: "free" };
}

export const takeStandard = b => take(b.key, b.limit, b.ttl);
export function takeTrialAdvanced(tokens, net) {
  const code = (tokens || []).find(t => typeof t === "string" && !/^cs_/.test(t)) || "trial";
  return take(`fu:trialadv:${h(code.toUpperCase())}:${net}`, LIMITS.trialAdvanced, 7 * 86400);
}
