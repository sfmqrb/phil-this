#!/usr/bin/env python3
"""
Read every episode summary (the "argument" field in learn/<id>.json) aloud
with Kokoro-82M, an open-weights neural TTS model, and save the result as
audio/<id>.ogg (Opus, mono, 32 kb/s). The site's "Hear this" button plays
these files and only falls back to the browser's own robotic voice when a
file is missing.

Setup (one-off, ~3 GB with the CUDA build of torch):
    python3 -m venv .venv-tts
    .venv-tts/bin/pip install kokoro soundfile espeakng-loader

Usage (from the repo root, ffmpeg must be on PATH):
    .venv-tts/bin/python app/generate_audio.py            # only missing files
    .venv-tts/bin/python app/generate_audio.py --force    # redo everything
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


def load_summaries(ids):
    for f in sorted(LEARN_DIR.glob("*.json"), key=lambda p: int(p.stem)):
        if ids and int(f.stem) not in ids:
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        text = (data.get("argument") or "").strip()
        if text:
            yield int(f.stem), text


def synthesize(pipeline, text, voice, speed):
    chunks = []
    # split_pattern splits on sentence ends so each chunk stays well under the
    # model's 510-token window; the pipeline stitches the pieces back together.
    for _gs, _ps, audio in pipeline(text, voice=voice, speed=speed, split_pattern=r"(?<=[.!?])\s+"):
        chunks.append(audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio))
        # a short breath between sentences so the read doesn't run together
        chunks.append(np.zeros(int(SAMPLE_RATE * 0.18), dtype=np.float32))
    if not chunks:
        raise RuntimeError("model produced no audio")
    return np.concatenate(chunks)


def encode_opus(wav_path, out_path, bitrate):
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
        "-c:a", "libopus", "-b:a", bitrate, "-ac", "1", "-application", "voip",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="regenerate files that already exist")
    ap.add_argument("--ids", type=int, nargs="*", help="only these episode ids")
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

    OUT_DIR.mkdir(exist_ok=True)
    todo = [(i, t) for i, t in load_summaries(set(args.ids or []))
            if args.force or not (OUT_DIR / f"{i}.ogg").exists()]
    print(f"{len(todo)} summaries to render")

    started = time.time()
    total_seconds = 0.0
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        for n, (ep_id, text) in enumerate(todo, 1):
            out = OUT_DIR / f"{ep_id}.ogg"
            try:
                audio = synthesize(pipeline, text, args.voice, args.speed)
                wav = Path(tmp) / f"{ep_id}.wav"
                sf.write(wav, audio, SAMPLE_RATE)
                encode_opus(wav, out, args.bitrate)
                wav.unlink()
                secs = len(audio) / SAMPLE_RATE
                total_seconds += secs
                print(f"[{n}/{len(todo)}] {ep_id}: {secs:5.1f}s audio, {out.stat().st_size // 1024} KB", flush=True)
            except Exception as e:  # keep going; report at the end
                failures.append((ep_id, str(e)))
                print(f"[{n}/{len(todo)}] {ep_id}: FAILED {e}", flush=True)

    print(f"done: {total_seconds / 60:.1f} min of audio in {(time.time() - started) / 60:.1f} min wall")
    if failures:
        print("failed:", ", ".join(f"{i} ({e})" for i, e in failures))
        sys.exit(1)


if __name__ == "__main__":
    main()
