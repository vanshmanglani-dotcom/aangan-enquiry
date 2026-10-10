export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Backup to Vaani webhooks: pull finished calls from Vaani's API and feed any we haven't
// processed yet into /api/vaani-webhook (same pipeline: Gemini -> Supabase -> Telegram -> HubSpot).
// Safe to call repeatedly: already-logged call_ids are skipped. Triggered every 5 min by GitHub Actions.
const API = "https://api.vaanivoice.ai/api";
const AGENT = process.env.VAANI_AGENT_NAME || "aangan-enquiry-riya";

export async function GET(req: NextRequest) {
  let key = process.env.VAANI_API_KEY;
  if (!key) return NextResponse.json({ error: "VAANI_API_KEY not set" }, { status: 500 });
  key = key.trim();
  let h: Record<string, string> = { "X-API-Key": key };

  // Try a few request shapes; report Vaani's own error text if all fail.
  const tries: [string, Record<string, string>][] = [
    [`${API}/call-history?page=1&page_size=20`, { "X-API-Key": key }],
    [`${API}/call-history`, { "X-API-Key": key }],
    [`${API}/call-history?page=1&page_size=20`, { Authorization: `Bearer ${key}` }],
    [`${API}/call-history?page=1&page_size=20`, { "x-api-key": key, Accept: "application/json" }],
  ];
  const attempts: any[] = [];
  let calls: any[] | null = null;
  for (const [url, hdr] of tries) {
    const r = await fetch(url, { headers: hdr, cache: "no-store" }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as any));
    if (r.ok) {
      const j = await r.json().catch(() => null);
      calls = j?.data || j?.calls || (Array.isArray(j) ? j : []);
      h = hdr;
      break;
    }
    attempts.push({ url: url.replace(API, ""), auth: Object.keys(hdr)[0], status: r.status, body: (await r.text()).slice(0, 300) });
  }
  if (!calls) return NextResponse.json({ error: "call-history failed", attempts }, { status: 502 });
  const mine = calls.filter((c) => c.agent_name === AGENT && c.post_processing_status === "completed");

  const ids = mine.map((c) => c.call_id);
  const { data: seen } = await db().from("calls").select("vaani_call_id").in("vaani_call_id", ids.length ? ids : ["-"]);
  const done = new Set((seen || []).map((r: any) => r.vaani_call_id));
  const todo = mine.filter((c) => !done.has(c.call_id));

  const results: any[] = [];
  for (const c of todo) {
    const d = await fetch(`${API}/call_details/${encodeURIComponent(c.call_id)}`, { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!d || typeof d.entity !== "object") continue; // not post-processed yet
    const start = Date.parse(c.Start_time), end = Date.parse(c.End_time);
    const durMs = isFinite(start) && isFinite(end) && end > start ? end - start : Number(c.duration_ms || 0);
    const payload = {
      event: "call_postprocessing",
      call_id: c.call_id,
      data: {
        call_id: c.call_id,
        call_duration: durMs,
        phone_number: c.from_number || c.call_metadata?.phone || null,
        summary: d.summary || c.call_summary,
        entities: d.entity,
        transcript: d.transcription,
        source: "vaani-sync",
      },
    };
    const r = await fetch(`${req.nextUrl.origin}/api/vaani-webhook?secret=${encodeURIComponent(process.env.WEBHOOK_SECRET || "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    results.push({ call_id: c.call_id, status: r.status });
  }
  return NextResponse.json({ ok: true, checked: mine.length, processed: results.length, results });
}
