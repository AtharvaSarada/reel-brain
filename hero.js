// Hero twist: "Synapse ignition".
// Every node of the real knowledge graph is a neuron. They start scattered, gather into the graph's own shape,
// then signals fire from the router out along the real links. The cursor tugs nearby neurons and wires itself in.
// The wordmark and the Devanagari title decode out of shuffling glyphs over the reveal library's slow light rays.
(() => {
  const RB = window.RB || {};
  const REDUCED = RB.REDUCED;
  const canvas = document.getElementById("synapse");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1, nodes = [], links = [], pulses = [], t0 = 0, mouse = { x: -1e4, y: -1e4, on: false }, raf = 0, dark = true;

  // ---------- text decode ----------
  const LAT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+<>/\\=";
  const DEV = "कखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह";
  function decode(el, finalText, pool, ms) {
    if (!el) return;
    const seg = typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(finalText)].map((s) => s.segment) : [...finalText];
    if (REDUCED) { el.textContent = finalText; return; }
    const start = performance.now(), n = seg.length;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const done = Math.floor(p * n * 1.15);
      el.textContent = seg.map((ch, i) => (ch === " " ? " " : i < done ? ch : pool[(Math.random() * pool.length) | 0])).join("");
      if (p < 1) requestAnimationFrame(tick); else el.textContent = finalText;
    };
    requestAnimationFrame(tick);
    setTimeout(() => { el.textContent = finalText; }, ms + 500);
  }
  decode(document.getElementById("wordmark"), "Reel Brain", LAT, 900);
  setTimeout(() => decode(document.getElementById("deva"), "ज्ञान भंडार", DEV, 1100), 450);

  // ---------- canvas ----------
  const hueOf = (g) => (RB.PACK_HUE && RB.PACK_HUE[g]) ?? 26;
  function size() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function layout(graph) {
    // settle the real graph once, off-screen, then fit it into the right side of the hero
    const ns = graph.nodes.map((n) => ({ id: n.id, kind: n.kind, group: n.group }));
    const ls = graph.links.map((l) => ({ source: l.source, target: l.target }));
    if (window.d3) {
      const sim = d3.forceSimulation(ns)
        .force("link", d3.forceLink(ls).id((d) => d.id).distance((l) => (l.source.kind === "router" ? 60 : l.target.kind === "entry" || l.target.kind === "technique" ? 18 : 34)).strength(0.9))
        .force("charge", d3.forceManyBody().strength((d) => (d.kind === "router" ? -260 : d.kind === "pack" ? -120 : -22)))
        .force("center", d3.forceCenter(0, 0)).stop();
      for (let i = 0; i < 260; i++) sim.tick();
    } else ns.forEach((n, i) => { const a = i * 2.399, r = Math.sqrt(i) * 14; n.x = Math.cos(a) * r; n.y = Math.sin(a) * r; });
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const narrow = W < 760;
    const boxW = narrow ? W * 0.95 : W * 0.56, boxH = H * 0.92, cx = narrow ? W * 0.5 : W * 0.7, cy = H * 0.52;
    const s = Math.min(boxW / (maxX - minX || 1), boxH / (maxY - minY || 1));
    nodes = ns.map((n) => ({
      ...n, tx: cx + (n.x - (minX + maxX) / 2) * s, ty: cy + (n.y - (minY + maxY) / 2) * s,
      sx: Math.random() * W, sy: Math.random() * H, x: 0, y: 0, vx: 0, vy: 0,
      r: n.kind === "router" ? 5 : n.kind === "pack" ? 3.4 : n.kind === "shelf" || n.kind === "app" ? 2.2 : 1.4,
      hue: hueOf(n.kind === "router" ? "router" : n.group), phase: Math.random() * 6.28,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    links = ls.map((l) => ({ a: byId.get(l.source.id ?? l.source), b: byId.get(l.target.id ?? l.target) })).filter((l) => l.a && l.b);
    nodes.forEach((n) => { n.x = n.sx; n.y = n.sy; });
  }
  // a signal travels one path from the router down to a leaf
  function firePulse() {
    const router = nodes.find((n) => n.kind === "router"); if (!router) return;
    let cur = router; const path = [];
    for (let d = 0; d < 4; d++) {
      const out = links.filter((l) => l.a === cur); if (!out.length) break;
      const l = out[(Math.random() * out.length) | 0]; path.push(l); cur = l.b;
    }
    if (path.length) pulses.push({ path, seg: 0, p: 0, hue: path[path.length - 1].b.hue });
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000, gather = Math.min(1, Math.max(0, (t - 0.15) / 1.6)), e = ease(gather);
    ctx.clearRect(0, 0, W, H);
    const lineA = dark ? 0.16 : 0.22;
    // links fade in once the neurons have gathered
    const la = Math.max(0, Math.min(1, (t - 1.1) / 0.8));
    nodes.forEach((n) => {
      let hx = n.sx + (n.tx - n.sx) * e, hy = n.sy + (n.ty - n.sy) * e;
      hx += Math.sin(t * 0.6 + n.phase) * 2.2 * e; hy += Math.cos(t * 0.5 + n.phase) * 2.2 * e; // breathing
      if (mouse.on) { const dx = mouse.x - hx, dy = mouse.y - hy, d = Math.hypot(dx, dy); if (d < 140) { const f = (1 - d / 140) * 14; hx += (dx / (d || 1)) * f; hy += (dy / (d || 1)) * f; } }
      n.x += (hx - n.x) * 0.18; n.y += (hy - n.y) * 0.18;
    });
    if (la > 0) {
      ctx.lineWidth = 1;
      links.forEach((l) => {
        ctx.strokeStyle = `oklch(${dark ? 0.75 : 0.45} 0.08 ${l.b.hue} / ${(lineA * la).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
      });
    }
    // the cursor wires itself to the nearest neurons
    if (mouse.on && la > 0) {
      nodes.forEach((n) => { const d = Math.hypot(mouse.x - n.x, mouse.y - n.y); if (d < 110) {
        ctx.strokeStyle = `oklch(0.8 0.12 ${n.hue} / ${(0.5 * (1 - d / 110)).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(n.x, n.y); ctx.stroke(); } });
    }
    // pulses
    if (la >= 1 && Math.random() < 0.06 && pulses.length < 14) firePulse();
    pulses = pulses.filter((p) => {
      p.p += 0.045; if (p.p >= 1) { p.p = 0; p.seg++; if (p.seg >= p.path.length) { p.path[p.path.length - 1].b.flash = 1; return false; } }
      const l = p.path[p.seg], x = l.a.x + (l.b.x - l.a.x) * p.p, y = l.a.y + (l.b.y - l.a.y) * p.p;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, `oklch(0.9 0.15 ${p.hue} / 0.95)`); g.addColorStop(1, `oklch(0.9 0.15 ${p.hue} / 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.283); ctx.fill();
      return true;
    });
    // neurons
    nodes.forEach((n) => {
      n.flash = (n.flash || 0) * 0.93;
      const glow = n.r * (3.2 + n.flash * 5);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow);
      g.addColorStop(0, `oklch(${dark ? 0.82 : 0.6} 0.14 ${n.hue} / ${(0.55 + n.flash * 0.4).toFixed(3)})`);
      g.addColorStop(1, `oklch(${dark ? 0.82 : 0.6} 0.14 ${n.hue} / 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, glow, 0, 6.283); ctx.fill();
      ctx.fillStyle = `oklch(${dark ? 0.92 : 0.5} 0.12 ${n.hue})`; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
    });
    raf = requestAnimationFrame(frame);
  }

  function start(graph) {
    size(); layout(graph);
    dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    if (REDUCED) { nodes.forEach((n) => { n.sx = n.tx; n.sy = n.ty; }); }
    cancelAnimationFrame(raf); t0 = 0; raf = requestAnimationFrame(frame);
    // a background tab or a thumbnail never fires rAF: draw the settled constellation once
    setTimeout(() => { if (!t0) { nodes.forEach((n) => { n.sx = n.x = n.tx; n.sy = n.y = n.ty; }); t0 = performance.now() - 3000; frame(performance.now()); cancelAnimationFrame(raf); } }, 700);
  }

  addEventListener("rb-data", (e) => { if (e.detail?.graph) start(e.detail.graph); });
  addEventListener("rb-theme", () => { dark = getComputedStyle(document.documentElement).colorScheme.includes("dark"); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => RB.state?.data?.graph && start(RB.state.data.graph), 200); });
  const hero = document.querySelector(".hero");
  hero.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: true }; });
  hero.addEventListener("pointerleave", () => { mouse.on = false; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else if (nodes.length) raf = requestAnimationFrame(frame); });
  if (RB.state?.data?.graph) start(RB.state.data.graph);
})();
