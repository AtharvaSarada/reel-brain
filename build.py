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
    ("waiting", "Not learned yet", "hourglass-medium", "Shared, waiting for the next hourly run"),
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


def clean(s):
    s = s or ""
    for rx, rep in REDACT:
        s = rx.sub(rep, s)
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


def main():
    src = Path(sys.argv[1])
    raw = src.read_text()
    rows = json.loads(raw[raw.index("{"):])["results"]
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
            "shared": (r.get("createdTime") or "")[:10],
        })
    items.sort(key=lambda x: x["shared"], reverse=True)
    out = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "categories": [{"id": c, "label": l, "icon": i, "blurb": b} for c, l, i, b in CATS],
        "items": items,
    }
    text = json.dumps(out, ensure_ascii=False, indent=1)
    if "--check" in sys.argv:
        print(f"{len(items)} items")
        return
    (HERE / "data.json").write_text(text + "\n")
    counts = {}
    for it in items:
        counts[it["category"]] = counts.get(it["category"], 0) + 1
    print(f"data.json: {len(items)} items", counts)


if __name__ == "__main__":
    main()
