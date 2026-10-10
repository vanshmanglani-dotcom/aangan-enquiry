"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import TriggerCall from "./TriggerCall";

type Call = Record<string, any>;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const istHour = (iso: string) => (new Date(iso).getUTCHours() + 5.5 + (new Date(iso).getUTCMinutes() >= 30 ? 0.5 : 0)) % 24 | 0;

// ---- Sample data (clearly labelled, toggle off to see only real calls) ----
const SAMPLE: [string, string, string, string, string, "YES" | "NO" | "UNSURE", string, number, number][] = [
  // name, property, location, budget, route, lead, hoursAgo(minus), answeredSec, durationMin
  ["Meera Joshi", "3BHK apartment", "Baner, Pune", "₹18–22L", "residential", "YES", "2", 3, 4.2],
  ["Rohan Deshpande", "2BHK apartment", "Wakad, Pune", "₹10–12L", "residential", "YES", "7", 2, 3.6],
  ["Sana Shaikh", "Office, 1,400 sq ft", "Hinjewadi, Pune", "₹35–40L", "commercial", "YES", "11", 4, 5.1],
  ["Aditya Kulkarni", "Living room only", "Aundh, Pune", "—", "human_review", "UNSURE", "15", 3, 2.4],
  ["Neha Patil", "4BHK villa", "Koregaon Park, Pune", "₹60L+", "residential", "YES", "22", 2, 6.3],
  ["Vikram Rao", "Restaurant", "Viman Nagar, Pune", "₹25L", "none", "NO", "27", 5, 1.9],
  ["Pooja Iyer", "3BHK apartment", "Kharadi, Pune", "₹16L", "residential", "YES", "33", 3, 4.8],
  ["Kunal Mehta", "2BHK apartment", "Nashik", "₹9L", "none", "NO", "41", 2, 2.1],
  ["Anjali Gokhale", "3BHK (parents' home)", "Kothrud, Pune", "₹20L", "residential", "YES", "52", 3, 5.5],
  ["Farhan Ali", "Kitchen + 1 bedroom", "Hadapsar, Pune", "₹1.2L", "none", "NO", "64", 4, 2.7],
  ["Ishita Sen", "Startup office, 900 sq ft", "Baner, Pune", "₹18L", "commercial", "YES", "75", 2, 4.0],
  ["Tejas More", "\"How much per sq ft?\"", "—", "—", "human_review", "UNSURE", "88", 3, 1.3],
  ["Ritu Agarwal", "4BHK apartment", "NIBM, Pune", "₹35–40L", "residential", "YES", "101", 2, 5.9],
  ["Omkar Pawar", "2BHK, before Diwali", "Undri, Pune", "₹12L", "none", "NO", "118", 3, 2.2],
  ["Shreya Nair", "3BHK + 2 home offices", "Aundh, Pune", "₹28L", "residential", "YES", "140", 2, 6.8],
  ["Devansh Bhat", "Coworking pod, 180 sq ft", "Magarpatta, Pune", "₹4L", "none", "NO", "163", 4, 1.6],
];
function sampleRows(now: number): Call[] {
  return SAMPLE.map(([name, property_type, location, budget, route_to, qualified, h, ans, mins], i) => {
    const created = new Date(now - Number(h) * 3600e3 - i * 911e3).toISOString();
    const vaani = mins * 5.6;
    return { id: "sample-" + i, sample: true, created_at: created, name, property_type, location, budget, route_to, qualified,
      telegram_sent: qualified !== "NO", answered_in_sec: ans, duration_sec: mins * 60, vaani_cost_inr: vaani, ai_cost_inr: 0.04 };
  });
}

// ---- Count-up number ----
function Count({ to, fmt = (n: number) => String(Math.round(n)), delay = 0 }: { to: number; fmt?: (n: number) => string; delay?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0, t0 = 0;
    const tick = (t: number) => { if (!t0) t0 = t; const p = Math.min(1, (t - t0) / 1400); setV(to * (1 - Math.pow(1 - p, 4))); if (p < 1) raf = requestAnimationFrame(tick); };
    const id = setTimeout(() => (raf = requestAnimationFrame(tick)), delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [to, delay]);
  return <>{fmt(v)}</>;
}

// ---- Ring (like the reference's grey squares with thin coloured rings) ----
function Ring({ pct, color, spin }: { pct?: number; color: string; spin?: boolean }) {
  const C = 2 * Math.PI * 26;
  return (
    <svg viewBox="0 0 64 64" className={"ring" + (spin ? " spin" : "")} aria-hidden>
      <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeOpacity={pct == null ? 1 : 0.18} strokeWidth="1.2" />
      {pct != null && <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, pct)))} transform="rotate(-90 32 32)" className="ring-arc" />}
    </svg>
  );
}

// ---- Reveal on scroll ----
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = ref.current?.querySelectorAll(".rv") || [];
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

const Column = () => (
  <svg viewBox="0 0 60 200" className="column" aria-hidden>
    <path d="M4 14 Q10 2 20 10 Q30 18 30 8 Q30 18 40 10 Q50 2 56 14" fill="none" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="11" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    <circle cx="49" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    <rect x="8" y="18" width="44" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
    {[14, 21, 28, 35, 42, 49].map((x) => <line key={x} x1={x - 2} y1="26" x2={x - 2} y2="184" stroke="currentColor" strokeWidth="1" />)}
    <rect x="10" y="23" width="40" height="164" fill="none" stroke="currentColor" strokeWidth="1" />
    <rect x="6" y="187" width="48" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
    <rect x="2" y="192" width="56" height="6" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const GREEK = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ"];

export default function Dashboard({ real, now }: { real: Call[]; now: number }) {
  const [showSample, setShowSample] = useState(true);
  const root = useReveal();
  const calls = useMemo(() => {
    const all = showSample ? [...real, ...sampleRows(now)] : real;
    return all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [real, now, showSample]);

  const n = calls.length;
  const yes = calls.filter((c) => c.qualified === "YES").length;
  const no = calls.filter((c) => c.qualified === "NO").length;
  const unsure = calls.filter((c) => c.qualified === "UNSURE").length;
  const after = calls.filter((c) => { const h = istHour(c.created_at); return h < 10 || h >= 19; }).length;
  const total = calls.reduce((s, c) => s + Number(c.vaani_cost_inr || 0) + Number(c.ai_cost_inr || 0), 0);
  const avgAns = n ? calls.reduce((s, c) => s + Number(c.answered_in_sec || 0), 0) / n : 0;
  const byHour = Array.from({ length: 24 }, (_, h) => calls.filter((c) => istHour(c.created_at) === h).length);
  const maxH = Math.max(1, ...byHour);

  const tiles: { k: string; v: number; fmt?: (x: number) => string; sub?: string; pct?: number; color: string; spin?: boolean }[] = [
    { k: "Calls · 30 days", v: n, color: "#111", spin: true },
    { k: "Answered < 5 min", v: n ? 100 : 0, fmt: (x) => Math.round(x) + "%", pct: n ? 1 : 0, color: "#6f8a2e" },
    { k: "Avg answer time", v: avgAns, fmt: (x) => x.toFixed(0) + "s", color: "#e2552b", spin: true },
    { k: "After-hours calls", v: after, sub: `${n ? Math.round((after / n) * 100) : 0}% of all calls`, pct: n ? after / n : 0, color: "#3d5bd9" },
    { k: "Qualified · YES", v: yes, sub: `${n ? Math.round((yes / n) * 100) : 0}% of calls`, pct: n ? yes / n : 0, color: "#6f8a2e" },
    { k: "Needs review · UNSURE", v: unsure, pct: n ? unsure / n : 0, color: "#c8941a" },
    { k: "Tool cost · Vaani + AI", v: total, fmt: inr, color: "#d0102b", spin: true },
    { k: "Cost / qualified lead", v: yes ? total / yes : 0, fmt: (x) => (yes ? inr(x) : "—"), color: "#111" },
  ];
  const ticker = calls.slice(0, 12).map((c) => `${c.name || "Caller"} · ${c.location || "—"} · ${c.qualified || "…"}`);

  return (
    <div ref={root} className="ag">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* corner wordmarks + rule + blobs */}
      <div className="wm wm-l" aria-hidden>aangan</div>
      <div className="wm wm-r" aria-hidden>studio</div>
      <div className="vrule" aria-hidden />

      <header className="top">
        <span className="sq" />
        <span className="brand">Aangan Studio <i>/</i> Enquiry Desk</span>
        <div className="top-r">
          <button className={"pill ghost" + (showSample ? " on" : "")} onClick={() => setShowSample((s) => !s)}>
            Sample data {showSample ? "on" : "off"}
          </button>
          <span className="pill"><b className="dot" /> Live</span>
        </div>
      </header>

      <div className="meander" aria-hidden />

      <section className="hero">
        <div className="hero-l">
          <div className="meta rv">Pune · Homes & small offices<br />Riya answers 24×7</div>
          <Column />
          <div className="meta bottom rv">Voice agent<br />& designer handoff</div>
        </div>
        <div className="hero-r">
          <div className="blobs" aria-hidden><span /><span /><span /><span /></div>
          <h1 className="big">
            <span className="w" style={{ ["--d" as any]: "0ms" }}>every</span>
            <span className="w ind" style={{ ["--d" as any]: "120ms" }}>call,</span>
            <span className="w" style={{ ["--d" as any]: "240ms" }}>answered.</span>
          </h1>
          <p className="lede rv">Every phone enquiry is picked up by Riya, scored against Nikhil&apos;s five criteria, and handed to a designer on Telegram with full context. No price is ever quoted on the phone.</p>
        </div>
      </section>

      <div className="ticker" aria-hidden>
        <div className="track">{[...ticker, ...ticker].map((t, i) => <span key={i}>{t}<em>✦</em></span>)}</div>
      </div>

      <section className="sec">
        <div className="sec-h rv"><span className="gk">{GREEK[0]}</span><h2>The numbers</h2><span className="note">{showSample ? "incl. sample data" : "live data only"}</span></div>
        <div className="tiles">
          {tiles.map((t, i) => (
            <div key={t.k} className="tile rv" style={{ ["--d" as any]: i * 70 + "ms" }}>
              <Ring pct={t.pct} color={t.color} spin={t.spin} />
              <div className="tk">{t.k}</div>
              <div className="tv"><Count to={t.v} fmt={t.fmt} delay={200 + i * 80} /></div>
              {t.sub && <div className="ts">{t.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="sec two">
        <div className="rv">
          <div className="sec-h"><span className="gk">{GREEK[1]}</span><h2>When people call</h2></div>
          <div className="hours">
            {byHour.map((v, h) => (
              <div key={h} className={"hb" + (h < 10 || h >= 19 ? " off" : "")} title={`${h}:00 — ${v} call${v === 1 ? "" : "s"}`}>
                <i style={{ height: (v / maxH) * 100 + "%", ["--d" as any]: h * 30 + "ms" }} />
              </div>
            ))}
          </div>
          <div className="hx"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
          <div className="legend"><span><b className="sw dark" />Studio hours 10–19</span><span><b className="sw off" />After hours, missed before Riya</span></div>
        </div>
        <div className="rv">
          <div className="sec-h"><span className="gk">{GREEK[2]}</span><h2>Lead mix</h2></div>
          <div className="mix">
            {[["YES", yes, "#6f8a2e"], ["UNSURE", unsure, "#c8941a"], ["NO", no, "#d0102b"]].map(([k, v, c]) => (
              <i key={k as string} style={{ flexGrow: Number(v) || 0.0001, background: c as string }} title={`${k}: ${v}`} />
            ))}
          </div>
          <ul className="mixl">
            <li><b style={{ background: "#6f8a2e" }} />Qualified → designer <span>{yes}</span></li>
            <li><b style={{ background: "#c8941a" }} />Unsure → human review <span>{unsure}</span></li>
            <li><b style={{ background: "#d0102b" }} />Not a fit → logged only <span>{no}</span></li>
          </ul>
        </div>
      </section>

      <section className="sec">
        <div className="sec-h rv"><span className="gk">{GREEK[3]}</span><h2>Test Riya on a real phone</h2></div>
        <div className="rv"><TriggerCall /></div>
      </section>

      <section className="sec">
        <div className="sec-h rv"><span className="gk">{GREEK[4]}</span><h2>Ledger</h2><span className="note">{n} calls</span></div>
        <div className="ledger rv">
          <table>
            <thead><tr>{["When", "Name", "Property", "Location", "Budget", "Lead", "Route", "Telegram", "Cost"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {calls.map((c, i) => (
                <tr key={c.id} style={{ ["--d" as any]: Math.min(i, 20) * 40 + "ms" }}>
                  <td>{new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{c.name || "—"}{c.sample && <span className="tag">sample</span>}</td>
                  <td>{c.property_type || "—"}</td>
                  <td>{c.location || "—"}</td>
                  <td>{c.budget || "—"}</td>
                  <td><span className={"lead " + String(c.qualified || "").toLowerCase()}>{c.qualified || "…"}</span></td>
                  <td>{c.route_to || ""}</td>
                  <td>{c.telegram_sent ? "✓" : ""}</td>
                  <td>{inr(Number(c.vaani_cost_inr || 0) + Number(c.ai_cost_inr || 0))}</td>
                </tr>
              ))}
              {!n && <tr><td colSpan={9} className="empty">No calls yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="meander" aria-hidden />
      <footer className="foot">
        <span>Built with Vaani · Gemini Flash · Supabase · Telegram · HubSpot · Cal.com</span>
        <span>Ζ — ΑΥΛΗ · the courtyard</span>
      </footer>
    </div>
  );
}

const MEANDER = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='14' viewBox='0 0 28 14'><path d='M0 13 H12 V1 H2 V9 H8 V5 H5 M14 13 H26 V1 H16 V9 H22 V5 H19' fill='none' stroke='black' stroke-width='1.1'/><path d='M12 13 H14 M26 13 H28' stroke='black' stroke-width='1.1'/></svg>\")";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&family=Cormorant+Garamond:wght@500;600&display=swap');
body{background:#fff!important;color:#000!important;font-family:'Inter Tight',Arial,sans-serif!important;-webkit-font-smoothing:antialiased}
.ag{position:relative;max-width:1280px;margin:0 auto;padding:0 24px 40px;overflow:hidden}
.ag *{box-sizing:border-box}
.wm{position:fixed;bottom:-2vw;font-weight:800;font-size:clamp(64px,13vw,190px);letter-spacing:-.06em;color:#e9e9e9;z-index:0;pointer-events:none;line-height:1;animation:wm 1.4s cubic-bezier(.2,.8,.2,1) both}
.wm-l{left:16px}.wm-r{right:16px;animation-delay:.15s}
@keyframes wm{from{transform:translateY(60%);opacity:0}to{transform:none;opacity:1}}
.vrule{position:absolute;top:0;bottom:0;left:calc(24px + (100% - 48px)*.37);width:1px;background:#bdbdbd;transform-origin:top;animation:grow 1.2s cubic-bezier(.2,.8,.2,1) both;z-index:0}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.ag>*:not(.wm):not(.vrule){position:relative;z-index:1}
.top{display:flex;align-items:center;gap:14px;padding:18px 0 14px}
.sq{width:14px;height:14px;background:#efefef;animation:sq 6s linear infinite}
@keyframes sq{50%{transform:rotate(180deg);background:#000}}
.brand{font-weight:700;font-size:14px}.brand i{font-style:normal;color:#aaa;margin:0 4px}
.top-r{margin-left:auto;display:flex;gap:8px}
.pill{display:inline-flex;align-items:center;gap:7px;background:#000;color:#fff;border-radius:999px;padding:6px 13px;font:700 13px 'Inter Tight',sans-serif;border:1px solid #000;cursor:default}
.pill.ghost{background:#fff;color:#000;cursor:pointer;transition:background .25s,color .25s}
.pill.ghost.on,.pill.ghost:hover{background:#000;color:#fff}
.dot{width:7px;height:7px;border-radius:50%;background:#7bd34f;box-shadow:0 0 0 0 rgba(123,211,79,.7);animation:pulse 1.8s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(123,211,79,0)}100%{box-shadow:0 0 0 0 rgba(123,211,79,0)}}
.meander{height:14px;background-image:${MEANDER};background-repeat:repeat-x;opacity:.85;animation:mea 18s linear infinite}
@keyframes mea{to{background-position:280px 0}}
.hero{display:grid;grid-template-columns:37% 63%;min-height:min(78vh,640px);border-bottom:1px solid #000}
.hero-l{position:relative;padding:28px 22px 28px 0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;text-align:right}
.meta{font-weight:700;font-size:14px;line-height:1.25}
.column{width:46px;color:#000;opacity:.9;animation:rise 1.6s .3s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
.hero-r{position:relative;padding:28px 0 36px 22px;display:flex;flex-direction:column;justify-content:flex-end}
.big{font-weight:800;font-size:clamp(56px,10.5vw,150px);line-height:.86;letter-spacing:-.065em;margin:0 0 26px;display:flex;flex-direction:column}
.big .w{display:block;animation:up 1s var(--d) cubic-bezier(.2,.8,.2,1) both}
.big .ind{padding-left:1.1em}
@keyframes up{from{transform:translateY(40%);opacity:0;filter:blur(8px)}to{transform:none;opacity:1;filter:none}}
.lede{max-width:430px;font-weight:700;font-size:14px;line-height:1.3;margin:0}
.blobs{position:absolute;top:24px;left:22px;right:0;height:240px;filter:blur(9px) contrast(1.2);pointer-events:none}
.blobs span{position:absolute;background:#000;border-radius:50%}
.blobs span:nth-child(1){width:150px;height:46px;left:60px;top:20px;animation:b1 9s ease-in-out infinite}
.blobs span:nth-child(2){width:30px;height:30px;left:0;top:30px;animation:b2 7s ease-in-out infinite}
.blobs span:nth-child(3){width:120px;height:34px;left:0;top:100px;animation:b3 11s ease-in-out infinite}
.blobs span:nth-child(4){width:80px;height:34px;left:150px;top:180px;animation:b1 8s -3s ease-in-out infinite reverse}
@keyframes b1{50%{transform:translate(70px,18px) scale(1.25,.8);border-radius:40% 60% 50% 50%}}
@keyframes b2{50%{transform:translate(40px,60px) scale(1.6)}}
@keyframes b3{50%{transform:translate(120px,-20px) scale(.7,1.3)}}
.ticker{overflow:hidden;border-bottom:1px solid #000;padding:12px 0;white-space:nowrap}
.track{display:inline-flex;animation:tick 40s linear infinite}
.track span{font-weight:700;font-size:15px;padding-right:22px}
.track em{font-style:normal;margin-left:22px;color:#e2552b}
@keyframes tick{to{transform:translateX(-50%)}}
.sec{padding:56px 0 8px}
.sec.two{display:grid;grid-template-columns:1fr 1fr;gap:48px}
.sec-h{display:flex;align-items:baseline;gap:14px;margin-bottom:22px;border-top:1px solid #000;padding-top:12px}
.sec-h h2{font-weight:800;font-size:clamp(26px,3.4vw,44px);letter-spacing:-.04em;margin:0;line-height:1}
.gk{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(30px,3.6vw,48px);line-height:1;color:#e2552b;transition:transform .6s}
.sec-h:hover .gk{transform:rotate(-12deg) scale(1.1)}
.note{margin-left:auto;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888}
.rv{opacity:0;transform:translateY(28px);transition:opacity .9s var(--d,0ms),transform .9s var(--d,0ms) cubic-bezier(.2,.8,.2,1)}
.rv.in{opacity:1;transform:none}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tile{position:relative;background:#f1f1f1;aspect-ratio:1/1;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;transition:background .35s}
.tile:hover{background:#000;color:#fff}
.tile .ring{position:absolute;top:50%;left:50%;width:46%;transform:translate(-50%,-62%);transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.tile:hover .ring{transform:translate(-50%,-62%) scale(1.15)}
.ring.spin{animation:spin 14s linear infinite}
@keyframes spin{to{transform:translate(-50%,-62%) rotate(360deg)}}
.ring-arc{transition:stroke-dashoffset 1.6s .4s cubic-bezier(.2,.8,.2,1)}
.tile:not(.in) .ring-arc{stroke-dashoffset:163.4}
.tk{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777}
.tile:hover .tk,.tile:hover .ts{color:#bbb}
.tv{font-weight:800;font-size:clamp(28px,3.4vw,46px);letter-spacing:-.05em;line-height:1;margin-top:4px}
.ts{font-size:12px;color:#777;margin-top:4px}
.hours{display:grid;grid-template-columns:repeat(24,1fr);gap:3px;height:190px;align-items:end;border-bottom:1px solid #000}
.hb{height:100%;display:flex;align-items:flex-end}
.hb i{display:block;width:100%;min-height:2px;background:#000;transform-origin:bottom;animation:bar 1s var(--d) cubic-bezier(.2,.8,.2,1) both}
.hb.off i{background:repeating-linear-gradient(-45deg,#e2552b 0 3px,#f6c4b3 3px 6px)}
.hb:hover i{filter:brightness(1.4)}
@keyframes bar{from{transform:scaleY(0)}}
.hx{display:flex;justify-content:space-between;font-size:11px;color:#888;margin-top:6px;font-weight:700}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;margin-top:14px;font-weight:500}
.sw{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px}
.sw.dark{background:#000}.sw.off{background:#e2552b}
.mix{display:flex;height:64px;gap:3px;margin-top:4px}
.mix i{display:block;min-width:2px;transform-origin:left;animation:mixg 1.4s cubic-bezier(.2,.8,.2,1) both;transition:flex-grow .8s cubic-bezier(.2,.8,.2,1)}
@keyframes mixg{from{transform:scaleX(0)}}
.mixl{list-style:none;padding:0;margin:18px 0 0}
.mixl li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #e5e5e5;font-weight:500;font-size:15px}
.mixl li b{width:10px;height:10px;border-radius:50%}
.mixl li span{margin-left:auto;font-weight:800;font-size:22px;letter-spacing:-.04em}
.ledger{overflow-x:auto;border-top:1px solid #000}
.ledger table{width:100%;border-collapse:collapse;font-size:14px}
.ledger th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#888;padding:12px 10px;font-weight:700;border-bottom:1px solid #000;white-space:nowrap}
.ledger td{padding:12px 10px;border-bottom:1px solid #ececec;white-space:nowrap}
.ledger tbody tr{transition:background .2s}
.ledger.in tbody tr{animation:row .6s var(--d) cubic-bezier(.2,.8,.2,1) both}
@keyframes row{from{opacity:0;transform:translateX(-14px)}}
.ledger tbody tr:hover{background:#000;color:#fff}
.tag{margin-left:8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;border:1px solid #ccc;border-radius:999px;padding:1px 6px}
.lead{display:inline-block;font-weight:800;font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid currentColor}
.lead.yes{color:#5f7a22}.lead.no{color:#d0102b}.lead.unsure{color:#b07f10}
tr:hover .lead{color:#fff}
.empty{text-align:center;color:#888;padding:28px}
.foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:12px;font-weight:700;padding:16px 0 120px;color:#555}
.tc-form{background:#f1f1f1;padding:18px;display:flex;flex-direction:column;gap:12px}
.tc-row{display:flex;gap:8px;flex-wrap:wrap}
.tc-in{flex:1 1 160px;min-width:0;padding:13px 14px;border:1px solid #000;border-radius:0;background:#fff;font:500 15px 'Inter Tight',sans-serif;outline:none;transition:box-shadow .2s}
.tc-in:focus{box-shadow:4px 4px 0 #000}
.tc-in.pin{flex:0 1 110px}
.tc-btn{padding:13px 22px;border-radius:999px;border:1px solid #000;background:#000;color:#fff;font:700 15px 'Inter Tight',sans-serif;cursor:pointer;transition:transform .2s,background .2s}
.tc-btn:hover{transform:translateY(-2px);background:#e2552b;border-color:#e2552b}
.tc-btn:disabled{opacity:.6}
.tc-hint{font-size:13px;color:#666}
.tc-msg{font-size:14px;font-weight:500}.tc-msg.ok{color:#5f7a22}.tc-msg.err{color:#d0102b}
@media (max-width:860px){
 .hero{grid-template-columns:1fr}.hero-l{display:none}.hero-r{padding-left:0}
 .vrule{display:none}.tiles{grid-template-columns:repeat(2,1fr)}.sec.two{grid-template-columns:1fr}
 .blobs{left:0}.ag{padding:0 16px 40px}
 .tile .ring{width:34%;top:12px;transform:translate(-50%,0)}.ring.spin{animation:none}.tile:hover .ring{transform:translate(-50%,0)}
 .tk{font-size:10px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
`;
