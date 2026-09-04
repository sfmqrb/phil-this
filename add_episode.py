#!/usr/bin/env python3
"""
Add new Philosophize This! episodes to the site, end to end.

For each episode this
  1. scrapes the transcript from philosophizethis.org (via main.py),
  2. looks up the episode's title and page on the podcast listing,
  3. asks Claude for the learn panel (summary, key ideas, terms), a 20-question
     quiz with verbatim transcript anchors, and a title/teaser,
  4. writes app/learn/<id>.json and appends the quiz to app/data.js, the
     archive entry to app/episode-index.js and the id to a learning path in
     app/paths.js, and bumps the transcript count in app/index.html,
  5. renders the word cloud and the two audio files,
  6. runs node app/tests/validate.js.

Nothing is committed; review `git status`, then commit and push to deploy.

Setup (the same venv that generate_audio.py uses):
    python3 -m venv .venv-tts
    .venv-tts/bin/pip install kokoro soundfile espeakng-loader anthropic requests beautifulsoup4 wordcloud
    ffmpeg and node on PATH

Claude access, one of:
    export ANTHROPIC_API_KEY=...        (or `ant auth login`)  -> --engine api
    the `claude` CLI signed in          (Claude Code)          -> --engine cli
`--engine auto` (the default) uses the API when credentials are set, else the CLI.

Usage (from the repo root):
    .venv-tts/bin/python add_episode.py              # every episode on the site that isn't here yet
    .venv-tts/bin/python add_episode.py 246 247      # specific episodes
    .venv-tts/bin/python add_episode.py 246 --path philosophy-literature
    .venv-tts/bin/python add_episode.py 246 --from-json draft.json --skip-audio
    .venv-tts/bin/python add_episode.py --check      # just report what's new and exit
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
TRANSCRIPTS = ROOT / "transcripts"
LEARN = APP / "learn"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(APP))

import main as scraper  # noqa: E402  (the transcript scraper at the repo root)

PODCAST_URL = scraper.BASE + "/podcast"
DEFAULT_MODEL = "claude-opus-5"
CLI_MODEL = "opus"
QUESTIONS = 20

# ---------- discovery ----------


def known_ids() -> set[int]:
    return {int(p.stem) for p in LEARN.glob("*.json") if p.stem.isdigit()}


def site_index(fetcher) -> list:
    entries = scraper.parse_index(fetcher.get(scraper.INDEX_URL))
    return [e for e in entries if e.episode is not None]


def podcast_meta(fetcher, episode: int) -> dict:
    """Title and page URL of an episode from the (paginated) podcast listing."""
    url = PODCAST_URL
    seen = set()
    for _ in range(40):  # ~20 posts a page; the whole catalogue is < 20 pages
        html = fetcher.get(url)
        for m in re.finditer(r'<h1 class="blog-title">\s*<a href="([^"]+)"[^>]*>\s*(.*?)\s*</a>', html, re.S):
            href, title = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            num = re.search(r"Episode\s*#\s*(\d+)", title, re.I)
            if num and int(num.group(1)) == episode:
                return {"url": scraper.BASE + href, "title": title}
        nxt = re.search(r'href="(/podcast\?offset=\d+)"', html)
        if not nxt or nxt.group(1) in seen:
            break
        seen.add(nxt.group(1))
        url = scraper.BASE + nxt.group(1)
    return {}


def label_from_title(title: str, episode: int) -> str:
    """'Episode #245 … After Virtue - Alasdair Macintyre' -> 'After Virtue (Alasdair Macintyre)'."""
    body = re.sub(r"^Episode\s*#?\s*\d+\s*[…\-:.]*\s*", "", title, flags=re.I).strip()
    if not body:
        return f"Episode {episode}"
    if " - " in body:
        work, author = body.rsplit(" - ", 1)
        return f"{work.strip()} ({author.strip()})"
    return body


# ---------- transcript ----------


def transcript_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    return text.split("\n---\n", 1)[1].strip() if "\n---\n" in text else text


def scrape_transcript(fetcher, entry) -> Path:
    result = scraper.scrape_one(fetcher, TRANSCRIPTS, entry, "md", overwrite=False)
    if result.errors:
        raise RuntimeError(f"scrape failed: {result.errors[0]}")
    result.path = str(Path(result.path).resolve().relative_to(ROOT))  # index.json keeps repo-relative paths
    index_file = TRANSCRIPTS / "index.json"
    index = json.loads(index_file.read_text(encoding="utf-8")) if index_file.exists() else []
    index = [e for e in index if e.get("episode") != result.episode] + [scraper.asdict(result)]
    index.sort(key=lambda e: (e.get("episode") is None, e.get("episode") or 0))
    index_file.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    return ROOT / result.path


# ---------- Claude ----------

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "teaser": {"type": "string"},
        "argument": {"type": "string"},
        "keyIdeas": {"type": "array", "items": {"type": "string"}},
        "terms": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"term": {"type": "string"}, "def": {"type": "string"}},
                "required": ["term", "def"],
                "additionalProperties": False,
            },
        },
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "correct": {"type": "integer"},
                    "note": {"type": "string"},
                    "anchor": {"type": "string"},
                },
                "required": ["q", "options", "correct", "note", "anchor"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "teaser", "argument", "keyIdeas", "terms", "questions"],
    "additionalProperties": False,
}


def example_block() -> str:
    """A slice of an existing episode so the model matches the house style."""
    quizzes = {e["id"]: e for e in parse_js_array((APP / "data.js").read_text(encoding="utf-8"))}
    ex_id = max(i for i in known_ids() if i in quizzes)
    ex_learn = json.loads((LEARN / f"{ex_id}.json").read_text(encoding="utf-8"))
    ex_quiz = quizzes[ex_id]
    sample = {
        "title": ex_quiz["title"],
        "teaser": ex_quiz["teaser"],
        "argument": ex_learn["argument"],
        "keyIdeas": ex_learn["keyIdeas"][:2],
        "terms": ex_learn["terms"][:2],
        "questions": [
            dict(q, anchor=ex_learn["anchors"][i]) for i, q in enumerate(ex_quiz["questions"][:2])
        ],
    }
    return f"episode {ex_id}:\n" + json.dumps(sample, indent=2, ensure_ascii=False)


def build_prompt(episode: int, title: str, transcript: str) -> tuple[str, str]:
    system = f"""You write study material for Philosophitor, a companion site to the podcast Philosophize This! by Stephen West. Given one episode's transcript you produce a JSON object with these fields:

- "title": "<Thinker or work>: <the episode's angle>", e.g. "Shakespeare: Hamlet and the Knowledge That Kills Action". Title case, no episode number.
- "teaser": one sentence, under 30 words, that says what the episode argues, not what it "explores".
- "argument": one paragraph of 130-200 words reconstructing the episode's argument in order: the question it opens with, the moves it makes, where it lands. Name the thinkers. Plain prose, no bullet points, no "the episode explores".
- "keyIdeas": 5 to 7 items, each one complete sentence (occasionally two) stating a claim the episode makes, specific enough to be wrong.
- "terms": 4 to 6 items, "term" is a name or concept from the episode, "def" is one sentence explaining it as the episode uses it.
- "questions": exactly {QUESTIONS} multiple-choice questions that test whether the listener understood the argument, not trivia. Each has:
  - "q": the question, self-contained;
  - "options": exactly 4 distinct answers of similar length and register, one right and three plausible wrong ones (common misreadings, positions the episode argues against, or claims from adjacent thinkers);
  - "correct": the index (0-3) of the right option. Spread correct answers evenly: about 5 questions for each index, and never more than 2 in a row on the same index;
  - "note": 2-4 sentences explaining why the right answer is right and why the tempting wrong ones are wrong. Refer to wrong options by their content, never by position ("the third option");
  - "anchor": a sentence or clause copied VERBATIM from the transcript (60-250 characters, keep the original punctuation and capitalization) that supports the right answer. Do not paraphrase; the site highlights this exact text in the transcript.

Write with a light touch, in the register of a sharp friend who listened carefully. Avoid the words "delve", "explore", "nuanced", "tapestry". Use straight quotes inside strings and no em dashes. Output only the JSON object.

Here is a trimmed example of the expected shape and voice, from {example_block()}"""
    user = f"Episode {episode}: {title or 'title unknown'}\n\nTRANSCRIPT:\n\n{transcript}"
    return system, user


def api_available() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    profile = Path.home() / ".config" / "anthropic"
    return profile.exists() and any(profile.iterdir())


def ask_api(system: str, user: str, model: str) -> dict:
    import anthropic

    client = anthropic.Anthropic()
    print(f"  asking {model} via the API (streaming)")
    with client.messages.stream(
        model=model,
        max_tokens=64000,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    ) as stream:
        message = stream.get_final_message()
    if message.stop_reason == "refusal":
        raise RuntimeError("the model declined this transcript")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("the response was cut off; raise max_tokens")
    text = next(b.text for b in message.content if b.type == "text")
    return json.loads(text)


def ask_cli(system: str, user: str, model: str) -> dict:
    if not shutil.which("claude"):
        raise RuntimeError("the `claude` CLI is not on PATH")
    print(f"  asking Claude via the `claude` CLI (model {model})")
    schema = json.dumps(SCHEMA)
    prompt = f"{system}\n\nThe JSON must validate against this schema:\n{schema}\n\n{user}"
    proc = subprocess.run(
        ["claude", "-p", "--output-format", "json", "--model", model, "--no-session-persistence"],
        input=prompt, capture_output=True, text=True, timeout=1800,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude CLI failed: {proc.stderr.strip()[:500]}")
    envelope = json.loads(proc.stdout)
    result = envelope.get("result") or ""
    if envelope.get("is_error"):
        raise RuntimeError(f"claude CLI error: {result[:500]}")
    result = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip())
    start, end = result.find("{"), result.rfind("}")
    return json.loads(result[start:end + 1])


def ask_claude(engine: str, model: str | None, system: str, user: str) -> dict:
    if engine == "auto":
        engine = "api" if api_available() else "cli"
    if engine == "api":
        return ask_api(system, user, model or DEFAULT_MODEL)
    return ask_cli(system, user, model or CLI_MODEL)


# ---------- checking what came back ----------

POSITION_WORDS = re.compile(r"\b(first|second|third|fourth|last) (option|answer|choice)\b", re.I)


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')).strip()


def fix_anchor(anchor: str, transcript: str, sentences: list[str]) -> str:
    """Return the anchor as it appears in the transcript, or '' if it isn't there."""
    anchor = (anchor or "").strip()
    if not anchor:
        return ""
    if anchor in transcript:
        return anchor
    # The model may have straightened quotes or collapsed the host's ellipses;
    # look for the same words with the transcript's own punctuation.
    target = normalize(anchor).lower()
    for s in sentences:
        if target in normalize(s).lower():
            return s
    best = difflib.get_close_matches(anchor, sentences, n=1, cutoff=0.8)
    return best[0] if best else ""


def split_sentences(transcript: str) -> list[str]:
    parts = re.split(r"(?<=[.!?…])\s+(?=[A-Z\"'“‘(])", transcript)
    return [p.strip() for p in parts if 20 <= len(p.strip()) <= 400]


def check_and_fix(content: dict, transcript: str, seed: int) -> dict:
    problems = []
    if not content.get("title") or not content.get("teaser") or len(content.get("argument", "")) < 300:
        problems.append("title/teaser/argument missing or too short")
    if not 4 <= len(content.get("keyIdeas", [])) <= 8:
        problems.append(f"expected 5-7 key ideas, got {len(content.get('keyIdeas', []))}")
    if not 3 <= len(content.get("terms", [])) <= 7:
        problems.append(f"expected 4-6 terms, got {len(content.get('terms', []))}")
    qs = content.get("questions", [])
    if len(qs) != QUESTIONS:
        problems.append(f"expected {QUESTIONS} questions, got {len(qs)}")
    sentences = split_sentences(transcript)
    missing_anchors = 0
    for n, q in enumerate(qs, 1):
        opts = q.get("options", [])
        if len(opts) != 4 or len({o.strip().lower() for o in opts}) != 4:
            problems.append(f"question {n}: needs 4 distinct options")
        if not isinstance(q.get("correct"), int) or not 0 <= q["correct"] <= 3:
            problems.append(f"question {n}: bad correct index")
        if not q.get("note"):
            problems.append(f"question {n}: missing note")
        q["anchor"] = fix_anchor(q.get("anchor", ""), transcript, sentences)
        if not q["anchor"]:
            missing_anchors += 1
    if problems:
        raise RuntimeError("Claude's output failed checks: " + "; ".join(problems))
    if missing_anchors:
        print(f"  ! {missing_anchors} anchor(s) were not found verbatim in the transcript and were dropped")

    # The validator rejects a quiz whose correct answers pile onto one letter.
    # Rebalance by swapping options, but only where the note doesn't refer to
    # options by position (the prompt forbids it, this is belt and braces).
    counts = [sum(1 for q in qs if q["correct"] == i) for i in range(4)]
    if max(counts) > QUESTIONS // 4 + 3:
        rng = random.Random(seed)
        targets = [i % 4 for i in range(len(qs))]
        rng.shuffle(targets)
        for q, target in zip(qs, targets):
            if q["correct"] != target and not POSITION_WORDS.search(q["note"]):
                opts = q["options"]
                opts[q["correct"]], opts[target] = opts[target], opts[q["correct"]]
                q["correct"] = target
        counts = [sum(1 for q in qs if q["correct"] == i) for i in range(4)]
        print(f"  rebalanced correct answers across A/B/C/D: {counts}")
    return content


# ---------- writing the app files ----------


def parse_js_array(js: str) -> list:
    """The data files are `const NAME = [ ...json... ];` plus a module.exports line."""
    start, end = js.index("= [") + 2, js.rindex("];") + 1
    return json.loads(js[start:end])


def append_js_entry(path: Path, entry: dict) -> None:
    js = path.read_text(encoding="utf-8")
    end = js.rindex("\n];")
    body = json.dumps(entry, indent=2, ensure_ascii=False)
    body = "\n".join("  " + line for line in body.splitlines())
    path.write_text(js[:end] + ",\n" + body + js[end:], encoding="utf-8")


def add_to_path(episode: int, key: str | None) -> str:
    path = APP / "paths.js"
    js = path.read_text(encoding="utf-8")
    keys = re.findall(r'key:\s*"([^"]+)"', js)
    if not keys:
        raise RuntimeError("no learning paths found in paths.js")
    key = key or keys[-1]
    if key not in keys:
        raise RuntimeError(f"no learning path with key {key!r}; known: {', '.join(keys)}")
    at = js.index(f'key: "{key}"')
    arr_start = js.index("episodes: [", at) + len("episodes: [")
    arr_end = js.index("]", arr_start)
    inner = js[arr_start:arr_end]
    trailing = re.search(r"\s*$", inner).group(0)
    new_inner = inner.rstrip() + f", {episode}" + trailing
    js = js[:arr_start] + new_inner + js[arr_end:]
    js = re.sub(r"\(1\.\.\d+\)", f"(1..{episode})", js, count=1)
    path.write_text(js, encoding="utf-8")
    return key


def bump_transcript_count(total: int) -> None:
    path = APP / "index.html"
    html = path.read_text(encoding="utf-8")
    html = re.sub(r"all \d+ transcripts", f"all {total} transcripts", html)
    path.write_text(html, encoding="utf-8")


def write_outputs(episode: int, meta: dict, transcript_path: Path, content: dict, path_key: str | None) -> None:
    learn = {
        "id": episode,
        "argument": content["argument"],
        "keyIdeas": content["keyIdeas"],
        "terms": content["terms"],
        "anchors": [q["anchor"] for q in content["questions"]],
    }
    (LEARN / f"{episode}.json").write_text(json.dumps(learn, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    quiz = {
        "id": episode,
        "transcriptFile": f"../transcripts/{transcript_path.name}",
        "wordcloud": f"wordclouds/{episode}.png",
        "title": content["title"],
        "teaser": content["teaser"],
        "questions": [
            {"q": q["q"], "options": q["options"], "correct": q["correct"], "note": q["note"]}
            for q in content["questions"]
        ],
    }
    append_js_entry(APP / "data.js", quiz)

    index_entry = {
        "id": episode,
        "url": meta.get("url") or f"{scraper.BASE}/transcript/episode-{episode}-transcript",
        "file": transcript_path.name,
        "label": label_from_title(meta.get("title", ""), episode),
    }
    append_js_entry(APP / "episode-index.js", index_entry)

    key = add_to_path(episode, path_key)
    total = len(parse_js_array((APP / "episode-index.js").read_text(encoding="utf-8")))
    bump_transcript_count(total)
    print(f"  wrote learn/{episode}.json, data.js, episode-index.js (label {index_entry['label']!r}), paths.js ({key}), index.html ({total} transcripts)")


# ---------- assets ----------


def render_wordcloud(episode: int, transcript_path: Path) -> None:
    try:
        from generate_wordclouds import make_cloud
    except ImportError as e:
        print(f"  ! word cloud skipped, {e} (pip install wordcloud)")
        return
    out = make_cloud(episode, transcript_path)
    print(f"  wrote {out.relative_to(ROOT)}")


def render_audio(episode: int) -> None:
    cmd = [sys.executable, str(APP / "generate_audio.py"), "--ids", str(episode)]
    print("  " + " ".join(cmd[1:]))
    proc = subprocess.run(cmd, cwd=ROOT)
    if proc.returncode != 0:
        print("  ! audio generation failed; rerun app/generate_audio.py --ids", episode)


def validate() -> bool:
    if not shutil.which("node"):
        print("! node not found, skipping app/tests/validate.js")
        return True
    proc = subprocess.run(["node", str(APP / "tests" / "validate.js")], cwd=ROOT, capture_output=True, text=True)
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-3:]
    print("\n".join("  " + line for line in tail))
    return proc.returncode == 0


# ---------- main ----------


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episodes", type=int, nargs="*", help="episode numbers; default: every new one on the site")
    ap.add_argument("--check", action="store_true", help="only report which episodes are new")
    ap.add_argument("--path", help="learning-path key in app/paths.js (default: the last path)")
    ap.add_argument("--engine", choices=["auto", "api", "cli"], default="auto")
    ap.add_argument("--model", help=f"model id (API default {DEFAULT_MODEL}, CLI default {CLI_MODEL})")
    ap.add_argument("--from-json", type=Path, help="use this Claude output instead of asking (single episode)")
    ap.add_argument("--save-json", type=Path, help="directory to save Claude's raw output per episode")
    ap.add_argument("--skip-audio", action="store_true")
    ap.add_argument("--skip-wordcloud", action="store_true")
    ap.add_argument("--ignore-robots", action="store_true")
    args = ap.parse_args()

    fetcher = scraper.Fetcher(delay=1.0)
    if not args.ignore_robots and not scraper.check_robots(fetcher):
        print("robots.txt disallows /transcript/; pass --ignore-robots to override.", file=sys.stderr)
        return 2

    have = known_ids()
    index = {e.episode: e for e in site_index(fetcher)}
    new = sorted(n for n in index if n not in have)
    print(f"site lists {len(index)} transcripts; {len(have)} episodes built here; new: {new or 'none'}")
    if args.check:
        return 0

    wanted = args.episodes or new
    if not wanted:
        return 0
    if args.from_json and len(wanted) != 1:
        print("--from-json applies to exactly one episode", file=sys.stderr)
        return 2

    failures = []
    for episode in wanted:
        print(f"\n== episode {episode} ==")
        try:
            if episode in have:
                raise RuntimeError(f"already built (app/learn/{episode}.json exists); remove its files first to redo it")
            if episode not in index:
                raise RuntimeError("no transcript for it on the site yet")

            transcript_path = scrape_transcript(fetcher, index[episode])
            transcript = transcript_body(transcript_path)
            print(f"  transcript: {transcript_path.relative_to(ROOT)} ({len(transcript)} chars)")

            meta = podcast_meta(fetcher, episode)
            print(f"  podcast page: {meta.get('title') or 'not found on the listing'}")

            if args.from_json:
                content = json.loads(args.from_json.read_text(encoding="utf-8"))
            else:
                system, user = build_prompt(episode, meta.get("title", ""), transcript)
                content = ask_claude(args.engine, args.model, system, user)
            if args.save_json:
                args.save_json.mkdir(parents=True, exist_ok=True)
                (args.save_json / f"{episode}.json").write_text(json.dumps(content, indent=2, ensure_ascii=False), encoding="utf-8")
            content = check_and_fix(content, transcript, seed=episode)

            write_outputs(episode, meta, transcript_path, content, args.path)
            if not args.skip_wordcloud:
                render_wordcloud(episode, transcript_path)
            if not args.skip_audio:
                render_audio(episode)
            have.add(episode)
        except Exception as e:  # keep going with the next episode
            failures.append((episode, str(e)))
            print(f"  FAILED: {e}")

    print("\nvalidating…")
    ok = validate()
    if failures:
        print("\nfailed:", "; ".join(f"{n} ({err})" for n, err in failures))
    if ok and not failures:
        print("\nDone. Review with `git status` / `git diff --stat`, then commit and push to deploy.")
    return 0 if ok and not failures else 1


if __name__ == "__main__":
    sys.exit(main())
