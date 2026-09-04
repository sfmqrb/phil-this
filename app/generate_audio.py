#!/usr/bin/env python3
"""
Read every episode's learn panel aloud with Kokoro-82M, an open-weights neural
TTS model, and save the results under audio/ as Opus (mono, 32 kb/s):

    audio/<id>.ogg        the summary alone (the "argument" field)
    audio/<id>-full.ogg   the whole panel: summary, then key ideas, then terms
    audio/<id>-full.json  section timestamps inside the full file, so the
                          player can jump to "Key ideas" or a single bullet

The site's "Hear this" buttons play these files and only fall back to the
browser's own robotic voice when a file is missing.

Setup (one-off, ~6 GB with the CUDA build of torch):
    python3 -m venv .venv-tts
    .venv-tts/bin/pip install kokoro soundfile espeakng-loader

Usage (from the repo root, ffmpeg must be on PATH):
    .venv-tts/bin/python app/generate_audio.py               # only missing files
    .venv-tts/bin/python app/generate_audio.py --force       # redo everything
    .venv-tts/bin/python app/generate_audio.py --only full   # just the full-panel files
    .venv-tts/bin/python app/generate_audio.py --ids 94 12 --voice am_michael
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf

APP_DIR = Path(__file__).resolve().parent
LEARN_DIR = APP_DIR / "learn"
OUT_DIR = APP_DIR / "audio"
SAMPLE_RATE = 24000  # Kokoro's native rate

# American English, "af_heart" is the highest-rated voice the model ships
# with. Any voice id from hexgrad/Kokoro-82M works here.
DEFAULT_VOICE = "af_heart"

# Silence, in seconds, between sentences / between bullets / between sections.
GAP_SENTENCE = 0.18
GAP_ITEM = 0.5
GAP_SECTION = 0.9


def load_episodes(ids):
    for f in sorted(LEARN_DIR.glob("*.json"), key=lambda p: int(p.stem)):
        if ids and int(f.stem) not in ids:
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        if (data.get("argument") or "").strip():
            yield int(f.stem), data


def silence(seconds):
    return np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32)


def synthesize(pipeline, text, voice, speed):
    """One passage of prose -> float32 samples, with a breath between sentences."""
    chunks = []
    # split_pattern splits on sentence ends so each chunk stays well under the
    # model's 510-token window; the pipeline stitches the pieces back together.
    for _gs, _ps, audio in pipeline(text, voice=voice, speed=speed, split_pattern=r"(?<=[.!?])\s+"):
        chunks.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
        chunks.append(silence(GAP_SENTENCE))
    if not chunks:
        raise RuntimeError("model produced no audio")
    return np.concatenate(chunks)


class Track:
    """Accumulates audio while recording where each section and item starts."""

    def __init__(self):
        self.parts = []
        self.samples = 0
        self.sections = []

    @property
    def seconds(self):
        return round(self.samples / SAMPLE_RATE, 2)

    def add(self, audio):
        self.parts.append(audio)
        self.samples += len(audio)

    def section(self, sec_id, label, passages, synth):
        """passages: list of strings read one after another, each an 'item'."""
        if self.parts:
            self.add(silence(GAP_SECTION))
        entry = {"id": sec_id, "label": label, "start": self.seconds, "items": []}
        for n, text in enumerate(passages):
            if n:
                self.add(silence(GAP_ITEM))
            start = self.seconds
            self.add(synth(text))
            entry["items"].append({"start": start, "end": self.seconds})
        entry["end"] = self.seconds
        self.sections.append(entry)

    def audio(self):
        return np.concatenate(self.parts)


def full_passages(data):
    """The three sections of the panel as (id, label, [passage, ...])."""
    yield "summary", "Summary", [data["argument"].strip()]
    ideas = [i.strip() for i in (data.get("keyIdeas") or []) if i and i.strip()]
    if ideas:
        yield "ideas", "Key ideas", ["Key ideas."] + ideas
    terms = [(t.get("term") or "").strip() + ". " + (t.get("def") or "").strip()
             for t in (data.get("terms") or []) if t and t.get("term")]
    if terms:
        yield "terms", "Terms", ["Terms."] + terms


def encode_opus(wav_path, out_path, bitrate):
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
        "-c:a", "libopus", "-b:a", bitrate, "-ac", "1", "-application", "voip",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def write_track(track, out_path, tmp, bitrate):
    wav = Path(tmp) / (out_path.stem + ".wav")
    sf.write(wav, track.audio(), SAMPLE_RATE)
    encode_opus(wav, out_path, bitrate)
    wav.unlink()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="regenerate files that already exist")
    ap.add_argument("--ids", type=int, nargs="*", help="only these episode ids")
    ap.add_argument("--only", choices=["summary", "full"], help="render just one kind of file")
    ap.add_argument("--voice", default=DEFAULT_VOICE)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--bitrate", default="32k")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")

    from kokoro import KPipeline  # slow import, so after the arg/ffmpeg checks
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"loading Kokoro on {device} (voice {args.voice})")
    pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", device=device)

    def synth(text):
        return synthesize(pipeline, text, args.voice, args.speed)

    OUT_DIR.mkdir(exist_ok=True)
    kinds = [k for k in ("summary", "full") if not args.only or args.only == k]
    jobs = []
    for ep_id, data in load_episodes(set(args.ids or [])):
        for kind in kinds:
            out = OUT_DIR / (f"{ep_id}.ogg" if kind == "summary" else f"{ep_id}-full.ogg")
            if args.force or not out.exists():
                jobs.append((ep_id, kind, data, out))
    print(f"{len(jobs)} files to render")

    started = time.time()
    total_seconds = 0.0
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        for n, (ep_id, kind, data, out) in enumerate(jobs, 1):
            try:
                track = Track()
                if kind == "summary":
                    track.section("summary", "Summary", [data["argument"].strip()], synth)
                else:
                    for sec_id, label, passages in full_passages(data):
                        track.section(sec_id, label, passages, synth)
                write_track(track, out, tmp, args.bitrate)
                if kind == "full":
                    sidecar = {"duration": track.seconds, "sections": track.sections}
                    out.with_suffix(".json").write_text(json.dumps(sidecar, separators=(",", ":")) + "\n")
                total_seconds += track.seconds
                print(f"[{n}/{len(jobs)}] {out.name}: {track.seconds:6.1f}s audio, {out.stat().st_size // 1024} KB", flush=True)
            except Exception as e:  # keep going; report at the end
                failures.append((out.name, str(e)))
                print(f"[{n}/{len(jobs)}] {out.name}: FAILED {e}", flush=True)

    print(f"done: {total_seconds / 60:.1f} min of audio in {(time.time() - started) / 60:.1f} min wall")
    if failures:
        print("failed:", ", ".join(f"{i} ({e})" for i, e in failures))
        sys.exit(1)


if __name__ == "__main__":
    main()
