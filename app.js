// Reel Brain v3: tiles + graph views, hero synapse, motion from the studio's own UI library
// (hover-tilt ticket, ticket-arrive, rise-blur, final-sheen, ping, pop: brain/45_website_ui_animation).
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { if (!iso) return ""; const [, m, d] = iso.split("-"); return `${+d} ${MONTHS[+m - 1]}`; };
  const KINDS = [["all", "All"], ["Skill", "Skills"], ["Knowledge", "Knowledge"], ["Method / prompt", "Methods"]];
  const TAIL = ["waiting", "failed"];
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUCH = matchMedia("(hover: none)").matches;

  // Emblems on a 24 grid. `mv` marks the part each category's hover animation moves.
  const G = {
    stories: `<path class="tint" d="M3 6.2c2.6-1.3 5.6-1.2 9 .9 3.4-2.1 6.4-2.2 9-.9V19c-2.6-1.3-5.6-1.2-9 .9-3.4-2.1-6.4-2.2-9-.9z"/><path d="M12 7.1v12.8"/><path class="solid mv" d="M17.6 1.6l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>`,
    recreate: `<g class="mv"><path d="M19.6 13.2A7.8 7.8 0 1 1 17.4 6.6"/><path d="M18.2 2.8v4.4h-4.4"/></g><path class="solid" d="M10 8.9l5.2 3.1L10 15.1z"/>`,
    editing: `<path class="tint" d="M4 10h16v9a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19z"/><g class="mv"><path d="M4 10 5.3 5.4a1 1 0 0 1 1.2-.7L20 8.3"/><path d="M9.3 6.1l1.6 3M14.2 7.4l1.5 2.4"/></g><path class="solid" d="M9.6 13.2l4.6 2.6-4.6 2.6z"/>`,
    ai: `<g class="wand"><path d="M4.5 19.5 14.2 9.8"/><path class="tint" d="M13.4 8.4l2.2 2.2 1.5-1.5-2.2-2.2z"/></g><path class="solid mv" d="M18.4 2.4l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/><path class="solid mv2" d="M7 3.6l.55 1.25 1.25.55-1.25.55L7 7.2l-.55-1.25L5.2 5.4l1.25-.55zM19.5 13.5l.5 1.15 1.15.5-1.15.5-.5 1.15-.5-1.15-1.15-.5 1.15-.5z"/>`,
    design: `<path d="M3.8 19.2 8.6 5.5h.8l4.8 13.7M5.6 14.3h6.8"/><circle class="tint" cx="17.6" cy="16.4" r="3.6"/><path class="solid mv" d="M17.6 4.2c1.6 2.1 2.6 3.6 2.6 4.7a2.6 2.6 0 0 1-5.2 0c0-1.1 1-2.6 2.6-4.7z"/>`,
    web: `<rect class="tint" x="2.8" y="4.4" width="18.4" height="15.2" rx="2.4"/><path d="M2.8 8.8h18.4"/><path class="solid" d="M5.9 6.6a.9.9 0 1 1 0 .01zM8.6 6.6a.9.9 0 1 1 0 .01z"/><path d="M8.2 13.2 6.4 15l1.8 1.8M12.6 13.2l1.8 1.8-1.8 1.8"/><path class="solid mv" d="M15.6 11.2l5.6 2.3-2.4 1-1 2.4z"/>`,
    marketing: `<path class="tint" d="M3.2 10v4.2h3.4l7.6 4.6V5.4L6.6 10z"/><path class="mv" d="M17.4 9a4 4 0 0 1 0 6.2"/><path class="mv2" d="M19.6 6.6a7.2 7.2 0 0 1 0 11"/><path d="M7 14.4l1.5 5.2"/>`,
    business: `<rect class="tint" x="3" y="7.6" width="18" height="12" rx="2.2"/><path d="M8.8 7.6V5.4a1 1 0 0 1 1-1h4.4a1 1 0 0 1 1 1v2.2"/><path class="mv" pathLength="1" d="M6.6 16.4l3.2-3.1 2.6 2 5-4.8"/><path class="solid" d="M18.8 9.6v2.6h-2.6z"/>`,
    research: `<g class="mv"><circle class="tint" cx="10.4" cy="10.4" r="6.6"/><path d="M15.4 15.4 21 21"/><path class="solid" d="M10.4 6.6l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z"/></g>`,
    fitness: `<g class="mv"><path d="M9 12h6M3.2 12h2.2M18.6 12h2.2"/><rect class="tint" x="5.4" y="7.4" width="3.6" height="9.2" rx="1.2"/><rect class="tint" x="15" y="7.4" width="3.6" height="9.2" rx="1.2"/><path d="M5.4 9.2v5.6M18.6 9.2v5.6"/></g>`,
    waiting: `<g class="mv"><path class="tint" d="M7 3.4h10v2.4c0 2.2-2.2 3.9-5 6.2-2.8-2.3-5-4-5-6.2z"/><path d="M7 20.6h10v-2.4c0-2.2-2.2-3.9-5-6.2-2.8 2.3-5 4-5 6.2z"/><path d="M5.6 3.4h12.8M5.6 20.6h12.8"/><path class="solid" d="M9.4 19.4h5.2L12 17.2z"/></g>`,
    failed: `<path d="M10.2 13.8 8.6 15.4a3.4 3.4 0 0 1-4.8-4.8l1.6-1.6M13.8 10.2l1.6-1.6a3.4 3.4 0 0 1 4.8 4.8l-1.6 1.6"/><path class="mv" d="M8.2 3.6l.8 2.2M3.6 8.2l2.2.8M15.8 20.4l-.8-2.2M20.4 15.8l-2.2-.8"/>`,
    all: `<rect class="tint" x="3.4" y="3.4" width="7.4" height="7.4" rx="2"/><rect x="13.2" y="3.4" width="7.4" height="7.4" rx="2"/><rect x="3.4" y="13.2" width="7.4" height="7.4" rx="2"/><rect class="tint" x="13.2" y="13.2" width="7.4" height="7.4" rx="2"/>`,
  };
  const HUE = { stories: 52, recreate: 24, editing: 300, ai: 335, design: 190, web: 250, marketing: 78, business: 150, research: 225, fitness: 125, waiting: 210, failed: 12 };
  // graph groups are brain packs; each gets the hue of the dashboard category it feeds
  const PACK_HUE = { router: 26, youtube_story: 52, ai_generation: 335, editing_vfx: 300, post_production: 190, _shared: 190, clients: 24,
    marketing: 78, web_app_design: 250, cutaway: 40, fitness: 125, skill_library: 225, misc_tools: 150 };
  const emblem = (id) => `<span class="emblem em-${id}" style="--hue:${HUE[id] ?? 40}"><svg viewBox="0 0 24 24" aria-hidden="true">${G[id] || G.all}</svg></span>`;
  const icon = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ARROW = icon(`<path d="M7 17 17 7M9 7h8v8"/>`);
  const SUN = icon(`<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/>`);
  const MOON = icon(`<path d="M20 14.6A8 8 0 1 1 9.4 4a6.4 6.4 0 0 0 10.6 10.6z"/>`);

  const state = { data: null, view: "tiles", cat: "home", kind: "all", q: "" };
  window.RB = { state, HUE, PACK_HUE, G, esc, fmtDate, REDUCED, TOUCH, emblem };

  // ---------- theme (icon pops on swap) ----------
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const sysLight = () => matchMedia("(prefers-color-scheme: light)").matches;
  const isDark = () => (document.documentElement.dataset.theme || (sysLight() ? "light" : "dark")) === "dark";
  const applyTheme = (t, animate) => {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const b = $("#theme"); b.innerHTML = isDark() ? SUN : MOON;
    b.setAttribute("aria-label", isDark() ? "Switch to light" : "Switch to dark");
    if (animate) { b.classList.remove("popping"); void b.offsetWidth; b.classList.add("popping"); }
    dispatchEvent(new Event("rb-theme"));
  };
  applyTheme(store.get("rb-theme"));
  $("#theme").addEventListener("click", () => { const next = isDark() ? "light" : "dark"; store.set("rb-theme", next); applyTheme(next, true); });

  // ---------- your hover-tilt ticket, constants untouched (hover_tilt_ticket.md) ----------
  function tiltCard(el, base = "perspective(900px) rotate(-1.52deg) skewX(-.27deg)", max = 8) {
    if (TOUCH || REDUCED || el.dataset.tilt) return;
    el.dataset.tilt = "1";
    const shine = el.querySelector(".shine");
    const st = { hover: false, mx: 0, my: 0, rect: null, rx: 0, ry: 0, s: 1, trx: 0, try_: 0, ts: 1 };
    let id = 0;
    const target = () => { const r = st.rect, hw = r.width / 2, hh = r.height / 2;
      st.trx = -((st.my - r.top - hh) / hh) * max; st.try_ = ((st.mx - r.left - hw) / hw) * max; };
    const step = () => {
      const k = st.hover ? 0.1 : 0.07;
      st.rx += (st.trx - st.rx) * k; st.ry += (st.try_ - st.ry) * k; st.s += (st.ts - st.s) * k;
      el.style.transform = `${base} rotateX(${st.rx.toFixed(3)}deg) rotateY(${st.ry.toFixed(3)}deg) scale3d(${st.s.toFixed(4)},${st.s.toFixed(4)},${st.s.toFixed(4)})`;
      const o = 0.3 + (st.s - 1) * 5;
      el.style.boxShadow = `${(st.ry * 1.2).toFixed(1)}px ${(st.rx * -1.2 + 22).toFixed(1)}px 44px rgba(4,18,34,${o.toFixed(2)}), 0 0 30px rgba(4,18,34,.2)`;
      if (st.hover && st.rect && shine) { const px = (st.mx - st.rect.left) / st.rect.width * 100, py = (st.my - st.rect.top) / st.rect.height * 100;
        shine.style.backgroundImage = `radial-gradient(circle at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(255,255,255,.2) 0%, rgba(255,255,255,.05) 38%, transparent 68%)`; }
      if (Math.abs(st.trx - st.rx) < 0.005 && Math.abs(st.try_ - st.ry) < 0.005 && Math.abs(st.ts - st.s) < 0.0005) {
        id = 0; if (!st.hover) { el.style.transform = ""; el.style.boxShadow = ""; } return; }
      id = requestAnimationFrame(step);
    };
    const go = () => { if (!id) id = requestAnimationFrame(step); };
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") return;
      Object.assign(st, { hover: true, mx: e.clientX, my: e.clientY, rect: el.getBoundingClientRect(), ts: 1.05 }); target(); if (shine) shine.style.opacity = 1; go(); });
    el.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" || !st.hover) return; st.mx = e.clientX; st.my = e.clientY; target(); go(); });
    const leave = () => { Object.assign(st, { hover: false, trx: 0, try_: 0, ts: 1 }); if (shine) shine.style.opacity = 0; go(); };
    el.addEventListener("pointerleave", leave); el.addEventListener("pointercancel", leave);
  }

  // ---------- count-up ----------
  function countUp(el, to, ms = 900) {
    if (REDUCED || !to) { el.textContent = to; return; }
    const t0 = performance.now(); const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (t) => { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(ease(p) * to); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => { el.textContent = to; }, ms + 400); // a background tab never fires rAF
  }

  // ---------- sliding pills (view switch + kind filter) ----------
  function slidePill(container, pill, active) {
    if (!container || !pill || !active) return;
    const c = container.getBoundingClientRect(), a = active.getBoundingClientRect();
    pill.style.width = `${a.width}px`;
    pill.style.transform = `translateX(${a.left - c.left - parseFloat(getComputedStyle(container).paddingLeft || 0)}px)`;
  }

  // ---------- data helpers ----------
  const cat = (id) => state.data.categories.find((c) => c.id === id);
  const learned = () => state.data.items.filter((i) => !TAIL.includes(i.category));
  const inCat = (id) => state.data.items.filter((i) => i.category === id);
  const matches = (it) => {
    if (state.kind !== "all" && it.kind !== state.kind) return false;
    if (!state.q) return true;
    const hay = [it.title, it.teaches, it.use, it.creator, (it.apps || []).join(" "), cat(it.category)?.label].join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  };
  const weekAgo = () => { const d = new Date(state.data.updated.slice(0, 10)); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const subline = (id, items) => {
    if (!items.length) return id === "fitness" ? "Share a gym reel to fill this" : "Nothing yet";
    if (id === "stories") return "Research in full, direct as long-form";
    if (id === "recreate") return "Remake in our style and beat it";
    const k = { Skill: 0, Knowledge: 0, "Method / prompt": 0 };
    items.forEach((i) => { if (i.kind in k) k[i.kind]++; });
    const parts = [];
    if (k.Skill) parts.push(plural(k.Skill, "skill"));
    if (k.Knowledge) parts.push(`${k.Knowledge} knowledge`);
    if (k["Method / prompt"]) parts.push(plural(k["Method / prompt"], "method"));
    if (id === "editing") {
      const apps = {}; items.forEach((i) => (i.apps || []).forEach((a) => { if (!["Claude", "Code"].includes(a)) apps[a] = (apps[a] || 0) + 1; }));
      const top = Object.entries(apps).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a, n]) => `${a} ${n}`);
      return `${parts.join(", ")}. Top apps: ${top.join(", ")}`;
    }
    return parts.join(", ");
  };

  // ---------- pieces ----------
  const kindTag = (it) => {
    if (it.category === "waiting") return `<span class="chip" style="--hue:${HUE.waiting}">${icon(G.waiting)}Waiting</span>`;
    if (it.category === "failed") return `<span class="chip" style="--hue:${HUE.failed}">${icon(G.failed)}Couldn't extract</span>`;
    const k = it.kind === "Method / prompt" ? "Method" : it.kind;
    return k ? `<span class="tag ${it.kind === "Skill" ? "skill" : ""}">${esc(k)}</span>` : "";
  };
  const row = (it, showCat) => {
    const apps = (it.apps || []).filter((a) => a !== "Claude" && a !== "Code").join(", ");
    const c = cat(it.category);
    const body = [
      it.teaches && `<div><h3>${it.category === "failed" ? "Why it failed" : "What it teaches"}</h3><p>${esc(it.teaches)}</p></div>`,
      it.use && `<div><h3>Use it for</h3><p>${esc(it.use)}</p></div>`,
      it.link && `<a class="open-link" href="${esc(it.link)}" target="_blank" rel="noopener">Open the ${it.post ? "post" : "reel"} on Instagram ${ARROW}</a>`,
    ].filter(Boolean).join("");
    return `<details class="row"><summary>
        <span class="row-title">${esc(it.title)}</span>
        <time class="row-date" datetime="${esc(it.shared)}">${fmtDate(it.shared)}</time>
        <span class="row-meta">${showCat && c ? `<span class="chip" style="--hue:${HUE[c.id]}">${icon(G[c.id])}${esc(c.label)}</span>` : ""}${kindTag(it)}${it.post ? `<span class="tag">Post</span>` : ""}${apps ? `<span>${esc(apps)}</span>` : ""}${it.creator ? `<span>${esc(it.creator)}</span>` : ""}</span>
      </summary><div class="row-body">${body || `<p>Nothing to show yet.</p>`}</div></details>`;
  };

  function renderMeters() {
    const all = state.data.items, n = all.length, L = learned().length;
    const W = inCat("waiting").length, F = inCat("failed").length, S = all.filter((i) => i.kind === "Skill").length;
    const m = [
      ["home", "Learned", L, n, "var(--accent)", "of everything shared"],
      ["waiting", "Waiting", W, n, `oklch(var(--em-l) 0.09 ${HUE.waiting})`, "queued for the next run"],
      ["failed", "Couldn't extract", F, n, `oklch(var(--em-l) var(--em-c) ${HUE.failed})`, "private, deleted or blocked"],
      ["skills", "Buildable skills", S, L, `oklch(var(--em-l) var(--em-c) ${HUE.editing})`, "of what was learned"],
    ];
    const el = $("#meters");
    el.classList.add("pre");
    el.innerHTML = m.map(([go, label, v, of, c, note], i) => {
      const pct = of ? Math.round((v / of) * 100) : 0;
      const ping = go === "waiting" && v > 0 ? `<span class="ping-dot" style="--c:${c}" aria-hidden="true"></span>` : "";
      return `<button class="meter" type="button" data-go="${go}" style="--delay:${(i * 0.1).toFixed(1)}s" aria-label="${label}: ${v} ${note}">
          <span class="meter-top"><span class="meter-label">${ping}${label}</span><span class="meter-pct">${pct}%</span></span>
          <span class="meter-val"><b data-count="${v}">0</b><span>/ ${of}<span class="note"> ${note}</span></span></span>
          <span class="track"><span class="fill sheen" style="--w:${pct}%;--c:${c}"></span></span>
        </button>`;
    }).join("");
    $$("[data-count]", el).forEach((b) => countUp(b, +b.dataset.count));
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("pre")));
    setTimeout(() => el.classList.remove("pre"), 120);
    const u = new Date(state.data.updated.replace("Z", ":00Z"));
    $("#updated").textContent = isNaN(u) ? "" : `Updated ${u.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  }

  function homeView() {
    const L = learned().length, since = weekAgo();
    const ids = state.data.categories.map((c) => c.id).filter((id) => !TAIL.includes(id));
    const tiles = ids.map((id, i) => {
      const c = cat(id), items = inCat(id), pct = L ? Math.round((items.length / L) * 100) : 0;
      const fresh = items.filter((x) => x.shared >= since).length;
      return `<button class="tile arrive ${items.length ? "" : "zero"}" type="button" data-cat="${id}" style="--hue:${HUE[id]};--delay:${(i * 0.06).toFixed(2)}s">
        <span class="shine" aria-hidden="true"></span>
        <span class="tile-head">${emblem(id)}<span class="tile-count" data-count="${items.length}">0</span></span>
        <span class="tile-name">${esc(c.label)}</span>
        <span class="tile-sub">${esc(subline(id, items))}</span>
        <span class="track"><span class="fill" style="--w:${Math.max(pct, items.length ? 3 : 0)}%"></span></span>
        <span class="tile-foot"><span>${pct}% of library</span><span>${fresh ? `+${fresh} this week` : ""}</span></span>
      </button>`;
    }).join("");
    const recent = learned().slice(0, 8);
    return `<h2 class="group-label">Your library</h2>
      <div class="tiles">${tiles}</div>
      <section class="sec"><div class="sec-head">${emblem("all")}<h2>Latest learned</h2></div>
        <p>The newest things Claude filed from your shares.</p>
        <div class="rows enter">${recent.map((x) => row(x, true)).join("")}</div></section>`;
  }

  const EMPTY = {
    fitness: ["Nothing for the gym page yet", "Share a gym reel to the Reel Inbox with a note like \"for our gym videos\"."],
    waiting: ["Nothing waiting", "Every reel you shared has been read."],
    failed: ["Nothing failed", "Every reel and post could be read."],
  };
  const catView = (id) => {
    const c = cat(id), items = inCat(id).filter(matches);
    const [t, s] = EMPTY[id] || ["Nothing here yet", "Reels you share for this kind of work will show up here."];
    return `<section class="sec"><div class="sec-head">${emblem(id)}<h2>${esc(c.label)}<span class="num">${items.length}</span></h2></div>
      <p>${esc(c.blurb)}</p>
      ${items.length ? `<div class="rows enter">${items.map((x) => row(x)).join("")}</div>` : `<div class="empty-state"><strong>${t}</strong>${s}</div>`}</section>`;
  };
  const skillsView = () => {
    const items = state.data.items.filter((i) => i.kind === "Skill" && matches(i));
    return `<section class="sec"><div class="sec-head">${emblem("editing")}<h2>Buildable skills<span class="num">${items.length}</span></h2></div>
      <p>Techniques with recipes we can rebuild in FilmCraft, EffectCraft, SoundCraft and the rest.</p>
      <div class="rows enter">${items.map((x) => row(x, true)).join("")}</div></section>`;
  };
  const searchView = () => {
    const items = state.data.items.filter(matches);
    return `<section class="sec"><div class="sec-head">${emblem("research")}<h2>${items.length ? "Results" : "No matches"}<span class="num">${items.length}</span></h2></div>
      ${items.length ? `<div class="rows enter">${items.map((x) => row(x, true)).join("")}</div>` : `<div class="empty-state"><strong>Nothing matches that</strong>Try fewer words, or clear the filter.</div>`}</section>`;
  };

  function render() {
    const v = $("#view");
    document.body.dataset.view = state.view;
    $$(".viewswitch [data-view]").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === state.view));
    slidePill($(".viewswitch"), $(".vs-pill"), $(`.viewswitch [data-view="${state.view}"]`));
    $("#kindSeg").innerHTML = `<span class="seg-pill" aria-hidden="true"></span>` +
      KINDS.map(([k, l]) => `<button type="button" role="radio" data-kind="${esc(k)}" aria-checked="${state.kind === k}">${l}</button>`).join("");
    requestAnimationFrame(() => slidePill($("#kindSeg"), $("#kindSeg .seg-pill"), $(`#kindSeg [aria-checked="true"]`)));
    setTimeout(() => slidePill($("#kindSeg"), $("#kindSeg .seg-pill"), $(`#kindSeg [aria-checked="true"]`)), 60);
    $("#kindSeg").hidden = state.view === "graph";

    if (state.view === "graph") {
      $("#back").hidden = true;
      if (!v.querySelector(".graph-shell")) { v.innerHTML = ""; window.RBGraph?.mount(v, state.data); }
      window.RBGraph?.search(state.q);
      return;
    }
    window.RBGraph?.unmount();
    const searching = state.q || (state.cat === "home" && state.kind !== "all");
    v.innerHTML = searching ? searchView() : state.cat === "home" ? homeView() : state.cat === "skills" ? skillsView() : catView(state.cat);
    $("#back").hidden = state.cat === "home" && !state.q;
    $$(".tile", v).forEach((t) => {
      tiltCard(t);
      setTimeout(() => t.classList.remove("arrive"), 2200); // a stalled tab must still land on the resting state
    });
    $$(".tile-count[data-count]", v).forEach((c, i) => setTimeout(() => countUp(c, +c.dataset.count), 180 + i * 60));
  }

  const hashFor = () => (state.view === "graph" ? "#graph" : state.cat === "home" ? location.pathname : `#${state.cat}`);
  const go = (c) => {
    state.view = "tiles"; state.cat = c; history.replaceState(null, "", hashFor());
    render(); scrollTo({ top: c === "home" ? 0 : $("#main").offsetTop - 12, behavior: REDUCED ? "auto" : "smooth" });
  };
  window.RB.goCategory = go;

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cat],[data-go]"); if (!t || t.closest(".graph-shell")) return;
    go(t.dataset.cat || t.dataset.go);
  });
  $(".viewswitch").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]"); if (!b || b.dataset.view === state.view) return;
    state.view = b.dataset.view; if (state.view === "tiles") state.cat = "home";
    history.replaceState(null, "", hashFor()); render();
  });
  $("#back").addEventListener("click", () => { state.q = ""; $("#q").value = ""; go("home"); });
  $("#kindSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (!b) return; state.kind = b.dataset.kind; render(); });
  let tm; $("#q").addEventListener("input", (e) => { clearTimeout(tm); tm = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120); });
  addEventListener("hashchange", () => {
    if (!state.data) return; const h = location.hash.slice(1) || "home";
    if (h === "graph") { state.view = "graph"; } else { state.view = "tiles"; state.cat = h; }
    render();
  });
  addEventListener("resize", () => slidePill($(".viewswitch"), $(".vs-pill"), $(`.viewswitch [data-view="${state.view}"]`)));
  document.fonts?.ready.then(() => slidePill($(".viewswitch"), $(".vs-pill"), $(`.viewswitch [data-view="${state.view}"]`)));

  // ---------- boot ----------
  fetch("data.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    state.data = d;
    const h = location.hash.slice(1);
    if (h === "graph") state.view = "graph";
    else if (h && (h === "skills" || d.categories.some((c) => c.id === h))) state.cat = h;
    renderMeters(); render();
    dispatchEvent(new CustomEvent("rb-data", { detail: d }));
  }).catch(() => {
    $("#view").innerHTML = `<div class="empty-state"><strong>Couldn't load the data</strong>data.json is missing or broken. The next capture rebuilds it.</div>`;
  });
})();
