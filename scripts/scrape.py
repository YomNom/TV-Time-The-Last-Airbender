"""
Scrape Avatar: The Last Airbender episode transcripts from Fandom.

Outputs (under data/):
  - episodes.json   one record per episode with title, book, episode#,
                    overall#, air date, cast (main/minor/antagonists), locations
  - scripts.csv     dialogue rows: episode_id, line_index, speaker, text, is_narration

Source: https://avatar.fandom.com via the MediaWiki API (avoids the Cloudflare
challenge that fronts the rendered HTML pages).

Run:  python3 scripts/scrape.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable

import requests

API = "https://avatar.fandom.com/api.php"
UA = "ATLA-vis-class-project/1.0 (educational; quochuynh798@gmail.com)"
CATEGORY = "Category:Avatar:_The_Last_Airbender_episode_transcripts"

# Pages in the category that aren't canonical aired-episode transcripts.
# These are comics, video-game tie-ins, the unaired pilot, or sub-category
# pages that the API surfaces alongside real members.
NON_CANON = {
    "Transcript:Bending Battle",            # Nick.com online game comic
    "Transcript:Escape from the Spirit World",  # game tie-in
    "Transcript:School Time Shipping",      # short comic
    "Transcript:Swamp Skiin' Throwdown",    # short comic
    "Transcript:Unaired pilot",             # never aired
}

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

BOOK_NAME_TO_NUM = {"water": 1, "earth": 2, "fire": 3}
EPISODES_PER_BOOK = {1: 20, 2: 20, 3: 21}  # used to compute overall episode index


# HTTP

def api(params: dict) -> dict:
    full = {"format": "json", **params}
    for attempt in range(4):
        try:
            r = requests.get(API, params=full, headers={"User-Agent": UA}, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            if attempt == 3:
                raise
            wait = 2 ** attempt
            print(f"  retry in {wait}s ({exc})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def fetch_wikitext(page_title: str) -> str | None:
    data = api({"action": "parse", "page": page_title, "prop": "wikitext", "redirects": 1})
    if "error" in data:
        return None
    return data["parse"]["wikitext"]["*"]


# ---------- Listing ----------

def list_transcript_pages() -> list[str]:
    """Return every transcript page in the category, paginated if needed."""
    titles: list[str] = []
    cont: dict = {}
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": CATEGORY,
            "cmlimit": "500",
            **cont,
        }
        data = api(params)
        for m in data["query"]["categorymembers"]:
            t = m["title"]
            # skip sub-category pages that share this category
            if t.startswith("Category:"):
                continue
            # skip commentary tracks
            if "(commentary)" in t.lower():
                continue
            # skip non-canon (comics / games / unaired)
            if t in NON_CANON:
                continue
            titles.append(t)
        if "continue" in data:
            cont = data["continue"]
        else:
            break
    titles.sort()
    return titles


# Wikitext cleaning

WIKILINK = re.compile(r"\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]")
TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
HTML_TAG = re.compile(r"<[^>]+>")
ITALIC_BOLD = re.compile(r"'''''|'''|''")
WHITESPACE = re.compile(r"[ \t]+")


def clean_text(s: str) -> str:
    """Strip wiki markup down to plain text suitable for display/analysis."""
    if not s:
        return ""
    # collapse nested templates iteratively (just in case)
    prev = None
    while prev != s:
        prev = s
        s = TEMPLATE.sub("", s)
    s = WIKILINK.sub(lambda m: m.group(2) or m.group(1), s)
    s = s.replace("<br />", "\n").replace("<br/>", "\n").replace("<br>", "\n")
    s = HTML_TAG.sub("", s)
    s = ITALIC_BOLD.sub("", s)
    s = s.replace("&nbsp;", " ").replace("&mdash;", "—").replace("&amp;", "&")
    s = WHITESPACE.sub(" ", s)
    return s.strip()


def link_target(s: str) -> str:
    """For `[[Foo|Bar]]` return `Foo`; for `[[Foo]]` return `Foo`."""
    m = WIKILINK.search(s)
    if m:
        return m.group(1).strip()
    return s.strip()


# Dialogue parser

def parse_dialogue(wikitext: str) -> list[dict]:
    """
    Walk the wikitable rows and pull speaker/line pairs.

    The transcript pages use 2-column wikitables: column 1 is the speaker
    (`!Name`) or empty for narration, column 2 (`|...`) is the line.
    """
    # cut off everything after the cast section so we don't parse cast lists
    # as dialogue
    cutoff = re.search(r"\n==\s*Cast\s*==", wikitext)
    body = wikitext[: cutoff.start()] if cutoff else wikitext

    # collect lines inside any wikitable
    in_table = False
    rows: list[list[str]] = [[]]
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("{|"):
            in_table = True
            continue
        if stripped == "|}":
            in_table = False
            if rows[-1]:
                rows.append([])
            continue
        if not in_table:
            continue
        if stripped == "|-":
            if rows[-1]:
                rows.append([])
            continue
        rows[-1].append(line)

    out: list[dict] = []
    for row in rows:
        if not row:
            continue
        speaker = ""
        cells: list[list[str]] = []  # one list of lines per cell
        cur: list[str] | None = None
        for line in row:
            if line.startswith("!"):
                speaker = line[1:].split("|", 1)[0].strip()
                cur = []          # the rest of the !-line could carry data
                rest = line[1:]
                if "|" in rest:
                    cur.append(rest.split("|", 1)[1])
                cells.append(cur)
            elif line.startswith("|"):
                content = line[1:]
                cur = [content]
                cells.append(cur)
            else:
                if cur is not None:
                    cur.append(line)
        # the dialogue is the LAST cell (column 2 in a 2-col table)
        if not cells:
            continue
        text = clean_text("\n".join(cells[-1]))
        if not text:
            continue
        speaker_clean = clean_text(speaker)
        out.append(
            {
                "speaker": speaker_clean,
                "text": text,
                "is_narration": speaker_clean == "",
            }
        )
    return out


# Cast / locations parsers

def parse_cast(wikitext: str) -> dict[str, list[str]]:
    cast = {"main": [], "minor": [], "antagonists": []}
    sec = re.search(r"\n==\s*Cast\s*==(.+?)(?:\n==[^=]|\Z)", wikitext, re.S)
    if not sec:
        return cast
    block = sec.group(1)

    # find each === Subhead === and grab bullets until the next subhead or end
    for m in re.finditer(r"===\s*(Main|Minor|Antagonists?)\s*===([^=]*)", block, re.I):
        key = m.group(1).lower().rstrip("s") + ("s" if m.group(1).lower().startswith("antag") else "")
        # normalize: "antagonists" stays plural, "main"/"minor" singular keys
        if key.startswith("antag"):
            key = "antagonists"
        bucket = cast[key]
        for line in m.group(2).splitlines():
            line = line.strip()
            if line.startswith("*"):
                target = link_target(line.lstrip("* ").strip())
                target = clean_text(target)
                if target:
                    bucket.append(target)
    return cast


def parse_locations(wikitext: str) -> list[str]:
    sec = re.search(r"\n==\s*Locations?\s*==(.+?)(?:\n==[^=]|\Z)", wikitext, re.S)
    if not sec:
        return []
    out: list[str] = []
    for line in sec.group(1).splitlines():
        line = line.strip()
        if line.startswith("*"):
            target = link_target(line.lstrip("* ").strip())
            target = clean_text(target)
            if target and target not in out:
                out.append(target)
    return out


# Episode infobox parser

INFOBOX = re.compile(r"\{\{Episode infobox(.+?)\n\}\}", re.S | re.I)


def parse_infobox(wikitext: str) -> dict:
    m = INFOBOX.search(wikitext)
    fields: dict[str, str] = {}
    if not m:
        return fields
    body = m.group(1)
    # split params on `\n| key =` boundaries; templates inside values are simple
    # enough on these pages that this is reliable
    for part in re.split(r"\n\|\s*", body):
        if "=" not in part:
            continue
        k, _, v = part.partition("=")
        fields[k.strip().lower()] = v.strip()
    return fields


# Driver

def episode_title_from_transcript(transcript_title: str) -> str:
    return transcript_title.split(":", 1)[1].strip()


def display_title(raw: str) -> str:
    """Strip Fandom disambiguation suffixes like ' (episode)'."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()


def build_episode_record(transcript_title: str) -> dict | None:
    print(f"  · {transcript_title}")
    wt = fetch_wikitext(transcript_title)
    if wt is None:
        print(f"    (skipped: no wikitext)", file=sys.stderr)
        return None

    raw_title = episode_title_from_transcript(transcript_title)
    title = display_title(raw_title)
    cast = parse_cast(wt)
    locations = parse_locations(wt)
    dialogue = parse_dialogue(wt)

    # the episode page itself uses the raw (possibly disambiguated) title
    info_wt = fetch_wikitext(raw_title) or ""
    info = parse_infobox(info_wt)

    book_raw = info.get("book", "").strip()
    book_num = BOOK_NAME_TO_NUM.get(book_raw.lower())

    # Production codes (e.g. "216") encode book*100 + episode. Some pages put
    # an overall index in the `episode` field instead of the per-book number,
    # so prefer prod when we can parse it.
    prod_raw = info.get("prod", "").strip()
    ep_num: int | None = None
    prod_match = re.fullmatch(r"(\d)(\d{2})", prod_raw)
    if prod_match:
        prod_book = int(prod_match.group(1))
        prod_ep = int(prod_match.group(2))
        if book_num is None:
            book_num = prod_book
        ep_num = prod_ep
    else:
        try:
            ep_num = int(info.get("episode", "").strip())
        except ValueError:
            ep_num = None

    overall = None
    if book_num is not None and ep_num is not None:
        overall = sum(EPISODES_PER_BOOK[b] for b in range(1, book_num)) + ep_num

    return {
        "id": f"b{book_num}e{ep_num}" if (book_num and ep_num) else title,
        "title": title,
        "book": book_num,
        "book_name": book_raw or None,
        "episode": ep_num,
        "overall": overall,
        "air_date": info.get("date") or None,
        "production_code": info.get("prod") or None,
        "writer": clean_text(info.get("writer", "")) or None,
        "director": clean_text(info.get("director", "")) or None,
        "cast": cast,
        "locations": locations,
        "dialogue_line_count": len(dialogue),
        "dialogue": dialogue,
    }


def main() -> int:
    print("Listing transcript pages…")
    titles = list_transcript_pages()
    print(f"  found {len(titles)} transcripts")

    episodes: list[dict] = []
    for title in titles:
        rec = build_episode_record(title)
        if rec is None:
            continue
        episodes.append(rec)
        time.sleep(0.4)  # be polite to the API

    # sort by overall episode order; unknown ordering goes to end
    episodes.sort(key=lambda r: (r["overall"] is None, r["overall"] or 0))

    # write episodes.json (without dialogue, which is huge)
    episodes_meta = []
    for r in episodes:
        meta = {k: v for k, v in r.items() if k != "dialogue"}
        episodes_meta.append(meta)
    (DATA / "episodes.json").write_text(json.dumps(episodes_meta, indent=2))

    # write scripts.csv (one row per dialogue line)
    with (DATA / "scripts.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            ["episode_id", "book", "episode", "overall", "line_index",
             "speaker", "is_narration", "text"]
        )
        for r in episodes:
            for i, line in enumerate(r["dialogue"]):
                w.writerow(
                    [
                        r["id"],
                        r["book"] or "",
                        r["episode"] or "",
                        r["overall"] or "",
                        i,
                        line["speaker"],
                        int(line["is_narration"]),
                        line["text"],
                    ]
                )

    # write ATLA-episodes-scripts.csv in the original Kaggle schema so it's
    # a drop-in replacement for the file every feature branch already loads.
    # Columns:  Character, script, ep_number, Book, total_number
    with (DATA / "ATLA-episodes-scripts.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Character", "script", "ep_number", "Book", "total_number"])
        for r in episodes:
            for line in r["dialogue"]:
                w.writerow(
                    [
                        line["speaker"],
                        line["text"],
                        r["episode"] or "",
                        r["book"] or "",
                        r["overall"] or "",
                    ]
                )

    print(f"\nWrote {DATA / 'episodes.json'} ({len(episodes_meta)} episodes)")
    total_lines = sum(len(r["dialogue"]) for r in episodes)
    print(f"Wrote {DATA / 'scripts.csv'} ({total_lines} dialogue rows)")
    print(f"Wrote {DATA / 'ATLA-episodes-scripts.csv'} ({total_lines} dialogue rows, Kaggle schema)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
