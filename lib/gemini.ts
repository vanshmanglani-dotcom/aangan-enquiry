// Gemini Flash: cheap, fast classification + routing. No judgment calls — humans own UNSURE.
const RULE = `QUALIFIED = YES if Pune area AND full home or office scope AND budget >= 8 lakh AND timeline <= 6 months.
NO if outside the service area or a service the studio does not offer. Otherwise UNSURE.
PRIORITY = HIGH if the caller was upset, asked for a human/Nikhil, or is YES; else NORMAL.
ROUTE = residential (homes), commercial (offices), human_review (UNSURE or HIGH-upset), none (NO).`;

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
  try { out = JSON.parse(text); } catch { out = { qualified: "UNSURE", reason: "classifier parse error", priority: "NORMAL", route_to: "human_review" }; }
  return { ...out, ai_cost_inr };
}
