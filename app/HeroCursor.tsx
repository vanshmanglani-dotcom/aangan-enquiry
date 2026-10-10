"use client";
import { useEffect } from "react";

// Hero cursor interaction: an inverting lens + a Greek-dot grid that follows the cursor (eased).
export default function HeroCursor() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hero");
    if (!hero || matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;
    hero.classList.add("hc-on");
    const grid = document.createElement("div"); grid.className = "hc-grid";
    const lens = document.createElement("div"); lens.className = "hc-lens";
    const ring = document.createElement("div"); ring.className = "hc-ring";
    hero.append(grid, ring, lens);

    let tx = hero.clientWidth * 0.6, ty = hero.clientHeight * 0.5, x = tx, y = ty, rx = tx, ry = ty, raf = 0, inside = false;
    const move = (e: PointerEvent) => { const r = hero.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; };
    const enter = () => { inside = true; hero.classList.add("hc-in"); };
    const leave = () => { inside = false; hero.classList.remove("hc-in"); };
    const loop = () => {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;   // lens: smooth lag
      rx += (tx - rx) * 0.06; ry += (ty - ry) * 0.06; // ring: slower trail
      const sx = Math.min(1.35, 1 + Math.hypot(tx - x, ty - y) / 400);
      const ang = Math.atan2(ty - y, tx - x);
      lens.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${ang}rad) scale(${sx},${2 - sx})`;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      hero.style.setProperty("--hx", x + "px"); hero.style.setProperty("--hy", y + "px");
      raf = requestAnimationFrame(loop);
    };
    hero.addEventListener("pointermove", move); hero.addEventListener("pointerenter", enter); hero.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); hero.removeEventListener("pointermove", move); hero.removeEventListener("pointerenter", enter); hero.removeEventListener("pointerleave", leave); grid.remove(); lens.remove(); ring.remove(); hero.classList.remove("hc-on", "hc-in"); void inside; };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: `
.hero.hc-on{overflow:hidden;cursor:crosshair;background:#fff;isolation:isolate}
.hc-grid{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .5s;
  background-image:radial-gradient(#000 1.1px,transparent 1.3px);background-size:18px 18px;
  -webkit-mask-image:radial-gradient(260px circle at var(--hx) var(--hy),#000 0%,rgba(0,0,0,.35) 45%,transparent 72%);
          mask-image:radial-gradient(260px circle at var(--hx) var(--hy),#000 0%,rgba(0,0,0,.35) 45%,transparent 72%)}
.hero.hc-in .hc-grid{opacity:.22}
.hc-lens{position:absolute;left:0;top:0;width:180px;height:180px;border-radius:50%;background:#fff;mix-blend-mode:difference;
  z-index:6;pointer-events:none;opacity:0;transition:opacity .35s,width .35s,height .35s}
.hero.hc-in .hc-lens{opacity:1}
.hero.hc-in:active .hc-lens{width:240px;height:240px}
.hc-ring{position:absolute;left:0;top:0;width:250px;height:250px;border-radius:50%;border:1px solid #e2552b;z-index:5;pointer-events:none;
  opacity:0;transition:opacity .5s}
.hc-ring::after{content:"";position:absolute;inset:-9px;border-radius:50%;border:1px dashed rgba(0,0,0,.35);animation:hcspin 12s linear infinite}
.hero.hc-in .hc-ring{opacity:1}
@keyframes hcspin{to{transform:rotate(360deg)}}
` }} />;
}
