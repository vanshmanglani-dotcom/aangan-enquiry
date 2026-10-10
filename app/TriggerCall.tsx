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

  return (
    <form onSubmit={go} className="tc-form">
      <div className="tc-hint">Enter a mobile number and Riya will call it. Pick up and talk like a customer.</div>
      <div className="tc-row">
        <input className="tc-in" placeholder="Mobile number, e.g. 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
        <input className="tc-in" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="tc-in pin" placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} required />
        <button className="tc-btn" disabled={busy}>{busy ? "Calling…" : "Trigger call →"}</button>
      </div>
      {msg && <div className={"tc-msg " + (msg.ok ? "ok" : "err")}>{msg.text}</div>}
    </form>
  );
}
