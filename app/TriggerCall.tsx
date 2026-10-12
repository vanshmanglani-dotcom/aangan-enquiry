"use client";
import { useEffect, useRef, useState } from "react";

const LK_SRC = "https://cdn.jsdelivr.net/npm/livekit-client@2.5.7/dist/livekit-client.umd.js";
function loadLiveKit(): Promise<any> {
  const w = window as any;
  if (w.LivekitClient) return Promise.resolve(w.LivekitClient);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = LK_SRC; s.async = true;
    s.onload = () => (w.LivekitClient ? res(w.LivekitClient) : rej(new Error("Voice library failed to load")));
    s.onerror = () => rej(new Error("Voice library failed to load"));
    document.head.appendChild(s);
  });
}

type Status = "idle" | "connecting" | "live" | "ended";

export default function TriggerCall() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const room = useRef<any>(null);
  const audioEls = useRef<HTMLMediaElement[]>([]);

  useEffect(() => {
    if (status !== "live") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => () => { room.current?.disconnect(); }, []);

  function pollResult(callId: string) {
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const s = await fetch(`/api/sync-vaani?ids=${encodeURIComponent(callId)}`).then((x) => x.json()).catch(() => null);
      if (s?.processed > 0 || n >= 24) { clearInterval(t); location.reload(); }
    }, 20000);
  }

  async function start(mode: "web" | "phone") {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/trigger-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, name, pin, mode }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Call failed");
      if (mode === "phone") {
        setMsg({ ok: true, text: `Riya is calling ${j.phone}. Pick up and talk like a customer. The result appears here a minute or two after you hang up.` });
        pollResult(j.call_id);
        return;
      }
      setStatus("connecting");
      const LK = await loadLiveKit();
      const rm = new LK.Room({ adaptiveStream: true, dynacast: true });
      room.current = rm;
      rm.on(LK.RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === "audio") { const el = track.attach(); el.style.display = "none"; document.body.appendChild(el); audioEls.current.push(el); }
      });
      rm.on(LK.RoomEvent.ActiveSpeakersChanged, (sp: any[]) => setSpeaking(sp.some((p) => p.identity !== rm.localParticipant.identity)));
      rm.on(LK.RoomEvent.Disconnected, () => {
        audioEls.current.forEach((el) => el.remove()); audioEls.current = [];
        setStatus("ended"); setSpeaking(false);
        setMsg({ ok: true, text: "Call ended. Riya is writing up the lead; it appears in the ledger (and on Telegram / HubSpot if qualified) in a minute or two." });
        pollResult(j.call_id);
      });
      await rm.connect(j.url, j.token);
      await rm.startAudio().catch(() => {});
      await rm.localParticipant.setMicrophoneEnabled(true);
      setSecs(0);
      setStatus("live");
    } catch (err: any) {
      room.current?.disconnect(); room.current = null;
      setStatus("idle");
      setMsg({ ok: false, text: /permission|NotAllowed/i.test(err?.message || "") ? "Microphone blocked. Allow mic access in the browser and try again." : err.message });
    } finally {
      setBusy(false);
    }
  }

  const live = status === "connecting" || status === "live";
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="tc-form">
      {!live ? (
        <>
          <div className="tc-hint">Talk to Riya live in your browser (mic on). Play a customer: “3BHK in Kothrud, full interiors, moving in March…”</div>
          <form className="tc-row" onSubmit={(e) => { e.preventDefault(); start("web"); }}>
            <input className="tc-in" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="tc-in pin" placeholder="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} required />
            <button className="tc-btn" disabled={busy}>{busy ? "Connecting…" : "🎙 Talk to Riya now"}</button>
          </form>
          <details className="tc-more">
            <summary>Or have Riya call a phone number</summary>
            <form className="tc-row" onSubmit={(e) => { e.preventDefault(); start("phone"); }}>
              <input className="tc-in" placeholder="Mobile number, e.g. 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
              <button className="tc-btn ghost" disabled={busy || !pin}>Call my phone →</button>
            </form>
            <div className="tc-hint small">Needs a phone number on the Vaani account; uses the same PIN as above.</div>
          </details>
        </>
      ) : (
        <div className="tc-live">
          <div className={"tc-orb" + (speaking ? " talk" : "") + (status === "connecting" ? " wait" : "")}><span /><span /><span /></div>
          <div className="tc-livetext">
            <div className="tc-livetitle">{status === "connecting" ? "Connecting to Riya…" : speaking ? "Riya is speaking" : "Listening… speak now"}</div>
            <div className="tc-hint">{status === "live" ? `Live · ${mmss}` : "Allow microphone access if your browser asks."}</div>
          </div>
          <button className="tc-btn end" onClick={() => room.current?.disconnect()} disabled={status !== "live"}>End call</button>
        </div>
      )}
      {msg && <div className={"tc-msg " + (msg.ok ? "ok" : "err")}>{msg.text}</div>}
      <style dangerouslySetInnerHTML={{ __html: `
.tc-more{font-size:13px}.tc-more summary{cursor:pointer;color:#555;font-weight:600;margin:2px 0 10px}.tc-more summary:hover{color:#000}
.tc-hint.small{font-size:12px;margin-top:6px}
.tc-btn.ghost{background:#fff;color:#000}.tc-btn.ghost:hover{color:#fff}
.tc-btn.end{background:#d0102b;border-color:#d0102b;margin-left:auto}
.tc-live{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.tc-livetitle{font-weight:800;font-size:22px;letter-spacing:-.03em}
.tc-orb{position:relative;width:64px;height:64px;flex:0 0 64px}
.tc-orb span{position:absolute;inset:0;border-radius:50%;border:1.5px solid #e2552b}
.tc-orb span:first-child{background:#000;border-color:#000;inset:14px;transition:transform .2s}
.tc-orb span:nth-child(2){animation:tcRing 2s ease-out infinite}
.tc-orb span:nth-child(3){animation:tcRing 2s 1s ease-out infinite}
.tc-orb.talk span:first-child{background:#e2552b;border-color:#e2552b;transform:scale(1.25)}
.tc-orb.talk span:nth-child(2),.tc-orb.talk span:nth-child(3){animation-duration:.9s}
.tc-orb.wait span:first-child{animation:tcBlink 1s ease-in-out infinite}
@keyframes tcRing{from{transform:scale(.6);opacity:1}to{transform:scale(1.35);opacity:0}}
@keyframes tcBlink{50%{opacity:.3}}
` }} />
    </div>
  );
}
