export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Backup to Vaani webhooks: fetch finished calls from Vaani's API and feed any we haven't
// processed yet into /api/vaani-webhook (same pipeline: Gemini -> Supabase -> Telegram -> HubSpot).
// Safe to call repeatedly: already-logged call_ids are skipped. Triggered every 5 min by GitHub Actions,
// and polled by the dashboard after "Trigger call".
//
// Sources of call ids:
//  1. ?ids=a,b               (dashboard poll)
//  2. pending_calls table    (calls placed from the dashboard)
//  3. Vaani /call-history    (all calls; currently 500s on Vaani's side for this account)
const API = "https://api.vaanivoice.ai/api";
const AGENT = process.env.VAANI_AGENT_NAME || "aangan-enquiry-riya";

export async function GET(req: NextRequest) {
  const key = (process.env.VAANI_API_KEY || "").trim();
  if (!key) return NextResponse.json({ error: "VAANI_API_KEY not set" }, { status: 500 });
  const h = { "X-API-Key": key };
  const sb = db();

  const cands = new Map<string, any>();
  for (const id of (req.nextUrl.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean)) cands.set(id, { call_id: id });

  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const { data: pend } = await sb.from("pending_calls").select("*").gte("created_at", dayAgo);
  for (const p of pend || []) cands.set(p.vaani_call_id, { call_id: p.vaani_call_id, from_number: p.phone, pending: true });

  let historyError: any = null;
  const hist = await fetch(`${API}/call-history?page=1&page_size=50`, { headers: h, cache: "no-store" }).catch(() => null);
  if (hist?.ok) {
    const calls: any[] = (await hist.json().catch(() => null))?.data || [];
    for (const c of calls) if (c.agent_name === AGENT && c.post_processing_status === "completed") cands.set(c.call_id, { ...cands.get(c.call_id), ...c });
  } else {
    historyError = { status: hist?.status ?? 0, body: hist ? (await hist.text()).slice(0, 200) : "fetch failed" };
  }

  const ids = [...cands.keys()];
  const { data: seen } = await sb.from("calls").select("vaani_call_id").in("vaani_call_id", ids.length ? ids : ["-"]);
  const done = new Set((seen || []).map((r: any) => r.vaani_call_id));
  const todo = [...cands.values()].filter((c) => !done.has(c.call_id));

  const results: any[] = [];
  for (const c of todo) {
    const dr = await fetch(`${API}/call_details/${encodeURIComponent(c.call_id)}`, { headers: h, cache: "no-store" }).catch(() => null);
    const d = dr?.ok ? await dr.json().catch(() => null) : null;
    const ent = d?.entity && typeof d.entity === "object" && Object.keys(d.entity).length ? d.entity
      : c.call_entity && Object.keys(c.call_entity).length ? c.call_entity : null;
    if (!ent) { results.push({ call_id: c.call_id, waiting: true, details_status: dr?.status ?? 0 }); continue; } // not post-processed yet
    const start = Date.parse(c.Start_time), end = Date.parse(c.End_time);
    const durMs = isFinite(start) && isFinite(end) && end > start ? end - start : Number(c.duration_ms || d?.duration_ms || 0);
    const payload = {
      event: "call_postprocessing",
      call_id: c.call_id,
      data: {
        call_id: c.call_id,
        call_duration: durMs,
        phone_number: c.from_number || c.to_number || c.call_metadata?.phone || null,
        summary: d?.summary || c.call_summary,
        entities: ent,
        transcript: typeof d?.transcription === "string" ? d.transcription : JSON.stringify(d?.transcription ?? c.chat_history ?? ""),
        source: "vaani-sync",
      },
    };
    const r = await fetch(`${req.nextUrl.origin}/api/vaani-webhook?secret=${encodeURIComponent((process.env.WEBHOOK_SECRET || "").trim())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    results.push({ call_id: c.call_id, status: r.status });
  }
  const processed = results.filter((r) => r.status === 200).length;
  return NextResponse.json({ ok: true, checked: cands.size, processed, results, historyError });
}
