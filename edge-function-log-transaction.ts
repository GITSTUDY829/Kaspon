/**
 * KASPON — Supabase Edge Function  (SMS-parsing version)
 * File: supabase/functions/log-transaction/index.ts
 *
 * The iOS Shortcut sends the RAW SMS text. All parsing happens here,
 * server-side, for AMEX / max / Isracard formats.
 *
 * Security model:
 *   - Caller must provide the correct x-kaspon-secret header
 *   - Inserts use the service_role key (never exposed to the client)
 *   - user_id comes from env variable (not from the caller)
 *   - Israel timezone (Asia/Jerusalem) used for missing date/time
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── AUTO-CATEGORY ─────────────────────────────────────────────────────
const CAT_RULES: [RegExp, string][] = [
  [/שופרסל|רמי.?לוי|ויקטורי|מגה|סופר|grocery|yeinot/i,        "food"],
  [/קפה|cafe|coffee|ארומה|מאפה|bakery|starbucks|ג'ירף/i,      "restaurants"],
  [/מסעדה|pizza|פיצה|סושי|בורגר|שווארמה|restaurant/i,         "restaurants"],
  [/גט|gett|bolt|uber|רב.?קו|אוטובוס|רכבת|taxi|bus/i,          "transport"],
  [/פארם|pharmacy|מרפאה|רופא|dental|clinic|כושר|gym|sport/i,  "health"],
  [/yes\b|hot\b|bezeq|013|012|cellcom|partner|internet|cable/i,"bills"],
  [/spotify|netflix|apple|google|disney|hbo|icloud|monday/i,   "tech"],
  [/ikea|h&m|zara|adidas|nike|נייקי|next|gap|קניון|fashion/i,  "shopping"],
  [/amazon|ebay|aliexpress/i,                                  "shopping"],
  [/yes.?planet|cinema|סינמה|theater|concert/i,                "entertainment"],
];
function autocat(merchant: string): string {
  for (const [re, cat] of CAT_RULES) if (re.test(merchant)) return cat;
  return "other";
}

// ─── ISRAEL "NOW" ──────────────────────────────────────────────────────
function israelNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
}

// ─── SMS PARSER ────────────────────────────────────────────────────────
interface Parsed {
  ok: boolean;
  reason?: string;
  issuer?: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  date?: string;
  time?: string;
  category?: string;
}

function parseSMS(raw: string): Parsed {
  const text = String(raw).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };

  // 1. Issuer
  let issuer = "unknown";
  if (/אמריקן אקספרס|amex/i.test(text))                     issuer = "amex";
  else if (/ישראכרט|isracard/i.test(text))                  issuer = "isracard";
  else if (/\bmax\b|עסקת אינטרנט|ביקשת שנעדכן/i.test(text))  issuer = "max";

  // 2. Amount — ALWAYS the number after "בסך" (never the balance)
  const amtM = text.match(/בסך\s*([\d,]+(?:\.\d+)?)\s*(ש"ח|₪|\$|דולר|usd)?/i);
  if (!amtM) return { ok: false, reason: "no_amount" };
  const amount = parseFloat(amtM[1].replace(/,/g, ""));
  if (!isFinite(amount) || amount === 0) return { ok: false, reason: "bad_amount" };

  // 3. Currency
  const cur = (amtM[2] || "").toLowerCase();
  const currency = /\$|דולר|usd/.test(cur) ? "USD" : "ILS";

  // 4. Merchant
  let merchant: string | null = null;
  if (issuer === "max") {
    const m = text.match(/בית עסק\s*(.+?)\s*חייב/);
    if (m) merchant = m[1];
  }
  if (!merchant) {
    const m = text.match(/(?:ש"ח|₪)\s*ב([^.,]+)/);   // "...ש"ח ב<merchant>"
    if (m) merchant = m[1];
  }
  if (!merchant) {
    const m = text.match(/(?:\$|דולר)\s*ב?([^.,]+)/); // USD / generic fallback
    if (m) merchant = m[1];
  }
  merchant = (merchant || "").trim().slice(0, 200);
  if (!merchant) return { ok: false, reason: "no_merchant" };

  // 5. Date — DD/MM or DD/MM/YYYY
  const dM = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  const now = israelNow();
  let dateStr: string;
  if (dM) {
    const dd = String(dM[1]).padStart(2, "0");
    const mm = String(dM[2]).padStart(2, "0");
    const yyyy = dM[3] ? (dM[3].length === 2 ? "20" + dM[3] : dM[3]) : String(now.getFullYear());
    let cand = `${yyyy}-${mm}-${dd}`;
    if (!dM[3]) {                                    // year-boundary guard
      const cd = new Date(cand + "T00:00:00");
      if (cd.getTime() - now.getTime() > 2 * 864e5) cand = `${+yyyy - 1}-${mm}-${dd}`;
    }
    dateStr = cand;
  } else {
    dateStr = now.toISOString().split("T")[0];
  }

  // 6. Time — HH:MM (Isracard provides it; others use now)
  const tM = text.match(/(?:בשעה\s*)?(\d{1,2}):(\d{2})/);
  const timeStr = tM
    ? `${String(tM[1]).padStart(2, "0")}:${tM[2]}`
    : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return { ok: true, issuer, merchant, amount, currency, date: dateStr, time: timeStr,
           category: autocat(merchant) };
}

// ─── CORS ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "x-kaspon-secret, content-type",
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ─── MAIN ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return respond({ error: "Method not allowed" }, 405);

  // 1. Authenticate the Shortcut
  const KASPON_SECRET = Deno.env.get("KASPON_SECRET");
  if (!KASPON_SECRET) {
    console.error("KASPON_SECRET not set");
    return respond({ error: "Server misconfigured" }, 500);
  }
  const incoming = req.headers.get("x-kaspon-secret") ?? "";
  const enc = new TextEncoder();
  const a = enc.encode(incoming.padEnd(64));
  const b = enc.encode(KASPON_SECRET.padEnd(64));
  let mismatch = 0;
  for (let i = 0; i < 64; i++) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0 || incoming.length !== KASPON_SECRET.length) {
    console.warn("Unauthorized:", req.headers.get("x-forwarded-for") ?? "unknown");
    return respond({ error: "Unauthorized" }, 401);
  }

  // 2. Body
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return respond({ error: "Invalid JSON body" }, 400); }

  const rawSms = String(body.sms ?? body.raw_notification ?? body.text ?? "").trim();
  if (!rawSms) return respond({ error: "sms field is required" }, 400);

  // 3. Parse
  const p = parseSMS(rawSms);
  if (!p.ok) {
    // Not a transaction (promo, OTP, etc.) — accept quietly, insert nothing
    console.log("Skipped non-transaction SMS:", p.reason);
    return respond({ ok: false, skipped: true, reason: p.reason }, 200);
  }

  // Optional overrides from the Shortcut (e.g. attach current location)
  const locName = body.location_name ? String(body.location_name).slice(0, 200) : null;
  const method  = body.method ? String(body.method).slice(0, 50) : "Apple Pay";

  // 4. Owner user_id from env
  const KASPON_USER_ID = Deno.env.get("KASPON_USER_ID");
  if (!KASPON_USER_ID) {
    console.error("KASPON_USER_ID not set");
    return respond({ error: "Server misconfigured" }, 500);
  }

  // 5. Insert via service role
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb.from("transactions").insert({
    user_id:          KASPON_USER_ID,
    merchant:         p.merchant,
    amount:           -Math.abs(p.amount!),  // expense → negative
    currency:         p.currency,
    date:             p.date,
    time:             p.time,
    method,
    category:         p.category,
    location_name:    locName,
    raw_notification: rawSms.slice(0, 500),
    source:           "shortcut",
  }).select("id").single();

  if (error) {
    console.error("DB insert error:", error.message, error.code);
    return respond({ error: "Database error" }, 500);
  }

  console.log(`✓ ${p.issuer}: ${p.merchant} ${p.currency} ${p.amount} [id=${data.id}]`);
  return respond({
    ok: true, id: data.id, issuer: p.issuer, merchant: p.merchant,
    amount: -Math.abs(p.amount!), currency: p.currency,
    date: p.date, time: p.time, category: p.category,
  });
});
