# Philosophitor

A quiz-and-study companion for the *Philosophize This!* podcast. Every episode gets a ten-question quiz, a plain-language summary you can read or have read aloud, and a word cloud of what the episode actually talks about, all sitting on top of the full transcripts so you can check the source when an answer surprises you. It is a static site: no accounts, no server, your progress lives in your browser.

## Local preview

```bash
./build.sh
python3 -m http.server 4173 -d dist
```

Then open http://localhost:4173/. Deep links such as `/episode/94` only work on GitHub Pages (which serves `dist/404.html`, a copy of the app, for unknown paths); with `http.server` start from the home page. `npx serve -s dist` also works and handles deep links itself.

`build.sh` copies `app/` and `transcripts/` into `dist/`, rewrites `<base href>` to `BASE_PATH` (default `/`), adds `404.html` and `.nojekyll`, and prints the size.

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which builds with `BASE_PATH=/phil-this/` and publishes `dist/` to GitHub Pages at https://sfmqrb.github.io/phil-this/. The workflow can also be started by hand from the Actions tab.

## Regenerating assets

**Word clouds** (`app/wordclouds/<id>.png`), see the docstring in `app/generate_wordclouds.py`:

```bash
cd app
node -e "const Q=require('./data.js'); require('fs').writeFileSync('/tmp/episode-transcripts.json', JSON.stringify(Q.map(e=>({id:e.id, transcriptFile:e.transcriptFile})),null,2));"
python3 generate_wordclouds.py
```

**Summary audio** (`app/audio/<id>.ogg`, Kokoro-82M TTS, ffmpeg must be on PATH), see the docstring in `app/generate_audio.py`:

```bash
python3 -m venv .venv-tts
.venv-tts/bin/pip install kokoro soundfile espeakng-loader
.venv-tts/bin/python app/generate_audio.py            # only missing files
.venv-tts/bin/python app/generate_audio.py --force    # redo everything
.venv-tts/bin/python app/generate_audio.py --ids 94 12 --voice am_michael
```

**Transcripts** (`transcripts/*.md`) come from `main.py`, the scraper.

## Checks

`node app/tests/validate.js` validates `data.js` and exercises `logic.js`.
