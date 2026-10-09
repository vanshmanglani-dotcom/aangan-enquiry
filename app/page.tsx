import { db } from "@/lib/supabase";
export const dynamic = "force-dynamic";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function Page() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db().from("calls").select("*").gte("created_at", since).order("created_at", { ascending: false });
  const calls = data || [];
  const n = calls.length;
  const yes = calls.filter((c) => c.qualified === "YES").length;
  const unsure = calls.filter((c) => c.qualified === "UNSURE").length;
  const afterHours = calls.filter((c) => { const h = new Date(c.created_at).getUTCHours() + 5.5; const hh = h % 24; return hh < 10 || hh >= 19; }).length;
  const vaani = calls.reduce((s, c) => s + Number(c.vaani_cost_inr || 0), 0);
  const ai = calls.reduce((s, c) => s + Number(c.ai_cost_inr || 0), 0);
  const total = vaani + ai;
  const avgAns = n ? calls.reduce((s, c) => s + Number(c.answered_in_sec || 0), 0) / n : 0;

  const tiles = [
    ["Calls (30 days)", n],
    ["Answered < 5 min", n ? "100%" : "—"],
    ["Avg answer time", `${avgAns.toFixed(0)}s`],
    ["After-hours calls", `${afterHours} (${n ? Math.round((afterHours / n) * 100) : 0}%)`],
    ["Qualified (YES)", `${yes} (${n ? Math.round((yes / n) * 100) : 0}%)`],
    ["Needs review (UNSURE)", unsure],
    ["Tool cost (Vaani + AI)", inr(total)],
    ["Cost per qualified lead", yes ? inr(total / yes) : "—"],
  ];

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>Aangan Studio · Enquiry Dashboard</h1>
      <p style={{ marginTop: 0, color: "#5b6785" }}>Every phone enquiry, answered by Riya. Live from Supabase — no manual counting.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, margin: "20px 0" }}>
        {tiles.map(([k, v]) => (
          <div key={k as string} style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 13, color: "#5b6785" }}>{k}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ textAlign: "left", background: "#1b2a4a", color: "#fff" }}>
            {["When", "Name", "Property", "Location", "Budget", "Lead", "Route", "Telegram", "Cost"].map((h) => <th key={h} style={{ padding: 10 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid #eef0f5" }}>
                <td style={{ padding: 10 }}>{new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</td>
                <td style={{ padding: 10 }}>{c.name || "—"}</td>
                <td style={{ padding: 10 }}>{c.property_type || "—"}</td>
                <td style={{ padding: 10 }}>{c.location || "—"}</td>
                <td style={{ padding: 10 }}>{c.budget || "—"}</td>
                <td style={{ padding: 10, fontWeight: 700, color: c.qualified === "YES" ? "#1a7f37" : c.qualified === "NO" ? "#b42318" : "#9a6700" }}>{c.qualified}</td>
                <td style={{ padding: 10 }}>{c.route_to}</td>
                <td style={{ padding: 10 }}>{c.telegram_sent ? "✓" : ""}</td>
                <td style={{ padding: 10 }}>{inr(Number(c.vaani_cost_inr || 0) + Number(c.ai_cost_inr || 0))}</td>
              </tr>
            ))}
            {!n && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#5b6785" }}>No calls yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
