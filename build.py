#!/usr/bin/env python3
"""
Build data.json for the Reel Brain dashboard from a Notion export of the 🧠 Skill Library — Reel Inbox.

  python3 build.py data/notion_rows.json        # writes data.json
  python3 build.py data/notion_rows.json --check

The export is the raw result of the Notion connector's SQL query (an object with "results": [...]).
The site is PUBLIC (GitHub Pages), so this script publishes only what is safe:
  - never his personal notes ("Your note"), Notion URLs or brain paths;
  - client names are redacted;
  - for video-story rows only the title, type, creator and link (the plans stay private in Notion).
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REDACT = [(re.compile(p, re.I), r) for p, r in [
    (r"Aleena\s+Rais", "a client"), (r"Aleena\s+ma'?am", "a client"), (r"\bAleena\b", "a client"),
    (r"Stitch by Stitch", "a client"), (r"brain/[\w/.\-§ ]+\.md", ""), (r"https://app\.notion\.com\S*", ""),
]]

# id, label, Phosphor icon, one-line description. Display order.
CATS = [
    ("stories", "Next video stories", "book-open-text", "Short reel stories to research in full and direct as long-form KaalAurKatha videos"),
    ("recreate", "Recreate better", "arrows-clockwise", "Reels to rebuild in our style and beat"),
    ("editing", "Video editing & effects", "film-strip", "Transitions, text effects, sound and music cuts, edit styles"),
    ("ai", "AI video & image generation", "magic-wand", "Generation methods, cinematic composition, lighting"),
    ("design", "Design & typography", "text-aa", "Colour, type scale, fonts"),
    ("web", "Web & app development", "browsers", "Launch protocols, dev tools, agents"),
    ("marketing", "Marketing, ads & growth", "megaphone", "Paid ads, copy, persuasion, ad formats, content strategy"),
    ("business", "Business", "briefcase", "Thinking tools for business ideas"),
    ("research", "Research & tools", "magnifying-glass", "Sources, scrapers, productivity"),
    ("fitness", "Fitness reels", "barbell", "For the gym Instagram page"),
    ("waiting", "Not learned yet", "hourglass-medium", "Shared, waiting for the next capture"),
    ("failed", "Couldn't extract", "warning-circle", "Private, deleted or blocked reels and posts"),
]
DESIGN_WORDS = re.compile(r"\b(colou?r rule|typograph|type (scale|hierarchy)|fonts?|60-30-10|palette|design system|DESIGN\.md)", re.I)
MARKETING_WORDS = re.compile(r"\b(ads?|advert\w*|marketing|campaign|persuasi\w*|psycholog\w*|copywrit\w*|content strategy|audience growth)\b", re.I)
BUSINESS_WORDS = re.compile(r"\b(business|advisor|founder|startup|roast room)\b", re.I)


def jl(v):
    if not v:
        return []
    try:
        return json.loads(v) if isinstance(v, str) else list(v)
    except json.JSONDecodeError:
        return [v]


NOTE_LEAD = re.compile(r"^\s*(?:Your|His) note\b.*?(?=Example:|$)", re.S | re.I)
NOTE_SENT = re.compile(r"[^.!?]*\b(?:your|his) note\b[^.!?]*[.!?]\s*", re.I)
NOTE_PAREN = re.compile(r"\s*\((?:his|your) note[^)]*\)", re.I)


def clean(s):
    s = s or ""
    # his own note is private: drop the "Your note: …" lead-in and any sentence that quotes or mentions it
    s = NOTE_PAREN.sub("", NOTE_SENT.sub("", NOTE_LEAD.sub("", s)))
    for rx, rep in REDACT:
        s = rx.sub(rep, s)
    s = re.sub(r"\ban a client\b", "a client", s)
    return re.sub(r"\s{2,}", " ", s).strip(" ·")


def category(r):
    status, kind = r.get("Status"), r.get("Kind") or ""
    packs = jl(r.get("Pack"))
    text = " ".join(str(r.get(k) or "") for k in ("Reel", "What it teaches"))
    if r.get("Dashboard category"):
        return r["Dashboard category"]
    if status == "Failed":
        return "failed"
    if status in (None, "Queued", "Processing"):
        return "waiting"
    if kind.startswith("Story"):
        return "stories"
    if kind.startswith("Recreate"):
        return "recreate"
    title = r.get("Reel") or ""
    if kind == "Skill" and "editing_vfx" in packs:
        return "editing"
    if "marketing" in packs or MARKETING_WORDS.search(title):
        return "marketing"
    if "misc_tools" in packs and BUSINESS_WORDS.search(text):
        return "business"
    if "fitness" in packs and "editing_vfx" not in packs:
        return "fitness"
    if re.search(r"\bgrade\b|grading", title, re.I):
        return "editing"
    if DESIGN_WORDS.search(title):
        return "design"
    if "web_app_design" in packs:
        return "web"
    if "ai_generation" in packs and "editing_vfx" not in packs:
        return "ai"
    if "editing_vfx" in packs:
        return "editing"
    if "ai_generation" in packs:
        return "ai"
    return "research"


# ---------------------------------------------------------------- knowledge graph (from the brain itself)
BRAIN_DEFAULT = Path.home() / "Library/CloudStorage/GoogleDrive-atharvasarada47@gmail.com/My Drive/studio final/brain"
PACK_LABEL = {
    "youtube_story": "YouTube stories", "ai_generation": "AI generation", "editing_vfx": "Editing & VFX",
    "post_production": "Post production", "clients": "Clients", "marketing": "Marketing", "web_app_design": "Web & app",
    "cutaway": "Cutaway channel", "fitness": "Fitness", "skill_library": "Reel inbox", "files_storage": "Files",
    "misc_tools": "Tools & business", "credits": "Credits", "handoff_chatgpt": "ChatGPT handoff", "_shared": "Shared design",
}


def front_matter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    out = {}
    for line in (m.group(1).split("\n") if m else []):
        k, _, v = line.partition(":")
        if k and not k.startswith(" ") and v.strip():
            out[k.strip()] = re.sub(r"\s+#.*$", "", v).strip()
    return out


def as_list(v):
    return [x.strip() for x in (v or "").strip("[]").split(",") if x.strip()]


def build_graph(brain: Path):
    lib = brain / "88_skill_library"
    nodes, links, seen = [], [], set()

    def node(nid, label, kind, group, **kw):
        if nid not in seen:
            seen.add(nid)
            nodes.append({"id": nid, "label": clean(label), "kind": kind, "group": group, **kw})

    def link(a, b):
        links.append({"source": a, "target": b})

    node("router", "Router · CLAUDE.md", "router", "router")
    packs_with = set()
    for p in sorted(lib.rglob("*.md")):
        if p.name in {"HOME.md", "WORKER.md", "INDEX.md", "TECHNIQUES.md", "CONSULT.md"}:
            continue
        t = p.read_text(errors="ignore")
        f = front_matter(t)
        if "shelf" in f:
            sid = "shelf:" + f["shelf"]
            packs = as_list(f.get("listed_in_packs")) or [f["shelf"].split("/")[0]]
            node(sid, f.get("title", f["shelf"]), "shelf", packs[0], trigger=clean(f.get("open_when", "")))
            for pk in packs:
                packs_with.add(pk)
                node("pack:" + pk, PACK_LABEL.get(pk, pk), "pack", pk)
                link("pack:" + pk, sid)
            for i, part in enumerate(re.split(r"(?m)^## (?=\d{4}-\d{2}-\d{2} · )", t)[1:]):
                head = part.split("\n", 1)[0]
                m = re.match(r"(\d{4}-\d{2}-\d{2}) · (.+?)(?: · (@[\w.]+).*)?$", head)
                if not m:
                    continue
                url = re.search(r"https://www\.instagram\.com/(?:reel|p)/[\w-]+/?", part)
                eid = f"{sid}#{i}"
                node(eid, m.group(2), "entry", packs[0], date=m.group(1), creator=m.group(3) or "", link=url.group(0) if url else "")
                link(sid, eid)
        elif "id" in f:
            pk = as_list(f.get("pack")) or [p.relative_to(lib).parts[0]]
            app = (f.get("app") or "").split("(")[0].split("+")[0].split(" and ")[0].strip() or "Other"
            aid = f"app:{pk[0]}:{app}"
            node("pack:" + pk[0], PACK_LABEL.get(pk[0], pk[0]), "pack", pk[0])
            packs_with.add(pk[0])
            node(aid, f"{app} techniques", "app", pk[0])
            link("pack:" + pk[0], aid)
            src = re.search(r"https://www\.instagram\.com/(?:reel|p)/[\w-]+/?", t)
            tid = "tech:" + f["id"]
            node(tid, f.get("title", f["id"]), "technique", pk[0], category=clean(f.get("category", "")),
                 status=f.get("status", ""), link=src.group(0) if src else "")
            link(aid, tid)
    for pk in sorted(packs_with):
        link("router", "pack:" + pk)

    # ---------- relations: stories, characters, tools, creators (2026-10-27) ----------
    def rel(a, b, kind):
        links.append({"source": a, "target": b, "type": kind})
    texts = {}  # node id -> text to scan for characters / tools
    for p in sorted(lib.rglob("*.md")):
        if p.name in {"HOME.md", "WORKER.md", "INDEX.md", "TECHNIQUES.md", "CONSULT.md"}:
            continue
        t = p.read_text(errors="ignore"); f = front_matter(t)
        if "shelf" in f:
            sid = "shelf:" + f["shelf"]
            for i, part in enumerate(re.split(r"(?m)^## (?=\d{4}-\d{2}-\d{2} · )", t)[1:]):
                texts[f"{sid}#{i}"] = part[:2500]
        elif "id" in f:
            texts["tech:" + f["id"]] = t[:3000] + " " + f.get("app", "")
    # story bank
    bank = brain / "50_episodes/_story_bank"
    STAGES = ["new", "researching", "researched", "scripted", "posted"]
    if bank.exists():
        node("hub:stories", "Story bank", "hub", "youtube_story")
        node("pack:youtube_story", PACK_LABEL["youtube_story"], "pack", "youtube_story")
        link("pack:youtube_story", "hub:stories")
        for st in STAGES:
            node("status:" + st, st.capitalize(), "status", "status_" + st)
            link("hub:stories", "status:" + st)
        by_link = {}
        for nid, n in [(n["id"], n) for n in nodes if n.get("link")]:
            m = re.search(r"/(?:reel|p)/([\w-]+)", n["link"])
            if m: by_link.setdefault(m.group(1), []).append(nid)
        for p in sorted(bank.glob("*.md")):
            if p.name == "README.md":
                continue
            t = p.read_text(errors="ignore"); f = front_matter(t)
            if "story" not in f:
                continue
            st = (f.get("status") or "new").lower()
            st = st if st in STAGES else "new"
            sid = "story:" + f["story"]
            node(sid, f.get("title", f["story"]), "story", "youtube_story", status=st, typ=f.get("type", ""),
                 posted=f.get("posted", ""), link=(as_list(f.get("source_reels")) or [""])[0])
            link("status:" + st, sid)
            texts[sid] = f.get("title", "") + " " + " ".join(as_list(f.get("characters")))
            for url in as_list(f.get("source_reels")):          # story <- the learning its reel produced
                m = re.search(r"/(?:reel|p)/([\w-]+)", url)
                for other in by_link.get(m.group(1) if m else "", []):
                    if other != sid:
                        rel(other, sid, "story")
    CHAR = {"Hanuman": ["hanuman"], "Rama": [r"\brama\b", r"\bram\b(?!a)", "shri ram"], "Sita": [r"\bsita\b"], "Lakshmana": ["lakshman"],
            "Ravana": [r"\bravan"], "Krishna": ["krishna"], "Arjuna": [r"\barjun"], "Karna": [r"\bkarna\b", r"\bkern\b"], "Bhishma": ["bhishma"],
            "Dronacharya": [r"\bdrona"], "Eklavya": ["eklavya", "ekalavya"], "Abhimanyu": ["abhimanyu"], "Yudhishthira": ["yudhishthir"],
            "Draupadi": ["draupadi"], "Duryodhana": ["duryodhan"], "Shakuni": ["shakuni"], "Shiva": [r"\bshiva\b", "mahadev"], "Parvati": ["parvati"],
            "Ganesha": ["ganesh", "ganpati"], "Durga": [r"\bdurga\b"], "Kali": [r"\bkali\b", "mahakali"], "Vishnu": ["vishnu"], "Brahma": [r"\bbrahma\b"],
            "Indra": [r"\bindra\b"], "Surya": [r"\bsurya\b"], "Vayu": [r"\bvayu\b"], "Parashurama": ["parashuram", "purushram", "parshuram"],
            "Jambavan": ["jambavan", "jamvant"], "Sugriva": ["sugriv"], "Raktabeej": ["raktabeej", "raktbeez", "raktabija"], "Jayadratha": ["jayadrath"],
            "Kunti": [r"\bkunti\b"], "Vidura": [r"\bvidura?\b"], "Ashvatthama": ["ashvatthama", "ashwatthama"], "Yashoda": ["yashoda"]}
    TOOL = {"FilmCraft": ["filmcraft", "premiere"], "EffectCraft": ["effectcraft", "after effects"], "PhotoCraft": ["photocraft", "photoshop"],
            "SoundCraft": ["soundcraft", "audition"], "Resolve": ["davinci", r"\bresolve\b"], "HyperFrames": ["hyperframes"], "Blender": ["blender"],
            "Seedance": ["seedance"], "Google Flow": [r"\bflow\b", r"\bomni\b"], "ChatGPT image": ["chatgpt image", "gpt image"], "Higgsfield": ["higgsfield"],
            "Kling": [r"\bkling\b"], "Unreal Engine": ["unreal"], "Claude Code": ["claude code"], "GSAP": [r"\bgsap\b"], "Three.js": [r"three\.js"]}
    def scan(text, table):
        tl = text.lower(); return [k for k, pats in table.items() if any(re.search(pt, tl) for pt in pats)]
    char_hits, tool_hits = {}, {}
    for nid, text in texts.items():
        tags = re.search(r"\*\*Tags:\*\*(.+)", text)
        src = (tags.group(1) if tags else "") + " " + text
        for c in scan(src, CHAR): char_hits.setdefault(c, set()).add(nid)
        for tl in scan(src, TOOL): tool_hits.setdefault(tl, set()).add(nid)
    for c, ids in char_hits.items():
        if len(ids) < 2 and not any(i.startswith("story:") for i in ids):
            continue
        node("char:" + c, c, "character", "characters")
        for i in ids: rel(i, "char:" + c, "character")
    for tl, ids in tool_hits.items():
        if len(ids) < 2:
            continue
        node("tool:" + tl, tl, "tool", "tools")
        for i in ids: rel(i, "tool:" + tl, "tool")
    creators = {}
    for n in nodes:
        if n.get("creator"): creators.setdefault(n["creator"], []).append(n["id"])
    for c, ids in creators.items():
        if len(ids) >= 2:
            node("creator:" + c, c, "creator", "creators")
            for i in ids: rel(i, "creator:" + c, "creator")
    # nodes created only by relations must exist before links are kept
    ids = {n["id"] for n in nodes}
    links[:] = [l for l in links if l["source"] in ids and l["target"] in ids]
    for l in links: l.setdefault("type", "structure")
    return {"nodes": nodes, "links": links}


MD_LINK = re.compile(r"\[([^\]]+)\]\((?:https?://)[^)]*\)")


def unmd(v):
    """View-mode exports return Notion-flavoured markdown: strip auto-links, mention tags, code tags and escapes."""
    if not isinstance(v, str):
        return v
    v = re.sub(r"<mention[^>]*>(.*?)</mention>", r"\1", v, flags=re.S)
    v = re.sub(r"</?code>", "", v)
    v = MD_LINK.sub(r"\1", v)
    return re.sub(r"\\([_~*`#\[\]()>-])", r"\1", v)


def load_rows(paths):
    """Merge one or more exports (SQL or view mode, any order). The newest file wins for the same reel."""
    merged = {}
    for path in paths:
        raw = Path(path).read_text()
        for r in json.loads(raw[raw.index("{"):])["results"]:
            r = {k: unmd(v) for k, v in r.items()}
            r.setdefault("createdTime", r.get("Shared", ""))
            m = re.search(r"/(?:reel|reels|p|tv)/([\w-]+)", r.get("Link") or "")
            key = m.group(1) if m else (r.get("url") or r.get("Reel") or str(len(merged)))
            merged[key] = r
    return list(merged.values())


def main():
    srcs = [a for a in sys.argv[1:] if not a.startswith("--")]
    rows = load_rows(srcs)
    items = []
    for r in rows:
        cat = category(r)
        link = (r.get("Link") or "").split("?")[0]
        story = cat in ("stories", "recreate")
        title = r.get("Reel") or ""
        if cat == "waiting":
            title = "Waiting to be learned"  # the title is still his private note
        items.append({
            "title": clean(title) or "Untitled",
            "category": cat,
            "kind": r.get("Kind") or ("Waiting" if cat == "waiting" else "Failed" if cat == "failed" else ""),
            "status": r.get("Status") or "Waiting",
            "apps": jl(r.get("App")),
            "creator": r.get("Creator") or "",
            "teaches": "" if (story or cat == "waiting") else clean(r.get("What it teaches")),
            "use": "" if (story or cat == "waiting") else clean(r.get("Proposed use")),
            "link": link,
            "post": "/p/" in link,
            "decision": r.get("Your decision") or "",
            "shared": (r.get("createdTime") or r.get("Shared") or "")[:10],
        })
    items.sort(key=lambda x: x["shared"], reverse=True)
    out = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "categories": [{"id": c, "label": l, "icon": i, "blurb": b} for c, l, i, b in CATS],
        "items": items,
        "graph": build_graph(Path(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--brain=")), BRAIN_DEFAULT))),
    }
    text = json.dumps(out, ensure_ascii=False, indent=1)
    if "--check" in sys.argv:
        print(f"{len(items)} items")
        return
    (HERE / "data.json").write_text(text + "\n")
    counts = {}
    for it in items:
        counts[it["category"]] = counts.get(it["category"], 0) + 1
    g = out["graph"]
    print(f"data.json: {len(items)} items", counts, f"| graph {len(g['nodes'])} nodes, {len(g['links'])} links")


if __name__ == "__main__":
    main()
