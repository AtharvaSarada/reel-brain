# Reel Brain

A live dashboard of everything Claude learned from the Instagram reels and posts Atharva shares:
skills, knowledge, methods, next video stories, and what could not be extracted, sorted by the kind of work it serves.

- **Data:** `data.json`, rebuilt from the Notion Reel Inbox by `build.py` after each hourly worker run.
- **Privacy:** the site is public, so `build.py` publishes no private notes, no client names, no Notion links and no
  internal paths, and story plans show only their title and source. The raw Notion export lives in `data/` and is gitignored.
- **Stack:** static HTML, CSS and JS; Geist and Geist Mono; Phosphor icons. No build step.
