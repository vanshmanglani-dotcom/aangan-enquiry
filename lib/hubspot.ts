// Qualified calls become deals (HubSpot free CRM).
export async function createDeal(c: any): Promise<string | null> {
  if (!process.env.HUBSPOT_TOKEN) return null;
  const h = { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json" };
  const r = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      properties: {
        dealname: `${c.name || "Caller"} — ${c.property_type || "Interiors"} (${c.location || "?"})`,
        pipeline: "default",
        dealstage: "appointmentscheduled",
        description: `${c.summary || ""}\nBudget: ${c.budget || "—"} | Timeline: ${c.timeline || "—"} | Phone: ${c.caller_phone || "—"}`,
      },
    }),
  });
  if (!r.ok) return null;
  return (await r.json()).id ?? null;
}
