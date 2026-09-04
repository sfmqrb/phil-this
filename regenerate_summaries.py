#!/usr/bin/env python3
"""
Rewrite the summary ("argument") of one or more episodes with Claude Opus,
following the house style in docs/summary-style.md.

Only app/learn/<id>.json changes (the "argument" field). The summary audio
depends on it, so rerun `app/generate_audio.py --force --ids <ids>` afterwards.

Claude access, one of:
    export ANTHROPIC_API_KEY=...   (or `ant auth login`)   -> --engine api
    the `claude` CLI signed in      (Claude Code)           -> --engine cli
`--engine auto` (the default) uses the API when credentials are set, else the CLI.

Usage (from the repo root):
    .venv-tts/bin/python regenerate_summaries.py 1 2 3            # rewrite these
    .venv-tts/bin/python regenerate_summaries.py 1-10 --preview   # print, don't save
    .venv-tts/bin/python regenerate_summaries.py 4 --style docs/summary-style.md --workers 5
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
LEARN = APP / "learn"
TRANSCRIPTS = ROOT / "transcripts"
STYLE = ROOT / "docs" / "summary-style.md"
API_MODEL = "claude-opus-5"
CLI_MODEL = "opus"


def parse_ids(items: list[str]) -> list[int]:
    ids: list[int] = []
    for item in items:
        if "-" in item:
            a, b = item.split("-", 1)
            ids.extend(range(int(a), int(b) + 1))
        else:
            ids.append(int(item))
    return sorted(set(ids))


def style_brief(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    return text.split("\n---\n", 1)[1].strip() if "\n---\n" in text else text.strip()


def transcript_for(episode: int) -> tuple[str, str]:
    """(title, body) from the transcript file listed in episode-index.js."""
    index_js = (APP / "episode-index.js").read_text(encoding="utf-8")
    entries = json.loads(index_js[index_js.index("= [") + 2:index_js.rindex("];") + 1])
    entry = next((e for e in entries if e["id"] == episode), None)
    if not entry:
        raise RuntimeError(f"episode {episode} is not in app/episode-index.js")
    text = (TRANSCRIPTS / entry["file"]).read_text(encoding="utf-8")
    body = text.split("\n---\n", 1)[1].strip() if "\n---\n" in text else text
    data_js = (APP / "data.js").read_text(encoding="utf-8")
    m = re.search(r'"id": %d,.*?"title": "([^"]*)"' % episode, data_js, re.S)
    title = m.group(1) if m else entry.get("label", f"Episode {episode}")
    return title, body


def api_available() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    profile = Path.home() / ".config" / "anthropic"
    return profile.exists() and any(profile.iterdir())


def ask_api(system: str, user: str, model: str) -> str:
    import anthropic

    client = anthropic.Anthropic()
    with client.messages.stream(
        model=model, max_tokens=16000, system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        message = stream.get_final_message()
    if message.stop_reason == "refusal":
        raise RuntimeError("the model declined this transcript")
    return "".join(b.text for b in message.content if b.type == "text").strip()


def ask_cli(system: str, user: str, model: str) -> str:
    if not shutil.which("claude"):
        raise RuntimeError("the `claude` CLI is not on PATH")
    proc = subprocess.run(
        ["claude", "-p", "--output-format", "json", "--model", model, "--no-session-persistence"],
        input=system + "\n\n" + user, capture_output=True, text=True, timeout=1800,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI failed: {proc.stderr.strip()[:500]}")
    envelope = json.loads(proc.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude CLI error: {str(envelope.get('result'))[:500]}")
    return str(envelope.get("result") or "").strip()


def tidy(text: str) -> str:
    """Enforce the few mechanical rules in the brief that models still slip on."""
    text = text.replace("—", ", ").replace("–", ", ").replace(" ,", ",")
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = re.sub(r",\s*,", ",", text)
    return re.sub(r"[ \t]+\n", "\n", text).strip()


def write_summary(episode: int, summary: str) -> None:
    path = LEARN / f"{episode}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["argument"] = summary
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episodes", nargs="+", help="ids or ranges, e.g. 4 7 10-15")
    ap.add_argument("--style", type=Path, default=STYLE, help="brief to send (default docs/summary-style.md)")
    ap.add_argument("--engine", choices=["auto", "api", "cli"], default="auto")
    ap.add_argument("--model", help=f"model id (API default {API_MODEL}, CLI default {CLI_MODEL})")
    ap.add_argument("--workers", type=int, default=4, help="parallel requests")
    ap.add_argument("--preview", action="store_true", help="print the summaries instead of saving them")
    ap.add_argument("--save-dir", type=Path, help="also write each summary as <id>.txt here")
    args = ap.parse_args()

    engine = args.engine
    if engine == "auto":
        engine = "api" if api_available() else "cli"
    model = args.model or (API_MODEL if engine == "api" else CLI_MODEL)
    brief = style_brief(args.style)
    ids = parse_ids(args.episodes)
    print(f"rewriting {len(ids)} summaries with {model} via {engine}, style {args.style.relative_to(ROOT)}")

    def one(episode: int) -> tuple[int, str | None, str]:
        try:
            title, body = transcript_for(episode)
            user = f"Episode {episode}: {title}\n\nTRANSCRIPT:\n\n{body}"
            ask = ask_api if engine == "api" else ask_cli
            return episode, tidy(ask(brief, user, model)), ""
        except Exception as e:  # report per episode, keep going
            return episode, None, str(e)

    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for episode, summary, err in pool.map(one, ids):
            if summary is None:
                failures.append((episode, err))
                print(f"  {episode}: FAILED {err}")
                continue
            words = len(summary.split())
            if args.save_dir:
                args.save_dir.mkdir(parents=True, exist_ok=True)
                (args.save_dir / f"{episode}.txt").write_text(summary + "\n", encoding="utf-8")
            if args.preview:
                print(f"\n===== episode {episode} ({words} words)\n{summary}\n")
            else:
                write_summary(episode, summary)
                print(f"  {episode}: {words} words -> app/learn/{episode}.json")

    if failures:
        print("failed:", ", ".join(f"{i} ({e})" for i, e in failures))
        return 1
    if not args.preview:
        print("\nNow refresh the audio:  .venv-tts/bin/python app/generate_audio.py --force --ids " + " ".join(map(str, ids)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
