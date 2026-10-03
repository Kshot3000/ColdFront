#!/usr/bin/env python3
"""Refresh data/snapshots/highlights.json — the Cold Front game-reel shelf.

Why this exists: the Highlights page merges the Bears and NFL YouTube
channel RSS feeds live, but each RSS window only holds a channel's ~15
newest uploads and both channels flood it with Shorts, pressers and
podcasts. The official per-game highlight reels rotate out of the window
within days, so the page was left leading with press conferences instead
of game footage. This script enumerates each channel's full Videos tab
with yt-dlp (hundreds of uploads deep), keeps only genuine Bears game
highlight reels, resolves a verified publish date for each, and writes
the snapshot the page merges in — game reels first, newest first.

Gates (a video must pass all of them for its channel):
  NFL channel   title mentions the Bears AND "Game Highlights",
                duration >= 240s (the full league reel, not a single play)
  Bears channel title mentions highlights AND a game context
                ("vs.", "win over", "preseason"), duration >= 150s
                (player reels like "HIGHLIGHTS: <player>" have no game
                context and stay out)

Dates resolve, in order: the previous snapshot, the channels' RSS
entries, then a full yt-dlp metadata fetch. A video whose date cannot be
verified is skipped for this run (never stamped with a guess) and picked
up by a later run. The file is only rewritten when the reel list actually
changes, so scheduled runs do not create noise commits.

Usage:  python3 scripts/refresh-highlights.py
Needs:  yt-dlp on PATH (pip install yt-dlp). Exit 0 on success
        (including "no change"), 1 when no verified reels could be
        produced — in that case the existing snapshot is left untouched.
"""
import json
import re
import shutil
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "snapshots" / "highlights.json"

BEARS_CHANNEL = "UCP0Cdc6moLMyDJiO0s-yhbQ"
NFL_CHANNEL = "UCDVYQ4Zhbm3S2dlz7P1GBDg"
MAX_REELS = 12

NFL_GATE = lambda t, d: ("bears" in t.lower() and "game highlights" in t.lower()
                         and (d or 0) >= 240)
_B_GAME = re.compile(r"\b(vs\.?|win over|preseason)\b", re.I)
BEARS_GATE = lambda t, d: ("highlight" in t.lower() and bool(_B_GAME.search(t))
                           and (d or 0) >= 150)


def ytdlp_cmd():
    exe = shutil.which("yt-dlp")
    if exe:
        return [exe]
    return [sys.executable, "-m", "yt_dlp"]


def flat_channel(handle, depth):
    cmd = ytdlp_cmd() + ["--flat-playlist", "--playlist-end", str(depth),
                         "-J", f"https://www.youtube.com/@{handle}/videos"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if out.returncode != 0:
        raise RuntimeError(f"yt-dlp enumeration failed for @{handle}: "
                           + out.stderr.strip()[-300:])
    return json.loads(out.stdout).get("entries", [])


def rss_dates(channel_id):
    """videoId -> published ISO, from the channel's keyless Atom feed."""
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        xml = r.read()
    ns = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    dates = {}
    for entry in ET.fromstring(xml).findall("atom:entry", ns):
        vid = entry.findtext("yt:videoId", namespaces=ns)
        pub = entry.findtext("atom:published", namespaces=ns)
        if vid and pub:
            dates[vid] = pub
    return dates


def invidious_date(video_id):
    """Publish date from a public Invidious instance (best-effort fallback)."""
    import urllib.error
    for host in ("inv.nadeko.net", "invidious.privacyredirect.com",
                 "inv.us.projectsegfau.lt"):
        try:
            req = urllib.request.Request(
                f"https://{host}/api/v1/videos/{video_id}",
                headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read())
            ts = data.get("published")
            if ts:
                return (datetime.fromtimestamp(ts, timezone.utc)
                        .strftime("%Y-%m-%dT%H:%M:%SZ"))
        except Exception:
            continue
    return None


def full_meta_date(video_id):
    cmd = ytdlp_cmd() + ["--no-download", "--print", "%(upload_date)s",
                          f"https://www.youtube.com/watch?v={video_id}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    raw = out.stdout.strip()
    if out.returncode == 0 and re.fullmatch(r"\d{8}", raw):
        return (f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
                f"T00:00:00Z")
    return None


def main():
    prior = {}
    prior_fetched = None
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
            prior_fetched = old.get("fetched")
            for it in old.get("items", []):
                if it.get("videoId") and it.get("published"):
                    prior[it["videoId"]] = it["published"]
        except Exception:
            prior = {}

    candidates = {}  # videoId -> item (enumeration order = recency hint)
    for handle, gate, src in (("NFL", NFL_GATE, "nfl"),
                              ("ChicagoBears", BEARS_GATE, "bears")):
        for e in flat_channel(handle, 600 if src == "nfl" else 200):
            vid, title = e.get("id"), (e.get("title") or "")
            if vid and gate(title, e.get("duration")) and vid not in candidates:
                candidates[vid] = {
                    "videoId": vid, "title": title, "src": src,
                    "duration": e.get("duration"),
                }
    if not candidates:
        print("no reel candidates found — snapshot left untouched", file=sys.stderr)
        return 1

    dates = {}
    for cid in (BEARS_CHANNEL, NFL_CHANNEL):
        try:
            dates.update(rss_dates(cid))
        except Exception as exc:  # RSS is a bonus source, not a hard dependency
            print(f"RSS date lookup failed ({cid}): {exc}", file=sys.stderr)

    items, skipped = [], []
    for vid, item in candidates.items():
        pub = prior.get(vid) or dates.get(vid) or invidious_date(vid) or full_meta_date(vid)
        if not pub:
            skipped.append(vid)
            continue
        item["published"] = pub
        items.append(item)
    for vid in skipped:
        print(f"skipped {vid}: no verifiable publish date this run", file=sys.stderr)
    if not items:
        print("no dated reels — snapshot left untouched", file=sys.stderr)
        return 1

    # Newest first; on a same-day tie the longer cut (the full league reel)
    # leads its team-channel sibling.
    items.sort(key=lambda it: (it["published"], it.get("duration") or 0),
               reverse=True)
    items = items[:MAX_REELS]
    new_ids = [(it["videoId"], it["published"]) for it in items]
    old_ids = [(v, prior[v]) for v in prior]
    fetched = prior_fetched
    if sorted(new_ids) != sorted(old_ids) or not OUT.exists():
        fetched = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    payload = {"fetched": fetched, "items": items}
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if OUT.exists() and OUT.read_text() == text:
        print(f"highlights snapshot unchanged ({len(items)} reels)")
        return 0
    OUT.write_text(text)
    print(f"highlights snapshot updated: {len(items)} reels, newest "
          f"{items[0]['published'][:10]} — {items[0]['title'][:70]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
