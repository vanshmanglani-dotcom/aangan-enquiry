export async function sendHandoff(c: any) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return false;
  const esc = (s: any) => String(s ?? "—").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]!));
  const text = [
    `🏠 <b>NEW LEAD — ${esc(c.qualified)} | ${esc(c.priority)}</b>  → ${esc(c.route_to)}`,
    `👤 ${esc(c.name)} · 📞 ${esc(c.caller_phone)}`,
    `📍 ${esc(c.location)} · ${esc(c.property_type)}, ${esc(c.size_sqft)} sq ft`,
    `🛠 ${esc(c.scope)}`,
    `⏱ ${esc(c.timeline)} · 💰 ${esc(c.budget)} · 📣 ${esc(c.lead_source)}`,
    `📝 ${esc(c.summary)}`,
    `☎️ Call back: ${esc(c.callback_time)}`,
    `Why: ${esc(c.qualify_reason)}`,
    process.env.CAL_LINK ? `📅 Book site visit: ${process.env.CAL_LINK}` : "",
  ].filter(Boolean).join("\n");
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
  });
  return r.ok;
}
