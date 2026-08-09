#!/usr/bin/env python3
"""
Scrape transcripts from philosophizethis.org.

The index at /transcripts lists every transcript on one page (no pagination),
grouped by year. Each entry links to /transcript/<slug>, a Squarespace blog
post whose body lives in `.entry-content`.

Usage:
    python scrape_philosophize_this.py --out ./transcripts
    python scrape_philosophize_this.py --out ./transcripts --format md --workers 4
    python scrape_philosophize_this.py --list-only
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import threading
import urllib.robotparser as robotparser
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict, field
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://www.philosophizethis.org"
INDEX_URL = f"{BASE}/transcripts"
USER_AGENT = "philosophize-this-transcript-archiver/1.0 (personal archive; contact: you@example.com)"

# Squarespace themes vary; try these in order and take the first non-empty match.
BODY_SELECTORS = [
    "div.entry-content",
    "div.blog-item-content-wrapper .sqs-block-content",
    "article .sqs-block-content",
    "main .sqs-block-content",
]

EPISODE_RE = re.compile(r"episode\s*#?\s*(\d+)", re.IGNORECASE)
# Joining inline tags with a space leaves gaps before punctuation and inside quotes.
SPACE_BEFORE_PUNCT = re.compile(r"\s+([,.;:!?%)\]}])")
SPACE_AFTER_OPEN = re.compile(r"([(\[{$])\s+")


def clean(text: str) -> str:
    text = " ".join(text.split())
    text = SPACE_BEFORE_PUNCT.sub(r"\1", text)
    text = SPACE_AFTER_OPEN.sub(r"\1", text)
    return text.replace(" ’", "’").replace("“ ", "“").replace(" ”", "”")


@dataclass
class Entry:
    url: str
    title: str
    date: str = ""
    episode: int | None = None
    slug: str = ""
    path: str = ""
    chars: int = 0
    paragraphs: int = 0
    errors: list[str] = field(default_factory=list)


class Fetcher:
    """Session wrapper with retries, backoff, and a shared rate limit."""

    def __init__(self, delay: float = 1.0, retries: int = 4, timeout: float = 30.0):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.delay = delay
        self.retries = retries
        self.timeout = timeout
        self._lock = threading.Lock()
        self._next_ok = 0.0

    def _throttle(self) -> None:
        with self._lock:
            now = time.monotonic()
            wait = self._next_ok - now
            if wait > 0:
                time.sleep(wait)
                now = time.monotonic()
            self._next_ok = now + self.delay

    def get(self, url: str) -> str:
        last = None
        for attempt in range(self.retries):
            self._throttle()
            try:
                resp = self.session.get(url, timeout=self.timeout)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise requests.HTTPError(f"status {resp.status_code}")
                resp.raise_for_status()
                resp.encoding = resp.encoding or "utf-8"
                return resp.text
            except Exception as exc:  # noqa: BLE001
                last = exc
                backoff = (2 ** attempt) + random.uniform(0, 0.5)
                time.sleep(backoff)
        raise RuntimeError(f"failed to fetch {url}: {last}")


def check_robots(fetcher: Fetcher) -> bool:
    rp = robotparser.RobotFileParser()
    rp.set_url(f"{BASE}/robots.txt")
    try:
        rp.parse(fetcher.get(f"{BASE}/robots.txt").splitlines())
    except Exception:
        return True  # no readable robots.txt, proceed with the polite default delay
    return rp.can_fetch(USER_AGENT, f"{BASE}/transcript/")


def parse_index(html: str) -> list[Entry]:
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    entries: list[Entry] = []

    for a in soup.select('a[href*="/transcript/"]'):
        href = a.get("href", "")
        url = urljoin(BASE, href)
        path = urlparse(url).path
        if not path.startswith("/transcript/") or path.rstrip("/") == "/transcript":
            continue
        if url in seen:
            continue
        seen.add(url)

        title = " ".join(a.get_text(" ", strip=True).split())
        date = ""
        holder = a.find_parent(["article", "li", "div"])
        if holder is not None:
            t = holder.find("time")
            if t is not None:
                date = t.get("datetime") or t.get_text(strip=True)

        m = EPISODE_RE.search(title) or EPISODE_RE.search(path)
        entries.append(
            Entry(
                url=url,
                title=title,
                date=date,
                episode=int(m.group(1)) if m else None,
                slug=path.rstrip("/").split("/")[-1],
            )
        )

    entries.sort(key=lambda e: (e.episode is None, e.episode or 0, e.slug))
    return entries


def extract_body(html: str) -> tuple[str, str]:
    """Return (page_title, transcript_text)."""
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find(["h1", "h2"])
    page_title = h1.get_text(" ", strip=True) if h1 else ""

    node = None
    for sel in BODY_SELECTORS:
        candidates = soup.select(sel)
        if candidates:
            node = max(candidates, key=lambda c: len(c.get_text(strip=True)))
            if len(node.get_text(strip=True)) > 200:
                break
    if node is None:
        return page_title, ""

    for junk in node.select("script, style, nav, footer, form, .sqs-block-button, .sqs-block-image"):
        junk.decompose()

    blocks: list[str] = []
    for el in node.find_all(["p", "h2", "h3", "h4", "li", "blockquote"]):
        text = clean(el.get_text(" ", strip=True))
        if text:
            blocks.append(text)
    if not blocks:
        blocks = [
            clean(line)
            for line in node.get_text("\n", strip=True).split("\n")
            if line.strip()
        ]

    # Drop consecutive duplicates that Squarespace sometimes emits from mobile/desktop blocks.
    deduped: list[str] = []
    for b in blocks:
        if not deduped or deduped[-1] != b:
            deduped.append(b)

    return page_title, "\n\n".join(deduped)


def filename_for(entry: Entry, fmt: str) -> str:
    prefix = f"{entry.episode:03d}" if entry.episode is not None else "xxx"
    return f"{prefix}-{entry.slug}.{fmt}"


def write_transcript(out_dir: Path, entry: Entry, title: str, body: str, fmt: str) -> Path:
    dest = out_dir / filename_for(entry, fmt)
    if fmt == "md":
        header = [f"# {title or entry.title}", ""]
        if entry.episode is not None:
            header.append(f"Episode: {entry.episode}")
        if entry.date:
            header.append(f"Date: {entry.date}")
        header += [f"Source: {entry.url}", "", "---", ""]
        dest.write_text("\n".join(header) + body + "\n", encoding="utf-8")
    else:
        header = f"{title or entry.title}\nSource: {entry.url}\n"
        if entry.date:
            header += f"Date: {entry.date}\n"
        dest.write_text(header + "\n" + body + "\n", encoding="utf-8")
    return dest


def scrape_one(fetcher: Fetcher, out_dir: Path, entry: Entry, fmt: str, overwrite: bool) -> Entry:
    dest = out_dir / filename_for(entry, fmt)
    if dest.exists() and not overwrite:
        entry.path = str(dest)
        entry.chars = dest.stat().st_size
        return entry
    try:
        html = fetcher.get(entry.url)
        title, body = extract_body(html)
        if not body:
            entry.errors.append("no transcript body found")
            return entry
        path = write_transcript(out_dir, entry, title, body, fmt)
        entry.path = str(path)
        entry.chars = len(body)
        entry.paragraphs = body.count("\n\n") + 1
    except Exception as exc:  # noqa: BLE001
        entry.errors.append(str(exc))
    return entry


def main() -> int:
    ap = argparse.ArgumentParser(description="Scrape Philosophize This! transcripts.")
    ap.add_argument("--out", default="transcripts", help="output directory")
    ap.add_argument("--format", choices=["txt", "md"], default="md")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    ap.add_argument("--workers", type=int, default=1, help="parallel fetches (keep small)")
    ap.add_argument("--limit", type=int, default=0, help="stop after N transcripts")
    ap.add_argument("--episode", type=int, nargs="*", help="only these episode numbers")
    ap.add_argument("--overwrite", action="store_true", help="refetch pages already saved")
    ap.add_argument("--list-only", action="store_true", help="print the index and exit")
    ap.add_argument("--ignore-robots", action="store_true")
    args = ap.parse_args()

    fetcher = Fetcher(delay=args.delay)

    if not args.ignore_robots and not check_robots(fetcher):
        print("robots.txt disallows /transcript/; pass --ignore-robots to override.", file=sys.stderr)
        return 2

    print(f"fetching index: {INDEX_URL}", file=sys.stderr)
    entries = parse_index(fetcher.get(INDEX_URL))
    print(f"found {len(entries)} transcript links", file=sys.stderr)

    if args.episode:
        wanted = set(args.episode)
        entries = [e for e in entries if e.episode in wanted]
    if args.limit:
        entries = entries[: args.limit]

    if args.list_only:
        for e in entries:
            print(f"{e.episode if e.episode is not None else '---'}\t{e.date}\t{e.url}")
        return 0

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[Entry] = []
    if args.workers > 1:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {
                pool.submit(scrape_one, fetcher, out_dir, e, args.format, args.overwrite): e
                for e in entries
            }
            for i, fut in enumerate(as_completed(futures), 1):
                r = fut.result()
                results.append(r)
                status = "ERROR " + r.errors[0] if r.errors else f"{r.chars} chars"
                print(f"[{i}/{len(entries)}] {r.slug}: {status}", file=sys.stderr)
    else:
        for i, e in enumerate(entries, 1):
            r = scrape_one(fetcher, out_dir, e, args.format, args.overwrite)
            results.append(r)
            status = "ERROR " + r.errors[0] if r.errors else f"{r.chars} chars"
            print(f"[{i}/{len(entries)}] {r.slug}: {status}", file=sys.stderr)

    results.sort(key=lambda e: (e.episode is None, e.episode or 0, e.slug))
    (out_dir / "index.json").write_text(
        json.dumps([asdict(r) for r in results], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    failed = [r for r in results if r.errors]
    print(
        f"\ndone: {len(results) - len(failed)} saved, {len(failed)} failed -> {out_dir}",
        file=sys.stderr,
    )
    for r in failed:
        print(f"  {r.url}: {r.errors[0]}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
