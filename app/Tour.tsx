"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// Guided tooltip tour of the dashboard. Auto-starts on first visit; "Tour" pill restarts it.
const STEPS: { sel: string; title: string; body: string }[] = [
  { sel: ".hero h1", title: "Every call, answered", body: "Riya, the AI voice agent, picks up every phone enquiry 24×7, including after studio hours, when leads used to be lost." },
  { sel: ".top-r .pill.ghost", title: "Sample data switch", body: "The dashboard includes 16 labelled sample enquiries for the demo. Switch them off to see only real calls." },
  { sel: ".ticker", title: "Live feed", body: "The latest callers scroll past here: who called, from where, and how Riya scored them." },
  { sel: ".tiles", title: "The numbers", body: "Calls, answer time, after-hours share, qualified leads and the full tool cost (Vaani + AI), including cost per qualified lead." },
  { sel: ".hours", title: "When people call", body: "Calls by hour. Orange striped bars are after-hours calls, the ones a human team would have missed." },
  { sel: ".mix", title: "Lead mix", body: "YES goes to a designer on Telegram (and HubSpot). UNSURE goes to human review. NO is logged and never rejected by a bot." },
  { sel: ".tc-form", title: "Test Riya on a real phone", body: "Enter a mobile number and PIN. Riya calls it, and the result lands in the ledger a minute or two after you hang up." },
  { sel: ".ledger", title: "The ledger", body: "Every call with its lead score, route and cost. Rows tagged “sample” are demo data." },
];
const GK = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ"];
const KEY = "aangan-tour-done";

export default function Tour() {
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number; place: "below" | "above" | "float" }>({ left: 16, top: 16, place: "float" });

  const close = useCallback(() => { setI(-1); try { localStorage.setItem(KEY, "1"); } catch {} }, []);

  useEffect(() => {
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch {}
    if (!seen) { const t = setTimeout(() => setI(0), 1600); return () => clearTimeout(t); }
  }, []);

  const place = useCallback(() => {
    if (i < 0) return;
    const el = document.querySelector(STEPS[i].sel) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 10, vw = innerWidth, vh = innerHeight, tw = Math.min(360, vw - 32), th = 240;
    setBox({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
    const left = Math.max(16, Math.min(r.left, vw - tw - 16));
    if (r.bottom + pad + th + 16 < vh) setTip({ left, top: r.bottom + pad + 14, place: "below" });
    else if (r.top - pad - th - 16 > 0) setTip({ left, top: r.top - pad - th - 14, place: "above" });
    else setTip({ left: Math.max(16, vw - tw - 24), top: vh - th - 24, place: "float" });
  }, [i]);

  useLayoutEffect(() => {
    if (i < 0) return;
    const el = document.querySelector(STEPS[i].sel) as HTMLElement | null;
    if (!el) { setI((n) => (n + 1 < STEPS.length ? n + 1 : -1)); return; }
    const r = el.getBoundingClientRect();
    const targetTop = r.height > innerHeight * 0.6 ? scrollY + r.top - 90 : scrollY + r.top - (innerHeight - r.height) / 2 + 60;
    scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    let n = 0; const id = setInterval(() => { place(); if (++n > 16) clearInterval(id); }, 50);
    const on = () => place();
    addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { clearInterval(id); removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, [i, place]);

  useEffect(() => {
    if (i < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => (n + 1 < STEPS.length ? n + 1 : (close(), -1)));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [i, close]);

  const s = i >= 0 ? STEPS[i] : null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {i < 0 && <button className="tr-launch" onClick={() => setI(0)} aria-label="Start dashboard tour"><span>Α</span> Tour</button>}
      {s && box && (
        <div className="tr-root" role="dialog" aria-modal="true" aria-label={`Tour step ${i + 1} of ${STEPS.length}: ${s.title}`}>
          <div className="tr-catch" onClick={close} />
          <div className="tr-spot" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
          <div key={i} className={"tr-tip " + tip.place} style={{ left: tip.left, top: tip.top }}>
            <div className="tr-head"><span className="tr-gk">{GK[i]}</span><span className="tr-count">{String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span></div>
            <div className="tr-title">{s.title}</div>
            <p className="tr-body">{s.body}</p>
            <div className="tr-bar"><i style={{ width: ((i + 1) / STEPS.length) * 100 + "%" }} /></div>
            <div className="tr-actions">
              <button className="tr-skip" onClick={close}>Skip</button>
              <div>
                {i > 0 && <button className="tr-btn ghost" onClick={() => setI(i - 1)}>←</button>}
                <button className="tr-btn" autoFocus onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : close())}>{i + 1 < STEPS.length ? "Next →" : "Finish ✦"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
.tr-launch{position:fixed;right:18px;bottom:18px;z-index:60;display:flex;align-items:center;gap:8px;background:#000;color:#fff;border:0;border-radius:999px;padding:10px 16px;font:700 14px 'Inter Tight',Arial,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.18);transition:transform .25s,background .25s;animation:trIn .6s 2s both}
.tr-launch span{font-family:'Cormorant Garamond',serif;font-size:20px;line-height:1;color:#e2552b}
.tr-launch:hover{transform:translateY(-3px);background:#e2552b}.tr-launch:hover span{color:#fff}
.tr-root{position:fixed;inset:0;z-index:80}
.tr-catch{position:absolute;inset:0}
.tr-spot{position:fixed;border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,.62);outline:1px solid #e2552b;outline-offset:3px;pointer-events:none;
  transition:left .45s cubic-bezier(.2,.8,.2,1),top .45s cubic-bezier(.2,.8,.2,1),width .45s cubic-bezier(.2,.8,.2,1),height .45s cubic-bezier(.2,.8,.2,1)}
.tr-spot::after{content:"";position:absolute;inset:-8px;border:1px dashed rgba(255,255,255,.55);border-radius:10px;animation:trPulse 1.8s ease-in-out infinite}
.tr-tip{position:fixed;box-sizing:border-box;width:min(360px,calc(100vw - 32px));background:#fff;color:#000;padding:18px 18px 14px;border-top:3px solid #000;
  box-shadow:0 18px 50px rgba(0,0,0,.35);font-family:'Inter Tight',Arial,sans-serif;animation:trIn .45s cubic-bezier(.2,.8,.2,1) both;
  transition:left .45s cubic-bezier(.2,.8,.2,1),top .45s cubic-bezier(.2,.8,.2,1)}
.tr-tip::before{content:"";position:absolute;left:28px;width:12px;height:12px;background:#fff;transform:rotate(45deg)}
.tr-tip.below::before{top:-8px;background:#000}.tr-tip.above::before{bottom:-6px}.tr-tip.float::before{display:none}
.tr-head{display:flex;align-items:baseline;justify-content:space-between}
.tr-gk{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:34px;line-height:1;color:#e2552b}
.tr-count{font-size:11px;font-weight:700;letter-spacing:.12em;color:#999}
.tr-title{font-weight:800;font-size:22px;letter-spacing:-.03em;margin:6px 0 6px}
.tr-body{font-size:14px;line-height:1.45;margin:0 0 14px;color:#333}
.tr-bar{height:2px;background:#eee;margin-bottom:12px}.tr-bar i{display:block;height:100%;background:#000;transition:width .45s}
.tr-actions{display:flex;align-items:center;justify-content:space-between}
.tr-actions>div{display:flex;gap:6px}
.tr-skip{background:none;border:0;color:#888;font:600 13px 'Inter Tight',sans-serif;cursor:pointer;padding:6px 0}
.tr-skip:hover{color:#000}
.tr-btn{background:#000;color:#fff;border:1px solid #000;border-radius:999px;padding:8px 16px;font:700 13px 'Inter Tight',sans-serif;cursor:pointer;transition:background .2s}
.tr-btn:hover{background:#e2552b;border-color:#e2552b}
.tr-btn.ghost{background:#fff;color:#000}.tr-btn.ghost:hover{background:#000;color:#fff;border-color:#000}
@keyframes trIn{from{opacity:0;transform:translateY(10px)}}
@keyframes trPulse{50%{inset:-14px;opacity:.3}}
@media (prefers-reduced-motion:reduce){.tr-spot,.tr-tip,.tr-launch{transition:none!important;animation:none!important}.tr-spot::after{animation:none}}
`;
