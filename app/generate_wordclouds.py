#!/usr/bin/env python3
"""
Generate a top-20-word word cloud PNG for each episode transcript listed in
episode-transcripts.json (produced by dumping data.js's id/transcriptFile pairs).

Usage:
    node -e "const Q=require('./data.js'); require('fs').writeFileSync('/tmp/episode-transcripts.json', JSON.stringify(Q.map(e=>({id:e.id, transcriptFile:e.transcriptFile})),null,2));"
    python3 generate_wordclouds.py
"""
import json
import random
import re
from pathlib import Path

from wordcloud import WordCloud, STOPWORDS

APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent
MAPPING_FILE = Path("/tmp/episode-transcripts.json")
OUT_DIR = APP_DIR / "wordclouds"
OUT_DIR.mkdir(exist_ok=True)

# Palette pulled from style.css (teal accent + warm brick + ink), picked so
# every word reads with reasonable contrast on both a light and dark paper.
PALETTE = ["#2f5d50", "#3f7566", "#4f8a79", "#7fb3a0", "#b34632", "#8c5c4a", "#5b5a54"]

# Generic English stopwords plus filler/host-specific words that would
# otherwise dominate every single cloud regardless of the episode's content.
EXTRA_STOPWORDS = {
    "yeah", "gonna", "kinda", "sorta", "um", "uh", "okay", "ok", "right",
    "really", "think", "thinking", "thought", "going", "gone", "goes", "went",
    "know", "knows", "knew", "thing", "things", "said", "says", "saying",
    "say", "one", "like", "just", "get", "gets", "getting", "got", "well",
    "much", "many", "lot", "lots", "people", "today", "episode", "episodes",
    "philosophize", "podcast", "west", "stephen", "listen", "listening",
    "thank", "thanks", "guys", "gonna", "actually", "basically", "literally",
    "kind", "sort", "way", "ways", "make", "makes", "made", "making", "want",
    "wants", "wanted", "come", "comes", "came", "coming", "look", "looks",
    "looked", "looking", "see", "sees", "saw", "seeing", "seen", "let", "lets",
    "ll", "ve", "re", "ain", "gotta", "maybe", "probably", "little", "bit",
    "good", "bad", "big", "long", "new", "old", "first", "last", "next",
    "back", "still", "even", "also", "us", "put", "give", "given", "gives",
    "take", "takes", "taking", "took", "talk", "talking", "talked", "talks",
    "point", "points", "sense", "world", "life", "time", "times", "day",
    "days", "year", "years", "man", "men", "person", "someone", "something",
    "anything", "everything", "nothing", "everyone", "anyone",
}

STOPWORDS_SET = set(w.lower() for w in STOPWORDS) | EXTRA_STOPWORDS

TITLE_LINE_RE = re.compile(r"^#\s*.*$")
META_LINE_RE = re.compile(r"^(Episode|Source|Date):", re.IGNORECASE)


def load_transcript_text(path: Path) -> str:
    lines = path.read_text(encoding="utf-8").splitlines()
    body_lines = []
    past_header = False
    for line in lines:
        stripped = line.strip()
        if not past_header:
            if stripped == "---":
                past_header = True
            continue
        body_lines.append(line)
    return "\n".join(body_lines) if body_lines else path.read_text(encoding="utf-8")


def color_func(word, font_size, position, orientation, random_state=None, **kwargs):
    return random.choice(PALETTE)


def make_cloud(episode_id: int, transcript_path: Path) -> Path:
    text = load_transcript_text(transcript_path)
    wc = WordCloud(
        width=900,
        height=420,
        max_words=20,
        mode="RGBA",
        background_color=None,
        stopwords=STOPWORDS_SET,
        collocations=False,
        prefer_horizontal=0.92,
        min_word_length=3,
        relative_scaling=0.55,
        random_state=42,
    ).generate(text)
    wc.recolor(color_func=color_func, random_state=42)
    out_path = OUT_DIR / f"{episode_id}.png"
    wc.to_file(str(out_path))
    return out_path


def main():
    mapping = json.loads(MAPPING_FILE.read_text(encoding="utf-8"))
    made = 0
    for entry in mapping:
        episode_id = entry["id"]
        transcript_file = entry["transcriptFile"]
        transcript_path = (APP_DIR / transcript_file).resolve()
        if not transcript_path.exists():
            print(f"  ! missing transcript for episode {episode_id}: {transcript_path}")
            continue
        out_path = make_cloud(episode_id, transcript_path)
        made += 1
        print(f"  #{episode_id} -> {out_path.relative_to(APP_DIR)}")
    print(f"\nDone: {made} word clouds written to {OUT_DIR}")


if __name__ == "__main__":
    main()
