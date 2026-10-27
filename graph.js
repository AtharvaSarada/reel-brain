// Graph view: the brain's real retrieval structure. Router → packs → shelves / app groups → every learning.
// d3-force layout on a canvas: zoom and pan, signals flowing along the edges, hover lights a node's neighbourhood,
// click opens a detail card, the legend focuses one pack, and the search box lights the matching nodes.
(() => {
  const RB = window.RB || {};
  const KIND_LABEL = { router: "Router", pack: "Pack", shelf: "Shelf", app: "App group", entry: "Learning", technique: "Technique",
    hub: "Story bank", status: "Story stage", story: "Story", character: "Character", tool: "Tool", creator: "Creator" };
  const EXTRA_HUE = { characters: 62, tools: 200, creators: 280, status_new: 250, status_researching: 300, status_researched: 190, status_scripted: 335, status_posted: 150 };
  const LAYERS = [["story", "Stories"], ["character", "Characters"], ["tool", "Tools"], ["creator", "Creators"]];
  const layerOn = { story: true, character: true, tool: true, creator: false };
  const LAYER_KIND = { character: "character", tool: "tool", creator: "creator" };
  const R = { router: 13, pack: 9, shelf: 5.5, app: 5.5, entry: 3.2, technique: 3.6, hub: 8, status: 6.5, story: 6, character: 5, tool: 5, creator: 4 };
  let shell, canvas, ctx, sim, zoomT = d3.zoomIdentity, W = 0, H = 0, DPR = 1, raf = 0, nodes = [], links = [], adj = new Map();
  let hover = null, selected = null, focusPack = null, query = "", matchSet = null, dark = true, zoomer;

  const hue = (n) => EXTRA_HUE[n.group] ?? (RB.PACK_HUE?.[n.kind === "router" ? "router" : n.group]) ?? 26;
  const hidden = (n) => LAYER_KIND[n.kind] && !layerOn[n.kind] || (n.kind === "story" || n.kind === "status" || n.kind === "hub") && !layerOn.story;
  const linkHidden = (l) => (l.type && l.type !== "structure" && !layerOn[l.type]) || hidden(l.source) || hidden(l.target);
  const col = (n, a = 1, l) => `oklch(${l ?? (dark ? 0.8 : 0.55)} 0.14 ${hue(n)} / ${a})`;
  const esc = RB.esc || ((s) => s);

  function mount(container, data) {
    if (!window.d3 || !data?.graph) { container.innerHTML = `<div class="empty-state"><strong>The graph couldn't load</strong>Check your connection and refresh.</div>`; return; }
    dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    const packs = data.graph.nodes.filter((n) => n.kind === "pack");
    container.innerHTML = `<div class="graph-shell enter">
        <div class="graph-head">
          <div><h2 class="graph-title">The knowledge graph</h2>
          <p>How Claude retrieves what it learned: the router picks a pack for the task, the pack lists its shelves and techniques, and only those open. ${data.graph.nodes.length} nodes, ${data.graph.links.length} links.</p></div>
          <div class="graph-tools"><button class="g-btn" type="button" data-g="fit">Fit</button><button class="g-btn" type="button" data-g="reset">Reset</button></div>
        </div>
        <div class="legend layers" aria-label="Relation layers">${LAYERS.map(([k, l]) => `<button type="button" class="legend-chip layer" data-layer="${k}" aria-pressed="${layerOn[k]}" style="--hue:${{story: 52, character: 62, tool: 200, creator: 280}[k]}"><i></i>${l}</button>`).join("")}</div>
        <div class="legend">${packs.map((p) => `<button type="button" class="legend-chip" data-pack="${esc(p.group)}" style="--hue:${RB.PACK_HUE?.[p.group] ?? 26}"><i></i>${esc(p.label)}</button>`).join("")}</div>
        <div class="graph-stage"><canvas class="graph-canvas" aria-label="Knowledge graph. Use the list view for a text version." role="img"></canvas>
          <div class="graph-tip" hidden></div><aside class="graph-card" hidden></aside>
          <div class="graph-hint">Drag to pan, scroll or pinch to zoom, click a node to open it.</div></div>
      </div>`;
    shell = container.querySelector(".graph-shell");
    canvas = shell.querySelector("canvas"); ctx = canvas.getContext("2d");

    nodes = data.graph.nodes.map((n) => ({ ...n }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    links = data.graph.links.map((l) => ({ source: byId.get(l.source), target: byId.get(l.target), phase: Math.random() })).filter((l) => l.source && l.target);
    adj = new Map(nodes.map((n) => [n.id, new Set()]));
    links.forEach((l) => { adj.get(l.source.id).add(l.target); adj.get(l.target.id).add(l.source); });
    nodes.forEach((n) => { n.deg = adj.get(n.id).size; });

    size();
    sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).distance((l) => (l.type && l.type !== "structure" ? 120 : l.source.kind === "router" ? 190 : l.target.kind === "entry" || l.target.kind === "technique" || l.target.kind === "story" ? 40 : 80)).strength((l) => (l.type && l.type !== "structure" ? 0.06 : 0.8)))
      .force("charge", d3.forceManyBody().strength((d) => (d.kind === "router" ? -1200 : d.kind === "pack" ? -760 : d.kind === "hub" ? -500 : d.kind === "shelf" || d.kind === "app" || d.kind === "status" ? -150 : d.kind === "character" || d.kind === "tool" ? -110 : -40)))
      .force("collide", d3.forceCollide((d) => R[d.kind] + 3))
      .force("x", d3.forceX(0).strength(0.03)).force("y", d3.forceY(0).strength(0.03))
      .alphaDecay(0.03);
    if (RB.REDUCED) { sim.stop(); for (let i = 0; i < 300; i++) sim.tick(); }
    setTimeout(fit, RB.REDUCED ? 0 : 1400);
    sim.on("end", () => { if (!selected && !focusPack) fit(); });

    zoomer = d3.zoom().scaleExtent([0.25, 5]).on("zoom", (e) => { zoomT = e.transform; });
    d3.select(canvas).call(zoomer).on("dblclick.zoom", null);
    d3.select(canvas).call(zoomer.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(0.8));
    d3.select(canvas).call(d3.drag().container(canvas).subject(pick)
      .on("start", (e) => { if (!e.active) sim.alphaTarget(0.25).restart(); e.subject.fx = e.subject.x; e.subject.fy = e.subject.y; })
      .on("drag", (e) => { const [x, y] = zoomT.invert(d3.pointer(e, canvas)); e.subject.fx = x; e.subject.fy = y; })
      .on("end", (e) => { if (!e.active) sim.alphaTarget(0); e.subject.fx = null; e.subject.fy = null; }));

    canvas.addEventListener("pointermove", (e) => { hover = pick(e); canvas.style.cursor = hover ? "pointer" : "grab"; tip(e); });
    canvas.addEventListener("pointerleave", () => { hover = null; tip(); });
    canvas.addEventListener("click", (e) => { const n = pick(e); select(n); });
    shell.addEventListener("click", (e) => {
      const b = e.target.closest("[data-g],[data-pack],[data-node],[data-close],[data-layer]"); if (!b) return;
      if (b.dataset.g === "fit") fit();
      if (b.dataset.g === "reset") { focusPack = null; select(null); legendState(); fit(); }
      if (b.dataset.pack) { focusPack = focusPack === b.dataset.pack ? null : b.dataset.pack; legendState(); fit(focusPack); }
      if (b.dataset.node) select(nodes.find((n) => n.id === b.dataset.node));
      if (b.dataset.close != null) select(null);
      if (b.dataset.layer) { layerOn[b.dataset.layer] = !layerOn[b.dataset.layer]; b.setAttribute("aria-pressed", layerOn[b.dataset.layer]); }
    });
    addEventListener("resize", onResize);
    addEventListener("rb-theme", onTheme);
    if (query) search(query);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }

  function unmount() {
    if (!shell) return;
    cancelAnimationFrame(raf); sim?.stop(); removeEventListener("resize", onResize); removeEventListener("rb-theme", onTheme);
    shell = null; selected = null; hover = null; focusPack = null;
  }
  const onResize = () => { if (shell) size(); };
  const onTheme = () => { dark = getComputedStyle(document.documentElement).colorScheme.includes("dark"); };

  function size() {
    const r = canvas.getBoundingClientRect(); DPR = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
  }
  function pick(e) {
    const [mx, my] = zoomT.invert(d3.pointer(e, canvas));
    let best = null, bd = Infinity;
    for (const n of nodes) { if (hidden(n)) continue; const d = Math.hypot(n.x - mx, n.y - my), r = R[n.kind] + 6 / zoomT.k; if (d < r && d < bd) { bd = d; best = n; } }
    return best;
  }
  function fit(pack) {
    if (!nodes.length || !canvas) return;
    const set = pack ? nodes.filter((n) => n.group === pack || n.kind === "router" || [...adj.get(n.id)].some((m) => m.group === pack && m.kind === "pack")) : nodes;
    // frame what is shown, and let a few far-flung leaves sit off-screen instead of shrinking the whole graph
    const shown = set.filter((n) => !hidden(n)), q = shown.length > 40 ? 0.015 : 0;
    const xs = shown.map((n) => n.x).sort(d3.ascending), ys = shown.map((n) => n.y).sort(d3.ascending);
    if (!xs.length) return;
    const x0 = d3.quantileSorted(xs, q), x1 = d3.quantileSorted(xs, 1 - q), y0 = d3.quantileSorted(ys, q), y1 = d3.quantileSorted(ys, 1 - q);
    const k = Math.min(4, 0.88 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    d3.select(canvas).transition().duration(RB.REDUCED ? 0 : 900).ease(d3.easeCubicOut).call(zoomer.transform, t);
  }
  function legendState() { shell.querySelectorAll(".legend-chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.pack === focusPack)); }

  function tip(e) {
    const el = shell?.querySelector(".graph-tip"); if (!el) return;
    if (!hover || !e) { el.hidden = true; return; }
    const r = canvas.getBoundingClientRect();
    el.innerHTML = `<b>${esc(hover.label)}</b><span>${KIND_LABEL[hover.kind]}${hover.deg > 1 ? ` · ${hover.deg} links` : ""}</span>`;
    el.style.left = `${e.clientX - r.left + 14}px`; el.style.top = `${e.clientY - r.top + 14}px`; el.hidden = false;
  }

  function select(n) {
    selected = n || null;
    const card = shell?.querySelector(".graph-card"); if (!card) return;
    if (!n) { card.hidden = true; return; }
    const nb = [...adj.get(n.id)];
    const parents = nb.filter((m) => rank(m) < rank(n)), kids = nb.filter((m) => rank(m) > rank(n));
    const li = (m) => `<li><button type="button" data-node="${esc(m.id)}" style="--hue:${hue(m)}"><i></i>${esc(m.label)}</button></li>`;
    card.innerHTML = `<button class="g-close" type="button" data-close aria-label="Close">×</button>
      <span class="g-kind" style="--hue:${hue(n)}">${KIND_LABEL[n.kind]}</span>
      <h3>${esc(n.label)}</h3>
      ${n.trigger ? `<p><b>Opens when</b> ${esc(n.trigger)}</p>` : ""}
      ${n.category ? `<p><b>Category</b> ${esc(n.category)}${n.status ? ` · ${esc(n.status)}` : ""}</p>` : ""}
      ${n.creator || n.date ? `<p>${esc(n.creator || "")} ${n.date ? RB.fmtDate?.(n.date) || n.date : ""}</p>` : ""}
      ${n.link ? `<a class="open-link" href="${esc(n.link)}" target="_blank" rel="noopener">Open the source on Instagram ↗</a>` : ""}
      ${n.kind === "story" ? `<p><b>Stage</b> ${esc(n.status || "new")}${n.typ ? ` · ${esc(n.typ)}` : ""}${n.posted ? ` · posted ${esc(n.posted)}` : ""}</p><p>Ready for research: its page in the Story bank holds what the reels show, what is missing and a research brief.</p>` : ""}
      ${parents.length ? `<h4>Reached from</h4><ul>${parents.map(li).join("")}</ul>` : ""}
      ${kids.length ? `<h4>${n.kind === "router" ? "Packs" : "Holds"} · ${kids.length}</h4><ul>${kids.slice(0, 40).map(li).join("")}</ul>` : ""}`;
    card.hidden = false; card.classList.remove("in"); void card.offsetWidth; card.classList.add("in");
  }
  const rank = (n) => ({ router: 0, pack: 1, hub: 2, shelf: 2, app: 2, status: 3, entry: 3, technique: 3, story: 4, character: 5, tool: 5, creator: 5 })[n.kind] ?? 4;

  function search(q) {
    query = (q || "").toLowerCase().trim();
    matchSet = query ? new Set(nodes.filter((n) => query.split(/\s+/).every((w) => (n.label + " " + (n.trigger || "") + " " + (n.creator || "")).toLowerCase().includes(w)))) : null;
  }

  function draw(now) {
    if (!shell) return;
    const t = now / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(zoomT.x, zoomT.y); ctx.scale(zoomT.k, zoomT.k);
    const lit = hover || selected; const near = lit ? adj.get(lit.id) : null;
    const inFocus = (n) => !focusPack || n.group === focusPack || n.kind === "router";
    const dim = (n) => (matchSet ? !matchSet.has(n) : false) || !inFocus(n) || (lit ? n !== lit && !near.has(n) : false);

    // edges
    for (const l of links) {
      if (linkHidden(l)) continue;
      const rel = l.type && l.type !== "structure";
      ctx.setLineDash(rel ? [3 / zoomT.k, 4 / zoomT.k] : []);
      const on = lit && (l.source === lit || l.target === lit);
      const faded = dim(l.source) && dim(l.target) || (lit && !on) || (!inFocus(l.target));
      ctx.strokeStyle = on ? col(l.target, 0.85) : col(l.target, faded ? 0.05 : dark ? 0.18 : 0.28);
      ctx.lineWidth = (on ? 1.6 : 0.9) / Math.sqrt(zoomT.k);
      ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); ctx.stroke();
      // a signal flows outward along every visible edge
      if (!faded && !RB.REDUCED) {
        const p = (t * 0.35 + l.phase) % 1, x = l.source.x + (l.target.x - l.source.x) * p, y = l.source.y + (l.target.y - l.source.y) * p;
        ctx.fillStyle = col(l.target, on ? 1 : 0.7, dark ? 0.9 : 0.5);
        ctx.beginPath(); ctx.arc(x, y, (on ? 2.2 : 1.3) / Math.sqrt(zoomT.k), 0, 6.283); ctx.fill();
      }
    }
    ctx.setLineDash([]);
    // nodes
    for (const n of nodes) {
      if (hidden(n)) continue;
      const r = R[n.kind], d = dim(n), isLit = n === lit, isMatch = matchSet?.has(n);
      const pulse = n.kind === "router" ? 1 + Math.sin(t * 2) * 0.08 : 1;
      if (!d) {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * (isLit || isMatch ? 4.2 : 2.8) * pulse);
        g.addColorStop(0, col(n, isLit || isMatch ? 0.55 : 0.3)); g.addColorStop(1, col(n, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r * 4.2 * pulse, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = d ? col(n, 0.18) : col(n, 1, dark ? (n.kind === "router" ? 0.92 : 0.82) : 0.55);
      ctx.beginPath(); ctx.arc(n.x, n.y, r * pulse, 0, 6.283); ctx.fill();
      if (n === selected) { ctx.strokeStyle = col(n, 1, dark ? 0.95 : 0.4); ctx.lineWidth = 1.6 / zoomT.k; ctx.beginPath(); ctx.arc(n.x, n.y, r + 4, 0, 6.283); ctx.stroke(); }
    }
    // labels: priority order (lit, router, packs, matches, shelves/apps, leaves); a label that would overlap one already
    // drawn waits until you zoom in, so labels never pile on top of each other
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const boxes = [];
    const prio = (n) => (n === lit ? 0 : n.kind === "router" ? 1 : n.kind === "pack" || n.kind === "hub" ? 2 : matchSet?.has(n) ? 3 : near?.has(n) ? 4 : n.kind === "status" || n.kind === "character" ? 5 : n.kind === "shelf" || n.kind === "app" || n.kind === "tool" || n.kind === "story" ? 6 : 7);
    const order = nodes.slice().sort((a, b) => prio(a) - prio(b));
    for (const n of order) {
      if (hidden(n)) continue;
      const big = n.kind === "router" || n.kind === "pack" || n.kind === "hub", mid = n.kind === "shelf" || n.kind === "app" || n.kind === "status" || n.kind === "character" || n.kind === "tool" || n.kind === "story";
      const show = n === lit || (near && near.has(n) && zoomT.k > 0.55) || matchSet?.has(n) || big || (mid && zoomT.k > 1.05) || zoomT.k > 2.3;
      if (!show || (dim(n) && !matchSet?.has(n) && n !== lit)) continue;
      const fs = (big ? 13 : 11) / Math.max(zoomT.k, 0.7);
      ctx.font = `${big ? 600 : 500} ${fs}px ${big ? "Unbounded" : "Geist"}, sans-serif`;
      const text = n.label.length > 42 ? n.label.slice(0, 40) + "…" : n.label;
      const w = ctx.measureText(text).width, h = fs * 1.25, x = n.x - w / 2, y = n.y + R[n.kind] + 4;
      const pad = 3 / zoomT.k;
      if (n !== lit && boxes.some((b) => x < b.x + b.w + pad && x + w + pad > b.x && y < b.y + b.h && y + h > b.y)) continue;
      boxes.push({ x, y, w, h });
      ctx.lineWidth = 3 / zoomT.k; ctx.strokeStyle = dark ? "rgba(11,12,15,.85)" : "rgba(245,246,248,.9)";
      ctx.strokeText(text, n.x, y); ctx.fillStyle = dark ? (big ? "#eceef0" : "#b9bfc6") : big ? "#15181c" : "#3e454d";
      ctx.fillText(text, n.x, y);
    }
    ctx.restore();
    raf = requestAnimationFrame(draw);
  }

  window.RBGraph = { mount, unmount, search };
  // if the page opened on #graph before this file loaded, mount now
  const v = document.getElementById("view");
  if (RB.state?.view === "graph" && RB.state.data && !v.querySelector(".graph-shell")) { v.innerHTML = ""; mount(v, RB.state.data); }
})();
