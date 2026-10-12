export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Dashboard "Test Riya". Two modes:
//   mode "web"   -> in-browser voice call (Vaani WebRTC): returns a LiveKit token the page connects with.
//   mode "phone" -> Riya phones a number (Vaani outbound). Needs a phone number on the Vaani account.
// Guarded by TRIGGER_PIN and a 5-calls/hour cap so the public dashboard can't be abused.
const AGENT_ID = process.env.VAANI_AGENT_ID || "f327f068-6fd3-43f3-8b87-ee4bdef0138c";

export async function POST(req: NextRequest) {
  const { phone, name, pin, mode } = await req.json().catch(() => ({}));
  const want = (process.env.TRIGGER_PIN || "").trim();
  if (!want) return NextResponse.json({ error: "TRIGGER_PIN not set in Vercel" }, { status: 503 });
  if (String(pin || "").trim() !== want) return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  const key = (process.env.VAANI_API_KEY || "").trim();
  if (!key) return NextResponse.json({ error: "VAANI_API_KEY not set" }, { status: 500 });

  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await db().from("pending_calls").select("*", { count: "exact", head: true }).gte("created_at", hourAgo);
  if ((count || 0) >= 5) return NextResponse.json({ error: "Limit reached: 5 test calls per hour" }, { status: 429 });

  const web = mode !== "phone";
  let number: string | null = null;
  if (!web) {
    let digits = String(phone || "").replace(/[^\d]/g, "");
    if (digits.length === 10) digits = "91" + digits;
    if (!/^91[6-9]\d{9}$/.test(digits)) return NextResponse.json({ error: "Enter a valid Indian mobile number" }, { status: 400 });
    number = "+" + digits;
  }

  const body = web
    ? { agent_id: AGENT_ID, medium: "webrtc", metadata: {}, primary_language: "en", secondary_language: "hi" }
    : { agent_id: AGENT_ID, medium: "telephony", contact_number: number, name: String(name || "Test caller").slice(0, 60), metadata: {}, dnd_check_skipped: true };
  const r = await fetch("https://api.vaanivoice.ai/api/trigger-call/", {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch {}

  if (web) {
    if (!r.ok || !j?.token || !j?.connection_url) {
      const e = j?.error || j?.detail || j?.message || text.slice(0, 200) || `Vaani ${r.status}`;
      return NextResponse.json({ error: typeof e === "string" ? e : JSON.stringify(e) }, { status: 502 });
    }
    await db().from("pending_calls").upsert({ vaani_call_id: j.room_name, phone: "web", name: name || null });
    return NextResponse.json({ ok: true, mode: "web", call_id: j.room_name, token: j.token, url: j.connection_url });
  }

  const callId = j?.output?.call_id;
  if (!r.ok || !callId) {
    let e = j?.error || j?.detail || j?.message || text.slice(0, 200) || `Vaani ${r.status}`;
    if (r.status === 403 || /forbidden/i.test(String(e))) e = "Phone calls need a phone number on the Vaani account. Use “Talk to Riya now” instead.";
    return NextResponse.json({ error: typeof e === "string" ? e : JSON.stringify(e) }, { status: 502 });
  }
  await db().from("pending_calls").upsert({ vaani_call_id: callId, phone: number, name: name || null });
  return NextResponse.json({ ok: true, mode: "phone", call_id: callId, phone: number });
}
