"use client";
import { useState } from "react";

export default function TriggerCall() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/trigger-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name, pin }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Call failed");
      setMsg({ ok: true, text: `Riya is calling ${j.phone}. Pick up and talk like a customer. The result appears here a minute or two after you hang up.` });
      // Poll for the result for ~8 minutes, then refresh the table.
      let n = 0;
      const t = setInterval(async () => {
        n++;
        const s = await fetch(`/api/sync-vaani?ids=${encodeURIComponent(j.call_id)}`).then((x) => x.json()).catch(() => null);
        if (s?.processed > 0 || n >= 24) { clearInterval(t); location.reload(); }
      }, 20000);
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const input = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d5d9e3", fontSize: 15, minWidth: 0 } as const;
  return (
    <form onSubmit={go} style={{ background: "#fff", borderRadius: 12, padding: 16, margin: "0 0 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Test Riya on a real phone</div>
      <div style={{ fontSize: 13, color: "#5b6785", marginBottom: 12 }}>Enter a mobile number and Riya will call it.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...input, flex: "2 1 180px" }} placeholder="Mobile number, e.g. 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ ...input, flex: "0 1 110px" }} placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} required />
        <button disabled={busy} style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#1b2a4a", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Calling…" : "📞 Trigger call"}
        </button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 14, color: msg.ok ? "#1a7f37" : "#b42318" }}>{msg.text}</div>}
    </form>
  );
}
