// Reel Brain dashboard. Static: renders data.json (built by build.py from the Notion Reel Inbox).
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${+d} ${MONTHS[+m - 1]}`; };
  const KINDS = [["all", "All"], ["Skill", "Skills"], ["Knowledge", "Knowledge"], ["Method / prompt", "Methods"]];
  const LANES = ["stories", "recreate"];
  const TAIL = ["waiting", "failed"];

  const state = { data: null, cat: "all", kind: "all", q: "" };

  // ---------- theme ----------
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const applyTheme = (t) => {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const dark = (t || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "dark";
    $("#theme i").className = `ph ${dark ? "ph-sun" : "ph-moon-stars"}`;
    $("#theme").setAttribute("aria-label", dark ? "Switch to light" : "Switch to dark");
  };
  applyTheme(store.get("rb-theme"));
  $("#theme").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "dark" ? "light" : "dark";
    store.set("rb-theme", next); applyTheme(next);
  });

  // ---------- helpers ----------
  const catById = (id) => state.data.categories.find((c) => c.id === id);
  const matches = (it) => {
    if (state.kind !== "all" && it.kind !== state.kind) return false;
    if (!state.q) return true;
    const hay = [it.title, it.teaches, it.use, it.creator, (it.apps || []).join(" "), catById(it.category)?.label].join(" ").toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  };
  const visible = () => state.data.items.filter(matches);

  const tagFor = (it) => {
    if (it.category === "waiting") return `<span class="tag waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>Waiting</span>`;
    if (it.category === "failed") return `<span class="tag failed"><i class="ph ph-warning-circle" aria-hidden="true"></i>Couldn't extract</span>`;
    const k = it.kind || "";
    const label = k === "Method / prompt" ? "Method" : k;
    return label ? `<span class="tag ${k === "Skill" ? "skill" : ""}">${esc(label)}</span>` : "";
  };

  const row = (it) => {
    const apps = (it.apps || []).filter((a) => a !== "Claude" && a !== "Code").join(", ");
    const body = [
      it.teaches && `<div><h3>${it.category === "failed" ? "Why it failed" : "What it teaches"}</h3><p>${esc(it.teaches)}</p></div>`,
      it.use && `<div><h3>Use it for</h3><p>${esc(it.use)}</p></div>`,
      it.link && `<a class="open-link" href="${esc(it.link)}" target="_blank" rel="noopener">Open the ${it.post ? "post" : "reel"} on Instagram <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>`,
    ].filter(Boolean).join("");
    return `<details class="row">
      <summary>
        <span class="row-title">${esc(it.title)}</span>
        <time class="row-date" datetime="${esc(it.shared)}">${fmtDate(it.shared)}</time>
        <span class="row-meta">${tagFor(it)}${it.post ? `<span class="tag"><i class="ph ph-images" aria-hidden="true"></i>Post</span>` : ""}${apps ? `<span class="apps">${esc(apps)}</span>` : ""}${it.creator ? `<span>${esc(it.creator)}</span>` : ""}</span>
      </summary>
      <div class="row-body">${body || `<p class="apps">Nothing to show yet.</p>`}</div>
    </details>`;
  };

  const emptyFor = (id) => ({
    fitness: ["Nothing for the gym page yet", "Share a gym reel to the Reel Inbox with a note like \"for our gym videos\"."],
    waiting: ["Nothing waiting", "Every reel you shared has been read."],
    failed: ["Nothing failed", "Every reel and post could be read."],
  }[id] || ["Nothing here yet", "Reels you share for this kind of work will show up here."]);

  const section = (cat, items) => {
    const [t, s] = emptyFor(cat.id);
    return `<section class="sec" aria-labelledby="h-${cat.id}">
      <div class="sec-head"><h2 id="h-${cat.id}"><i class="ph ph-${esc(cat.icon)}" aria-hidden="true"></i>${esc(cat.label)}</h2><span class="count">${items.length}</span></div>
      <p>${esc(cat.blurb)}</p>
      ${items.length ? `<div class="rows">${items.map(row).join("")}</div>` : `<div class="empty-state"><strong>${t}</strong>${s}</div>`}
    </section>`;
  };

  const lane = (cat, items) => `<div class="lane">
      <h2><i class="ph ph-${esc(cat.icon)}" aria-hidden="true"></i>${esc(cat.label)}<span class="count" style="color:var(--faint);font-weight:400;margin-left:auto">${items.length}</span></h2>
      <p>${esc(cat.blurb)}</p>
      ${items.length ? `<ol>${items.map((it) => `<li><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a><span class="meta">${esc(it.creator)}${it.creator ? "  " : ""}${fmtDate(it.shared)}</span></li>`).join("")}</ol>`
                   : `<div class="empty">None yet. Share a story reel with a note saying it's for a video.</div>`}
    </div>`;

  // ---------- render ----------
  function render() {
    const d = state.data, items = visible();
    const by = (id) => items.filter((i) => i.category === id);

    // nav
    const all = d.items;
    const navCats = d.categories.filter((c) => !TAIL.includes(c.id));
    const navTail = d.categories.filter((c) => TAIL.includes(c.id));
    const btn = (id, label, icon, n) => `<li><button class="cat-btn" type="button" data-cat="${id}" aria-current="${state.cat === id}">
        <i class="ph ph-${icon}" aria-hidden="true"></i><span>${esc(label)}</span><span class="count">${n}</span></button></li>`;
    $("#catList").innerHTML =
      btn("all", "Everything", "squares-four", all.length) +
      navCats.map((c) => btn(c.id, c.label, c.icon, all.filter((i) => i.category === c.id).length)).join("") +
      `<li class="cat-sep" role="separator"></li>` +
      navTail.map((c) => btn(c.id, c.label, c.icon, all.filter((i) => i.category === c.id).length)).join("");

    // board + list
    const board = $("#board"), list = $("#list");
    board.className = ""; list.className = "";
    if (state.cat === "all") {
      board.innerHTML = state.kind === "all" ? `<div class="board">${LANES.map((id) => lane(catById(id), by(id))).join("")}</div>` : "";
      const secs = d.categories.filter((c) => !LANES.includes(c.id)).filter((c) => by(c.id).length || (!state.q && state.kind === "all" && !TAIL.includes(c.id) && c.id !== "fitness"));
      list.innerHTML = secs.length ? secs.map((c) => section(c, by(c.id))).join("")
        : `<div class="empty-state"><strong>No matches</strong>Try fewer words, or clear the filter.</div>`;
    } else if (LANES.includes(state.cat)) {
      board.innerHTML = `<div class="board" style="grid-template-columns:1fr">${lane(catById(state.cat), by(state.cat))}</div>`;
      list.innerHTML = "";
    } else {
      board.innerHTML = "";
      list.innerHTML = section(catById(state.cat), by(state.cat));
    }
    requestAnimationFrame(() => {
      board.className = "enter"; list.className = "enter";
      document.querySelector('.cat-btn[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
    });
  }

  function renderPulse() {
    const items = state.data.items, n = items.length;
    const parts = [
      ["Learned", items.filter((i) => !TAIL.includes(i.category)).length, "var(--accent)"],
      ["Waiting", items.filter((i) => i.category === "waiting").length, "var(--waiting)"],
      ["Couldn't extract", items.filter((i) => i.category === "failed").length, "var(--failed)"],
    ];
    $("#pulseBar").innerHTML = parts.filter((p) => p[1]).map(([l, v, c]) => `<span style="flex:${v};background:${c}" title="${l}: ${v}"></span>`).join("");
    $("#pulseBar").setAttribute("aria-label", parts.map(([l, v]) => `${l} ${v}`).join(", ") + ` of ${n} shared`);
    const skills = items.filter((i) => i.kind === "Skill").length;
    $("#pulseLegend").innerHTML =
      `<li><b>${n}</b> shared</li>` +
      parts.map(([l, v, c]) => `<li><span class="swatch" style="background:${c}"></span><b>${v}</b> ${l.toLowerCase()}</li>`).join("") +
      `<li><b>${skills}</b> buildable skills</li>`;
    const u = new Date(state.data.updated.replace("Z", ":00Z"));
    $("#updated").textContent = isNaN(u) ? "" : `Updated ${u.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  }

  function renderSeg() {
    $("#kindSeg").innerHTML = KINDS.map(([v, l]) => `<button type="button" role="radio" data-kind="${esc(v)}" aria-checked="${state.kind === v}">${l}</button>`).join("");
  }

  // ---------- events ----------
  $("#catList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    state.cat = b.dataset.cat; history.replaceState(null, "", state.cat === "all" ? location.pathname : `#${state.cat}`);
    render(); if (innerWidth > 900) $("#main").focus({ preventScroll: true });
  });
  $("#kindSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-kind]"); if (!b) return;
    state.kind = b.dataset.kind; renderSeg(); render();
  });
  let t; $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120); });

  addEventListener("hashchange", () => {
    const h = location.hash.slice(1) || "all";
    if (state.data && (h === "all" || state.data.categories.some((c) => c.id === h))) { state.cat = h; render(); }
  });

  // ---------- boot ----------
  fetch("data.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    state.data = d;
    const h = location.hash.slice(1);
    if (d.categories.some((c) => c.id === h)) state.cat = h;
    renderPulse(); renderSeg(); render();
  }).catch(() => {
    $("#list").innerHTML = `<div class="empty-state"><strong>Couldn't load the data</strong>data.json is missing or broken. The next hourly run rebuilds it.</div>`;
  });
})();
