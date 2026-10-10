// Gemini Flash: cheap, fast classification + routing using Nikhil's qualified.md rubric. Humans own UNSURE.
const RULE = `Apply Nikhil's 5 criteria. YES = real project (design+execution, at least one room), Pune city or PCMC, site available for execution within ~8-10 weeks with a realistic completion date, no volunteered budget clearly below scope, caller is decision-maker or authorised (or owners attend consultation). Unclear on budget or decision-maker = still YES (note it). NO = outside Pune/PCMC, advice-only, timeline impossible (e.g. done in 3 weeks), volunteered budget clearly too low, out-of-scope service (restaurant, gym, commercial under ~500 sq ft), or two+ criteria fail. UNSURE = unclear on project type, area or timeline and caller did not answer. Existing-client complaints = UNSURE with priority HIGH.
PRIORITY = HIGH if existing-client complaint, caller frustrated about a missed follow-up, or asked for Nikhil/a senior person; else NORMAL.
ROUTE = residential (homes), commercial (offices), human_review (UNSURE or existing client), none (NO).`;

export async function classify(fields: Record<string, any>, transcript: string) {
  const prompt = `You classify inbound enquiry calls for Aangan Studio (interior design, Pune).
${RULE}
Extracted fields: ${JSON.stringify(fields)}
Transcript: ${transcript.slice(0, 6000)}
Reply ONLY JSON: {"qualified":"YES|NO|UNSURE","reason":"<=20 words","priority":"HIGH|NORMAL","route_to":"residential|commercial|human_review|none","summary":"2 lines for the designer"}`;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    }
  );
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usage = j?.usageMetadata || {};
  // Rough INR cost (Flash ~ $0.30 / 1M in, $2.50 / 1M out, 1 USD ~ 88 INR) — update if pricing changes
  const ai_cost_inr = ((usage.promptTokenCount || 0) * 0.3 + (usage.candidatesTokenCount || 0) * 2.5) / 1e6 * 88;
  let out: any = {};
  try { out = JSON.parse(text); } catch { out = {}; }
  // Fallback: if Gemini errored or returned nothing usable, use Vaani's own "Lead Qualified" extraction.
  if (!["YES", "NO", "UNSURE"].includes(String(out.qualified || "").toUpperCase())) {
    const vq = String(fields.vaani_qualified || "").toUpperCase();
    const q = ["YES", "NO", "UNSURE"].includes(vq) ? vq : "UNSURE";
    const err = j?.error?.message ? `Gemini error: ${String(j.error.message).slice(0, 80)}` : "Gemini returned no result";
    out = {
      qualified: q,
      reason: `Vaani extraction used (${err})`,
      priority: q === "YES" ? "HIGH" : "NORMAL",
      route_to: q === "NO" ? "none" : q === "YES" ? (/office|commercial|clinic|studio/i.test(String(fields.property_type || "")) ? "commercial" : "residential") : "human_review",
      summary: fields.vaani_summary,
    };
  }
  out.qualified = String(out.qualified).toUpperCase();
  return { ...out, ai_cost_inr };
}
