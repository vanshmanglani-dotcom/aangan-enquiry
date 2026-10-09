import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { classify } from "@/lib/gemini";
import { sendHandoff } from "@/lib/telegram";
import { createDeal } from "@/lib/hubspot";

// Vaani post-call webhook. Payload shape varies by plan, so we read defensively.
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
    if (v !== undefined && v !== null && v !== "" && v !== "NA") return v;
  }
  return null;
};

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.WEBHOOK_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.json();
  const ex = pick(raw, "extractions", "data_collection", "extracted_data", "analysis.extractions") || {};
  const get = (...k: string[]) => pick(ex, ...k);
  const transcript = typeof raw.transcript === "string" ? raw.transcript : JSON.stringify(raw.transcript ?? raw.messages ?? "");
  const duration = Number(pick(raw, "duration", "duration_sec", "call_duration", "call.duration") || 0);

  const fields = {
    name: get("Customer Name", "customer_name", "name"),
    property_type: get("Property Type", "property_type"),
    location: get("Location", "location"),
    size_sqft: get("Size Sq Ft", "size_sqft"),
    scope: get("Scope", "scope"),
    timeline: get("Timeline", "timeline"),
    budget: get("Budget", "budget"),
    lead_source: get("Lead Source", "lead_source"),
    callback_time: get("Callback Time", "callback_time"),
    vaani_qualified: get("Lead Qualified", "lead_qualified"),
    vaani_summary: get("Designer Handoff Summary", "summary"),
  };

  const ai = await classify(fields, transcript);

  const row: any = {
    vaani_call_id: pick(raw, "call_id", "id", "call.id"),
    caller_phone: pick(raw, "from", "caller", "customer_number", "phone_number", "call.from"),
    ...Object.fromEntries(Object.entries(fields).filter(([k]) => !k.startsWith("vaani_"))),
    summary: ai.summary || fields.vaani_summary,
    qualified: ai.qualified,
    qualify_reason: ai.reason,
    priority: ai.priority,
    route_to: ai.route_to,
    answered_in_sec: Number(pick(raw, "answered_in_sec", "ring_duration") || 0),
    duration_sec: duration,
    vaani_cost_inr: Number(pick(raw, "cost", "call_cost") ?? (duration / 60) * Number(process.env.VAANI_RATE_PER_MIN || 5.6)),
    ai_cost_inr: ai.ai_cost_inr,
    transcript,
    raw,
  };

  // Boundary (Check 07): only YES/UNSURE reach a designer; NO is logged, never auto-rejected by a human-facing message.
  if (row.qualified === "YES" || row.qualified === "UNSURE") row.telegram_sent = await sendHandoff(row);
  if (row.qualified === "YES") row.hubspot_deal_id = await createDeal(row);

  const { error } = await db().from("calls").upsert(row, { onConflict: "vaani_call_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, qualified: row.qualified, route_to: row.route_to });
}
