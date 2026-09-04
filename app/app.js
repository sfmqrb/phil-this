(function () {
  var STORAGE_KEY = "phil-this-quiz-scores-v1";
  var PROGRESS_KEY = "phil-this-quiz-progress-v1";
  // The spaced-repetition review deck was retired; clear whatever it left behind.
  try { localStorage.removeItem("phil-this-quiz-review-v1"); localStorage.removeItem("phil-this-quiz-review-session-v1"); } catch (e) {}
  var LETTERS = ["A", "B", "C", "D"];

  // The site is fully static and may live under a sub-path (GitHub Pages
  // serves it from /phil-this/). The <base href> in index.html is the one
  // place that knows that prefix, so derive it from there once: "" when served
  // from the root, "/phil-this" on Pages. Every absolute path this file builds
  // or reads goes through setUrl/replaceUrl/routePath, which add and strip it.
  var BASE_PATH = new URL(document.baseURI).pathname.replace(/\/$/, "");

  // Only some QUIZ_DATA entries carry a url of their own; EPISODE_INDEX has a
  // link for every episode, so backfill the gaps — otherwise the "Original
  // episode" link silently disappears for most episodes on the main page.
  if (typeof EPISODE_INDEX !== "undefined" && typeof QUIZ_DATA !== "undefined") {
    var episodeUrlById = {};
    EPISODE_INDEX.forEach(function (e) { episodeUrlById[e.id] = e.url; });
    QUIZ_DATA.forEach(function (ep) {
      if (!ep.url && episodeUrlById[ep.id]) ep.url = episodeUrlById[ep.id];
    });
  }

  // data.js writes transcript paths with a leading "../" (the validator
  // resolves them from app/ on disk). The built site puts the transcripts at
  // <site root>/transcripts/, so drop the "../" and let <base> resolve them.
  if (typeof QUIZ_DATA !== "undefined") {
    QUIZ_DATA.forEach(function (ep) {
      if (typeof ep.transcriptFile === "string") ep.transcriptFile = ep.transcriptFile.replace(/^(\.\.\/)+/, "");
    });
  }

  // Shareable URLs: /episode/N opens that episode's quiz, /episode/N/transcript
  // opens its transcript, /transcripts and /credit open those tabs. Paths are
  // app-relative; BASE_PATH is prepended here. setUrl no-ops when already at
  // that path, so calling it from both a click handler and from the initial
  // route dispatch (below) never creates a duplicate history entry.
  function setUrl(path) {
    var full = BASE_PATH + path;
    if (location.pathname !== full) history.pushState(null, "", full);
  }

  // Rewrites the address bar without adding a history entry — used when a URL
  // points at something that isn't there any more (an episode with no quiz, a
  // typo'd path), so the bar always agrees with the view we fell back to.
  function replaceUrl(path) {
    var full = BASE_PATH + path;
    if (location.pathname !== full) history.replaceState(null, "", full);
  }

  // The inverse: location.pathname with BASE_PATH stripped and trailing
  // slashes trimmed, so the router only ever sees app-relative paths and the
  // bare site root ("" or "/phil-this/") reads as "/".
  function routePath() {
    var p = location.pathname;
    if (BASE_PATH && p.indexOf(BASE_PATH) === 0) p = p.slice(BASE_PATH.length);
    return p.replace(/\/+$/, "") || "/";
  }

  function readJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function loadScores() { return readJson(STORAGE_KEY, {}); }
  function writeScoresLocal(scores) { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); }

  function recordResult(episodeId, score, total) {
    var scores = loadScores();
    var record = QuizLogic.applyResult(scores, episodeId, score, total);
    writeScoresLocal(scores);
    return record;
  }

  // ---------- in-progress ("half-taken") quiz cache ----------

  function loadProgress() { return readJson(PROGRESS_KEY, {}); }
  function writeProgressLocal(all) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); }

  function setEpisodeProgress(episodeId, data) {
    var all = loadProgress();
    all[String(episodeId)] = data;
    writeProgressLocal(all);
  }

  function clearEpisodeProgress(episodeId) {
    var all = loadProgress();
    delete all[String(episodeId)];
    writeProgressLocal(all);
  }

  var pct = QuizLogic.pct;
  var escapeHtml = QuizLogic.escapeHtml;

  // ---------- the one navigation function ----------
  // Four top-level views live in index.html, all hidden by CSS until they get
  // the "show" class. showView() is the ONLY place in this file that touches
  // those classes: it hides all four, shows exactly one, syncs the tab strip
  // (Episodes stays lit for both the dashboard and a quiz, since a quiz is an
  // episode you opened), scrolls back to the top, and refreshes whatever that
  // view renders. Every entry point — tab clicks, startQuiz, goToDashboard,
  // passage links, "Take quiz" buttons, dispatchRoute — goes through it, so
  // the visible view can never drift from the URL.

  var dashboardView = document.getElementById("dashboardView");
  var quizView = document.getElementById("quizView");
  var transcriptsView = document.getElementById("transcriptsView");
  var creditView = document.getElementById("creditView");
  var tabEpisodesBtn = document.getElementById("tabEpisodesBtn");
  var tabTranscriptsBtn = document.getElementById("tabTranscriptsBtn");
  var tabCreditBtn = document.getElementById("tabCreditBtn");

  // ---------- theme toggle ----------
  // Three states cycling system → light → dark. An explicit choice sets
  // data-theme on <html> and persists device-level; "system" clears both so
  // prefers-color-scheme decides. The inline <head> script re-applies the
  // saved choice before first paint.
  var themeToggleBtn = document.getElementById("themeToggleBtn");
  var THEME_KEY = "phil-this-theme";

  function currentThemeChoice() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return t === "light" || t === "dark" ? t : "system";
    } catch (e) { return "system"; }
  }

  function applyThemeChoice(choice) {
    if (choice === "light" || choice === "dark") {
      document.documentElement.setAttribute("data-theme", choice);
      try { localStorage.setItem(THEME_KEY, choice); } catch (e) {}
    } else {
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.removeItem(THEME_KEY); } catch (e) {}
    }
    if (themeToggleBtn) {
      themeToggleBtn.textContent =
        choice === "light" ? "○ light" : choice === "dark" ? "● dark" : "◐ auto";
      themeToggleBtn.title =
        choice === "system" ? "Theme: follows your system" : "Theme: always " + choice;
    }
  }

  if (themeToggleBtn) {
    applyThemeChoice(currentThemeChoice());
    themeToggleBtn.addEventListener("click", function () {
      var order = ["system", "light", "dark"];
      var next = order[(order.indexOf(currentThemeChoice()) + 1) % order.length];
      applyThemeChoice(next);
    });
  }

  // ---------- background scene toggle ----------
  // Same shape as the theme toggle: motion (default) → still (art frozen)
  // → hidden (no background art at all). Persisted device-level; the inline
  // <head> script re-applies it before first paint.
  var sceneToggleBtn = document.getElementById("sceneToggleBtn");
  var SCENE_KEY = "phil-this-scene";

  function currentSceneChoice() {
    try {
      var s = localStorage.getItem(SCENE_KEY);
      return s === "still" || s === "hidden" ? s : "motion";
    } catch (e) { return "motion"; }
  }

  function applySceneChoice(choice) {
    if (choice === "still" || choice === "hidden") {
      document.documentElement.setAttribute("data-scene", choice);
      try { localStorage.setItem(SCENE_KEY, choice); } catch (e) {}
    } else {
      document.documentElement.removeAttribute("data-scene");
      try { localStorage.removeItem(SCENE_KEY); } catch (e) {}
    }
    if (sceneToggleBtn) {
      sceneToggleBtn.textContent =
        choice === "still" ? "✳ still" : choice === "hidden" ? "✳ hidden" : "✳ motion";
      sceneToggleBtn.title =
        choice === "still" ? "Background scene: frozen in place"
        : choice === "hidden" ? "Background scene: hidden"
        : "Background scene: animated";
    }
  }

  if (sceneToggleBtn) {
    applySceneChoice(currentSceneChoice());
    sceneToggleBtn.addEventListener("click", function () {
      var order = ["motion", "still", "hidden"];
      var next = order[(order.indexOf(currentSceneChoice()) + 1) % order.length];
      applySceneChoice(next);
    });
  }

  var VIEW_ORDER = ["dashboard", "quiz", "transcripts", "credit"];
  var currentViewName = null;

  function viewContainer(name) {
    if (name === "dashboard") return dashboardView;
    if (name === "quiz") return quizView;
    if (name === "transcripts") return transcriptsView;
    if (name === "credit") return creditView;
    return null;
  }

  function viewTab(name) {
    if (name === "dashboard" || name === "quiz") return tabEpisodesBtn;
    if (name === "transcripts") return tabTranscriptsBtn;
    if (name === "credit") return tabCreditBtn;
    return null;
  }

  function showView(name) {
    // Navigating anywhere cuts off a summary being read aloud.
    stopSpeaking();
    var target = VIEW_ORDER.indexOf(name) === -1 ? "dashboard" : name;
    var activeTab = viewTab(target);
    var changed = currentViewName !== target;

    VIEW_ORDER.forEach(function (key) {
      var el = viewContainer(key);
      if (!el) return;
      if (key === target) el.classList.add("show");
      else el.classList.remove("show");
    });
    [tabEpisodesBtn, tabTranscriptsBtn, tabCreditBtn].forEach(function (tab) {
      if (!tab) return;
      if (tab === activeTab) tab.classList.add("active");
      else tab.classList.remove("active");
    });

    // The reader is a sub-state of the transcripts view, not a view of its
    // own: any navigation closes it, and openTranscriptReader re-opens it
    // immediately after its own showView("transcripts") call. That way
    // /transcripts always means the title list and the reader only survives
    // on /episode/N/transcript.
    hideTranscriptReaderPanel();

    currentViewName = target;
    if (changed && typeof window.scrollTo === "function") window.scrollTo(0, 0);

    if (target === "dashboard") renderDashboard();
    if (target === "transcripts") renderTranscriptList();
  }

  if (tabEpisodesBtn) tabEpisodesBtn.addEventListener("click", function () { setUrl("/"); showView("dashboard"); });
  if (tabTranscriptsBtn) tabTranscriptsBtn.addEventListener("click", function () { setUrl("/transcripts"); showView("transcripts"); });
  if (tabCreditBtn) tabCreditBtn.addEventListener("click", function () { setUrl("/credit"); showView("credit"); });

  // ---------- learn data: arguments, key ideas, terms, passage anchors ----------
  // app/learn/<id>.json is generated per episode and may simply be absent for
  // an episode (or for the whole app). Every caller treats a miss as "this
  // episode has no learn data" and quietly hides the extra UI. The cache holds
  // the promise itself — including the ones that resolved to null — so a
  // missing file is never re-fetched.

  var learnCache = {};

  function fetchLearnData(episodeId) {
    var key = String(episodeId);
    if (learnCache[key]) return learnCache[key];
    if (typeof fetch !== "function") return Promise.resolve(null);
    learnCache[key] = fetch("learn/" + key + ".json")
      .then(function (res) { if (!res.ok) throw new Error("no learn data"); return res.json(); })
      .then(function (data) { return data && typeof data === "object" ? data : null; })
      .catch(function () { return null; });
    return learnCache[key];
  }

  function hasLearnContent(data) {
    if (!data) return false;
    return !!(data.argument ||
      (Array.isArray(data.keyIdeas) && data.keyIdeas.length) ||
      (Array.isArray(data.terms) && data.terms.length));
  }

  // The verbatim transcript sentence behind question qIndex's correct answer,
  // or "" when this episode has no anchor for that question.
  function learnAnchor(data, qIndex) {
    if (!data || !Array.isArray(data.anchors) || typeof qIndex !== "number") return "";
    var anchor = data.anchors[qIndex];
    if (typeof anchor !== "string" || !anchor.trim()) return "";
    return anchor;
  }

  // "Hear this": plays a pre-generated neural reading of the episode, either
  // the summary alone (audio/<id>.ogg) or the whole panel (audio/<id>-full.ogg,
  // with audio/<id>-full.json marking where each section starts), and falls
  // back to the browser's own speech synthesis when the file is missing or
  // Ogg/Opus can't be decoded. Only one thing plays at a time; the panel that
  // started it is the one whose button shows "Stop" and whose player bar is
  // visible.
  var SPEECH_SUMMARY_LABEL = "\u25B6 Hear summary";
  var SPEECH_FULL_LABEL = "\u25B6 Hear everything";
  var SPEECH_LOADING_LABEL = "\u2026 Loading";
  var SPEECH_ACTIVE_LABEL = "\u25A0 Stop";
  var SPEECH_PLAY_ICON = "\u25B6";
  var SPEECH_PAUSE_ICON = "\u23F8";
  var SPEECH_SKIP_SECONDS = 5;
  var SPEECH_NOTE = "browser voice, no seeking";
  // Chrome's network voices go silent partway through any single utterance
  // longer than about 15 seconds, so long texts are spoken in pieces.
  var SPEECH_UTTERANCE_CHARS = 220;

  // Everything about the current playback. player: the panel's controls (see
  // buildSpeechPlayer); mode: "summary" | "full"; source: "audio" | "speech";
  // phase: "loading" | "playing". token goes up on every play request and on
  // every stop, and every asynchronous callback compares it before touching
  // anything, so leftovers from an abandoned playback (a rejected play()
  // promise, a cancelled utterance, a late sidecar fetch) are ignored.
  var speechState = {
    token: 0,
    player: null,
    mode: null,
    source: null,
    phase: null,
    paused: false,
    text: "",
    sections: null,
    // Sidecar duration: stands in for audio.duration while the browser
    // reports Infinity (a server without range requests, still streaming).
    duration: 0
  };
  var summaryAudio = null;
  var speechSectionCache = {};

  function speechSupported() {
    return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  function audioSupported() {
    if (typeof window.Audio !== "function") return false;
    var probe = document.createElement("audio");
    return !!(probe.canPlayType && probe.canPlayType('audio/ogg; codecs="opus"'));
  }

  // Shared element so a second reading can never play over the first. Its
  // listeners go on once, here, and read speechState on every event. (They
  // used to be attached per playback and detached on "emptied", which broke
  // the second play: stopSpeaking()'s load() leaves the element in
  // NETWORK_NO_SOURCE, so assigning src right after queues an asynchronous
  // "emptied" that fired after the fresh listeners were on and stripped them
  // off again, leaving the button on "Loading" forever.)
  function getSummaryAudio() {
    if (summaryAudio) return summaryAudio;
    var audio = new window.Audio();
    audio.preload = "auto";
    function owned() {
      return !!speechState.player && speechState.source === "audio";
    }
    audio.addEventListener("playing", function () {
      if (!owned()) return;
      speechState.phase = "playing";
      syncSpeechPlayer(speechState.player);
    });
    ["play", "pause", "timeupdate", "durationchange", "loadedmetadata"].forEach(function (type) {
      audio.addEventListener(type, function () {
        if (owned()) syncSpeechPlayer(speechState.player);
      });
    });
    audio.addEventListener("ended", function () {
      if (owned()) stopSpeaking();
    });
    // 404, decode failure, network drop: try the robotic voice instead.
    audio.addEventListener("error", function () {
      if (!owned()) return;
      audio.removeAttribute("src");
      audio.load();
      speakCurrentText();
    });
    summaryAudio = audio;
    return audio;
  }

  // audio/<id>-full.json: where the summary, key ideas and terms start in the
  // -full.ogg file. Resolves to {duration, sections: [{id, label, start,
  // end}]} (sections null when none parsed), or null when the sidecar is
  // missing or malformed; fetched once per episode.
  function getSpeechSections(episodeId) {
    var key = String(episodeId);
    if (speechSectionCache[key]) return speechSectionCache[key];
    speechSectionCache[key] = fetch("audio/" + encodeURIComponent(key) + "-full.json")
      .then(function (res) { if (!res.ok) throw new Error("no sections"); return res.json(); })
      .then(function (data) {
        var list = data && Array.isArray(data.sections) ? data.sections : [];
        var sections = [];
        list.forEach(function (s) {
          if (!s || typeof s.start !== "number" || typeof s.end !== "number" || !s.label) return;
          sections.push({ id: String(s.id || ""), label: String(s.label), start: s.start, end: s.end });
        });
        var duration = data && typeof data.duration === "number" ? data.duration : 0;
        if (!sections.length && !duration) return null;
        return { duration: duration, sections: sections.length ? sections : null };
      })
      .catch(function () { return null; });
    return speechSectionCache[key];
  }

  // The section that contains `time` (the last one that has started).
  function speechSectionAt(sections, time) {
    var current = null;
    for (var i = 0; i < sections.length; i++) {
      if (time >= sections[i].start) current = sections[i];
    }
    return current;
  }

  // 287.7 -> "4:47"
  function formatClock(seconds) {
    var total = Math.max(0, Math.floor(seconds || 0));
    var s = total % 60;
    return Math.floor(total / 60) + ":" + (s < 10 ? "0" : "") + s;
  }

  // Sentence-terminate a fragment so the browser voice pauses after it.
  function speechSentence(text) {
    var s = String(text || "").trim();
    return !s || /[.!?]["')\]]*$/.test(s) ? s : s + ".";
  }

  // What the browser voice reads for "Hear everything": the same script as
  // the -full.ogg files.
  function fullSpeechText(data) {
    var parts = [speechSentence(data.argument)];
    var ideas = Array.isArray(data.keyIdeas) ? data.keyIdeas : [];
    if (ideas.length) {
      parts.push("Key ideas.");
      ideas.forEach(function (idea) { if (idea) parts.push(speechSentence(idea)); });
    }
    var terms = Array.isArray(data.terms) ? data.terms : [];
    if (terms.length) {
      parts.push("Terms.");
      terms.forEach(function (t) {
        if (t && t.term) parts.push(speechSentence(t.term) + " " + speechSentence(t.def));
      });
    }
    return parts.join(" ");
  }

  // Sentence-sized pieces, merged up to SPEECH_UTTERANCE_CHARS characters.
  function splitForSpeech(text) {
    var sentences = String(text).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [String(text)];
    var chunks = [];
    var current = "";
    sentences.forEach(function (sentence) {
      if (current && (current + sentence).length > SPEECH_UTTERANCE_CHARS) {
        chunks.push(current.trim());
        current = "";
      }
      current += sentence;
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // state: "idle" | "loading" | "playing"
  function setSpeechButton(btn, state, idleLabel) {
    if (!btn) return;
    var active = state === "loading" || state === "playing";
    btn.textContent = state === "playing" ? SPEECH_ACTIVE_LABEL :
      state === "loading" ? SPEECH_LOADING_LABEL : idleLabel;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  // Safe to call at any time, including when nothing is playing.
  function stopSpeaking() {
    speechState.token += 1;
    var player = speechState.player;
    speechState.player = null;
    speechState.mode = null;
    speechState.source = null;
    speechState.phase = null;
    speechState.paused = false;
    speechState.text = "";
    speechState.sections = null;
    speechState.duration = 0;
    if (summaryAudio) {
      summaryAudio.pause();
      // Dropping src aborts a download still in flight.
      summaryAudio.removeAttribute("src");
      summaryAudio.load();
    }
    if (speechSupported()) window.speechSynthesis.cancel();
    // The panel that was playing goes back to idle.
    if (player) syncSpeechPlayer(player);
  }

  function englishVoice() {
    // Prefer an English voice when the list is already loaded; don't wait on
    // voiceschanged, the default voice is fine as a fallback.
    var voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf("en") === 0) return voices[i];
    }
    return null;
  }

  // Browser speech synthesis for the current request (speechState.text).
  // Assumes the caller has set up speechState and stopped whatever else was
  // playing.
  function speakCurrentText() {
    var player = speechState.player;
    var text = speechState.text;
    if (!player || !text || !speechSupported()) {
      stopSpeaking();
      return;
    }
    var token = speechState.token;
    speechState.source = "speech";
    speechState.phase = "playing";
    speechState.paused = false;
    speechState.sections = null;
    speechState.duration = 0;
    var voice = englishVoice();
    var chunks = splitForSpeech(text);
    function done() {
      // Ignore late callbacks from an utterance another request replaced.
      if (token === speechState.token) stopSpeaking();
    }
    // Chrome sometimes swallows speak() unless the queue was just cancelled.
    window.speechSynthesis.cancel();
    chunks.forEach(function (chunk, i) {
      var utterance = new window.SpeechSynthesisUtterance(chunk);
      utterance.lang = "en-US";
      utterance.rate = 1;
      if (voice) utterance.voice = voice;
      if (i === chunks.length - 1) utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
    syncSpeechPlayer(player);
  }

  // Entry point for the two text buttons: pre-generated file first, synthesis
  // second. Clicking the button that is already playing toggles it off.
  function playSpeech(player, mode) {
    if (speechState.player === player && speechState.mode === mode) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    var data = player.data;
    var text = mode === "full" ? fullSpeechText(data) : String(data.argument || "");
    if (!text) return;
    speechState.token += 1;
    var token = speechState.token;
    speechState.player = player;
    speechState.mode = mode;
    speechState.text = text;
    speechState.phase = "loading";
    var hasId = data.id !== undefined && data.id !== null && data.id !== "";
    if (!hasId || !audioSupported()) {
      speakCurrentText();
      return;
    }

    speechState.source = "audio";
    var audio = getSummaryAudio();
    var file = encodeURIComponent(String(data.id)) + (mode === "full" ? "-full.ogg" : ".ogg");
    audio.src = "audio/" + file;
    var p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(function (err) {
        // A stop or a newer request superseded this one; the AbortError that
        // interrupting a load produces means nothing now.
        if (token !== speechState.token) return;
        // Autoplay blocked or similar: nothing more we can do this click.
        // A source failure surfaces via "error" and falls back there.
        if (err && err.name === "NotAllowedError") stopSpeaking();
      });
    }
    if (mode === "full") {
      getSpeechSections(data.id).then(function (meta) {
        if (token !== speechState.token || speechState.source !== "audio") return;
        speechState.sections = meta ? meta.sections : null;
        speechState.duration = meta ? meta.duration : 0;
        syncSpeechPlayer(player);
      });
    }
    syncSpeechPlayer(player);
  }

  function toggleSpeechPause(player) {
    if (speechState.player !== player) return;
    if (speechState.source === "audio") {
      var audio = getSummaryAudio();
      if (audio.paused) {
        var p = audio.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      } else {
        audio.pause();
      }
    } else if (speechSupported()) {
      if (speechState.paused) window.speechSynthesis.resume();
      else window.speechSynthesis.pause();
      speechState.paused = !speechState.paused;
    }
    syncSpeechPlayer(player);
  }

  // Track length in seconds, 0 while unknown.
  function speechDuration(audio) {
    if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return speechState.duration || 0;
  }

  // Seeks the file to `time`, clamped to the track. No-op for the browser
  // voice, which cannot seek.
  function seekSpeech(player, time) {
    if (speechState.player !== player || speechState.source !== "audio") return;
    var audio = getSummaryAudio();
    var duration = speechDuration(audio);
    var target = Math.max(0, time);
    if (duration) target = Math.min(target, duration);
    audio.currentTime = target;
    syncSpeechPlayer(player);
  }

  function skipSpeech(player, seconds) {
    if (speechState.player !== player || speechState.source !== "audio") return;
    seekSpeech(player, (getSummaryAudio().currentTime || 0) + seconds);
  }

  // Renders speechState into one panel's controls: called for the owning
  // panel on every event, and once for a panel that just lost ownership so
  // it goes back to idle.
  function syncSpeechPlayer(player) {
    var owns = speechState.player === player;
    var audio = owns && speechState.source === "audio" ? getSummaryAudio() : null;
    setSpeechButton(player.summaryBtn, owns && speechState.mode === "summary" ? speechState.phase : "idle", SPEECH_SUMMARY_LABEL);
    setSpeechButton(player.fullBtn, owns && speechState.mode === "full" ? speechState.phase : "idle", SPEECH_FULL_LABEL);
    player.bar.hidden = !owns;
    if (!owns) return;

    var paused = audio ? audio.paused : speechState.paused;
    player.pauseBtn.textContent = paused ? SPEECH_PLAY_ICON : SPEECH_PAUSE_ICON;
    player.pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");

    // Seeking only makes sense for the file; the browser voice gets a note.
    var seekable = !!audio;
    player.backBtn.hidden = !seekable;
    player.fwdBtn.hidden = !seekable;
    player.range.hidden = !seekable;
    player.timeEl.hidden = !seekable;
    player.note.hidden = seekable;
    var sections = seekable && speechState.mode === "full" ? speechState.sections : null;
    player.sectionsEl.hidden = !sections;
    if (!seekable) return;

    var duration = speechDuration(audio);
    var time = audio.currentTime || 0;
    // While the user drags the scrubber, leave its position to them.
    if (!player.scrubbing) {
      player.range.max = duration ? duration.toFixed(1) : "0";
      player.range.value = time.toFixed(1);
    }
    player.range.disabled = !duration;
    var clock = formatClock(time) + (duration ? " / " + formatClock(duration) : "");
    player.timeEl.textContent = clock;
    player.range.setAttribute("aria-valuetext", clock);

    if (!sections) return;
    if (player.jumpsFor !== sections) buildSpeechJumps(player, sections);
    var current = speechSectionAt(sections, time);
    player.sectionLabel.textContent = current ? current.label : "";
    player.jumpLinks.forEach(function (link) {
      if (link.section === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  // "Summary \u00B7 Key ideas \u00B7 Terms" links that jump to a section's start.
  function buildSpeechJumps(player, sections) {
    player.jumpsFor = sections;
    player.jumpLinks = [];
    player.jumpsEl.innerHTML = "";
    sections.forEach(function (section, i) {
      if (i) player.jumpsEl.appendChild(document.createTextNode(" \u00B7 "));
      var link = document.createElement("button");
      link.type = "button";
      link.className = "search-row-link learn-player-jump";
      link.textContent = section.label;
      link.section = section;
      link.addEventListener("click", function () {
        seekSpeech(player, section.start);
      });
      player.jumpLinks.push(link);
      player.jumpsEl.appendChild(link);
    });
  }

  function makeSpeechIconButton(className, label, text) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "learn-player-btn " + className;
    btn.setAttribute("aria-label", label);
    btn.textContent = text;
    return btn;
  }

  // The two text buttons plus the player bar for one learn panel. The whole
  // thing is drawn from speechState by syncSpeechPlayer(); the only state
  // kept here is the scrubbing flag and the jump links already built.
  function buildSpeechPlayer(data, withFull) {
    var player = { data: data, scrubbing: false, jumpsFor: null, jumpLinks: [] };
    var actions = document.createElement("div");
    actions.className = "learn-actions";
    player.root = actions;

    player.summaryBtn = document.createElement("button");
    player.summaryBtn.type = "button";
    player.summaryBtn.className = "search-row-link learn-hear-btn";
    player.summaryBtn.addEventListener("click", function () { playSpeech(player, "summary"); });
    actions.appendChild(player.summaryBtn);

    player.fullBtn = document.createElement("button");
    player.fullBtn.type = "button";
    player.fullBtn.className = "search-row-link learn-hear-btn";
    player.fullBtn.addEventListener("click", function () { playSpeech(player, "full"); });
    if (withFull) actions.appendChild(player.fullBtn);

    var bar = document.createElement("div");
    bar.className = "learn-player";
    bar.hidden = true;
    player.bar = bar;

    player.pauseBtn = makeSpeechIconButton("learn-player-pause", "Pause", SPEECH_PAUSE_ICON);
    player.pauseBtn.addEventListener("click", function () { toggleSpeechPause(player); });
    bar.appendChild(player.pauseBtn);

    player.backBtn = makeSpeechIconButton("learn-player-skip", "Back " + SPEECH_SKIP_SECONDS + " seconds", "\u2212" + SPEECH_SKIP_SECONDS + "s");
    player.backBtn.addEventListener("click", function () { skipSpeech(player, -SPEECH_SKIP_SECONDS); });
    bar.appendChild(player.backBtn);

    player.fwdBtn = makeSpeechIconButton("learn-player-skip", "Forward " + SPEECH_SKIP_SECONDS + " seconds", "+" + SPEECH_SKIP_SECONDS + "s");
    player.fwdBtn.addEventListener("click", function () { skipSpeech(player, SPEECH_SKIP_SECONDS); });
    bar.appendChild(player.fwdBtn);

    var range = document.createElement("input");
    range.type = "range";
    range.className = "learn-player-range";
    range.min = "0";
    range.max = "0";
    range.step = "0.1";
    range.value = "0";
    range.setAttribute("aria-label", "Position");
    // Between grabbing the thumb (or pressing a key) and letting go, sync
    // must not push the thumb back to the playhead under the user's hand.
    function beginScrub() { player.scrubbing = true; }
    function endScrub() { player.scrubbing = false; }
    range.addEventListener("pointerdown", beginScrub);
    range.addEventListener("keydown", beginScrub);
    ["pointerup", "pointercancel", "keyup", "blur"].forEach(function (type) {
      range.addEventListener(type, endScrub);
    });
    range.addEventListener("input", function () { seekSpeech(player, Number(range.value)); });
    range.addEventListener("change", function () {
      endScrub();
      seekSpeech(player, Number(range.value));
    });
    player.range = range;
    bar.appendChild(range);

    player.timeEl = document.createElement("span");
    player.timeEl.className = "learn-player-time mono";
    player.timeEl.textContent = "0:00 / 0:00";
    bar.appendChild(player.timeEl);

    player.note = document.createElement("span");
    player.note.className = "learn-player-note";
    player.note.textContent = SPEECH_NOTE;
    player.note.hidden = true;
    bar.appendChild(player.note);

    var sectionsEl = document.createElement("div");
    sectionsEl.className = "learn-player-sections";
    sectionsEl.hidden = true;
    player.sectionLabel = document.createElement("span");
    player.sectionLabel.className = "learn-player-section";
    sectionsEl.appendChild(player.sectionLabel);
    player.jumpsEl = document.createElement("span");
    player.jumpsEl.className = "learn-player-jumps";
    sectionsEl.appendChild(player.jumpsEl);
    player.sectionsEl = sectionsEl;
    bar.appendChild(sectionsEl);

    actions.appendChild(bar);
    syncSpeechPlayer(player);
    return player;
  }

  // Fills a container with the argument / key ideas / terms block. Everything
  // goes in as text — learn data is never treated as HTML.
  function renderLearnPanel(container, data) {
    if (!container) return;
    // Re-rendering the panel that is currently being read aloud would leave
    // a detached "Stop" button behind, so stop first.
    if (speechState.player && container.contains(speechState.player.root)) stopSpeaking();
    container.innerHTML = "";
    if (!data) return;

    if (data.argument) {
      // The listen controls lead the panel, so the choice to hear it comes
      // before the wall of text rather than after it.
      if (audioSupported() || speechSupported()) {
        // "Hear everything" only when there is more than the summary to hear.
        var withFull = !!((Array.isArray(data.keyIdeas) && data.keyIdeas.length) ||
          (Array.isArray(data.terms) && data.terms.length));
        container.appendChild(buildSpeechPlayer(data, withFull).root);
      }

      var lead = document.createElement("p");
      lead.className = "learn-argument";
      lead.textContent = data.argument;
      container.appendChild(lead);
    }

    var ideas = Array.isArray(data.keyIdeas) ? data.keyIdeas : [];
    if (ideas.length) {
      var list = document.createElement("ul");
      list.className = "learn-ideas";
      ideas.forEach(function (idea) {
        if (!idea) return;
        var li = document.createElement("li");
        li.textContent = idea;
        list.appendChild(li);
      });
      container.appendChild(list);
    }

    var terms = Array.isArray(data.terms) ? data.terms : [];
    if (terms.length) {
      var termWrap = document.createElement("div");
      termWrap.className = "learn-terms";
      terms.forEach(function (t) {
        if (!t || !t.term) return;
        var row = document.createElement("div");
        row.className = "learn-term-row";
        var name = document.createElement("span");
        name.className = "learn-term mono";
        name.textContent = t.term;
        var def = document.createElement("span");
        def.className = "learn-def";
        def.textContent = t.def || "";
        row.appendChild(name);
        row.appendChild(def);
        termWrap.appendChild(row);
      });
      container.appendChild(termWrap);
    }
  }

  // "Read the passage →": leaves whatever view you're in, opens the transcript
  // reader for that episode and scrolls to the paragraph the answer came from.
  function makePassageButton(episodeId, anchorText) {
    var btn = document.createElement("button");
    btn.className = "search-row-link";
    btn.type = "button";
    btn.textContent = "Read the passage →";
    btn.addEventListener("click", function () {
      var entry = getAllTranscripts().find(function (e) { return e.id === episodeId; });
      if (!entry) return;
      openTranscriptReader(entry, anchorText); // handles the view switch itself
    });
    return btn;
  }

  // Appends the passage button to a note area once the episode's learn data is
  // in, unless stillCurrent() says the reader has moved on to another question.
  function appendPassageLink(noteEl, episodeId, qIndex, stillCurrent) {
    if (!noteEl) return;
    fetchLearnData(episodeId).then(function (data) {
      var anchor = learnAnchor(data, qIndex);
      if (!anchor) return;
      if (stillCurrent && !stillCurrent()) return;
      var row = document.createElement("div");
      row.className = "note-actions";
      row.appendChild(makePassageButton(episodeId, anchor));
      noteEl.appendChild(row);
    });
  }

  // ---------- transcripts tab: browse every transcript by title ----------

  var transcriptListFilterInput = document.getElementById("transcriptListFilter");
  var transcriptTitleListEl = document.getElementById("transcriptTitleList");
  var transcriptReaderEl = document.getElementById("transcriptReader");
  var transcriptReaderTitleEl = document.getElementById("transcriptReaderTitle");
  var transcriptReaderLinkEl = document.getElementById("transcriptReaderLink");
  var transcriptReaderOriginalLinkEl = document.getElementById("transcriptReaderOriginalLink");
  var transcriptReaderStatusEl = document.getElementById("transcriptReaderStatus");
  var transcriptReaderBodyEl = document.getElementById("transcriptReaderBody");
  var transcriptReaderBackBtn = document.getElementById("transcriptReaderBackBtn");
  var transcriptCopyBtn = document.getElementById("transcriptCopyBtn");
  var transcriptReaderQuizBtn = document.getElementById("transcriptReaderQuizBtn");
  var transcriptPrevBtn = document.getElementById("transcriptPrevBtn");
  var transcriptNextBtn = document.getElementById("transcriptNextBtn");
  var transcriptLearnBox = document.getElementById("transcriptLearnBox");
  var transcriptLearnBodyEl = document.getElementById("transcriptLearnBody");
  var transcriptReaderId = null; // which episode the reader is currently showing
  var transcriptReaderText = ""; // the raw body, kept for "Copy transcript"

  function stripTranscriptHeader(raw) {
    var lines = raw.split("\n");
    var i = 0;
    for (; i < lines.length; i++) {
      if (lines[i].trim() === "---") { i++; break; }
    }
    return lines.slice(i).join("\n").trim();
  }

  var ALL_TRANSCRIPTS = null;

  function getAllTranscripts() {
    if (ALL_TRANSCRIPTS) return ALL_TRANSCRIPTS;
    var titleById = {};
    QUIZ_DATA.forEach(function (ep) { titleById[ep.id] = ep.title; });
    var source = typeof EPISODE_INDEX !== "undefined" ? EPISODE_INDEX : [];
    ALL_TRANSCRIPTS = source.map(function (e) {
      return { id: e.id, file: e.file, url: e.url, title: titleById[e.id] || e.label, hasQuiz: !!titleById[e.id] };
    }).sort(function (a, b) { return a.id - b.id; });
    return ALL_TRANSCRIPTS;
  }

  // Points a prev/next pager button at `neighbor` (any object with an id and
  // title), or disables it in place when there's no neighbor in that
  // direction, so the first/last episode keeps a stable two-button pager.
  function wirePagerButton(btn, neighbor, dir, go) {
    if (!btn) return;
    if (!neighbor) {
      btn.disabled = true;
      btn.textContent = dir === "prev" ? "← prev" : "next →";
      btn.removeAttribute("title");
      btn.onclick = null;
      return;
    }
    btn.disabled = false;
    btn.textContent = dir === "prev" ? "← #" + neighbor.id : "#" + neighbor.id + " →";
    btn.title = neighbor.title || "";
    btn.onclick = function () { go(neighbor); };
  }

  function renderTranscriptList() {
    if (!transcriptTitleListEl) return;
    var query = ((transcriptListFilterInput && transcriptListFilterInput.value) || "").trim().toLowerCase();
    var all = getAllTranscripts();
    var visible = query ? all.filter(function (e) { return textMatches(e.title, query); }) : all;

    transcriptTitleListEl.innerHTML = "";
    if (!visible.length) {
      var empty = document.createElement("p");
      empty.className = "transcript-empty";
      empty.textContent = "No transcripts match “" + query + "”.";
      transcriptTitleListEl.appendChild(empty);
      return;
    }
    visible.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "transcript-row";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.addEventListener("click", function () { openTranscriptReader(e); });
      row.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openTranscriptReader(e); }
      });

      var id = document.createElement("span");
      id.className = "transcript-row-id mono";
      id.textContent = "#" + e.id;
      var title = document.createElement("span");
      title.className = "transcript-row-title";
      title.textContent = e.title;
      row.appendChild(id);
      row.appendChild(title);

      if (e.url) {
        var originalLink = document.createElement("a");
        originalLink.className = "transcript-row-quiz-link";
        originalLink.href = e.url;
        originalLink.target = "_blank";
        originalLink.rel = "noopener";
        originalLink.textContent = "Original ↗";
        originalLink.addEventListener("click", function (ev) { ev.stopPropagation(); });
        row.appendChild(originalLink);
      }

      if (e.hasQuiz) {
        var quizLink = document.createElement("button");
        quizLink.className = "transcript-row-quiz-link";
        quizLink.type = "button";
        quizLink.textContent = "Take quiz";
        quizLink.addEventListener("click", function (ev) {
          ev.stopPropagation();
          startQuiz(e.id);
        });
        row.appendChild(quizLink);
      }

      transcriptTitleListEl.appendChild(row);
    });
  }

  // A transcript body as <p> elements appended to `container`, split on blank
  // lines. Returns the paragraph elements so a caller can hunt for an anchor
  // inside them.
  function appendTranscriptParagraphs(container, text) {
    var paragraphs = [];
    String(text).split(/\n{2,}/).forEach(function (chunk) {
      var trimmed = chunk.trim();
      if (!trimmed) return;
      var p = document.createElement("p");
      p.className = "transcript-para";
      p.textContent = trimmed;
      container.appendChild(p);
      paragraphs.push(p);
    });
    return paragraphs;
  }

  function renderTranscriptBody(text) {
    transcriptReaderBodyEl.innerHTML = "";
    return appendTranscriptParagraphs(transcriptReaderBodyEl, text);
  }

  // Exact match first (anchors are verbatim quotes), then a case-insensitive
  // pass for the ones that drifted in capitalisation.
  function findAnchorParagraph(paragraphs, anchorText) {
    var needle = String(anchorText);
    var i;
    for (i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].textContent.indexOf(needle) !== -1) return paragraphs[i];
    }
    var lower = needle.toLowerCase();
    for (i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].textContent.toLowerCase().indexOf(lower) !== -1) return paragraphs[i];
    }
    return null;
  }

  // anchorText is optional: when given (from a "Read the passage →" button),
  // the paragraph containing it is highlighted and scrolled into view.
  // Callable from any view: it navigates to the transcripts view first.
  function openTranscriptReader(entry, anchorText) {
    if (!transcriptReaderEl) return;
    showView("transcripts");
    setUrl("/episode/" + entry.id + "/transcript");
    transcriptReaderId = entry.id;
    transcriptReaderText = "";
    if (transcriptTitleListEl) transcriptTitleListEl.style.display = "none";
    if (transcriptListFilterInput) transcriptListFilterInput.style.display = "none";
    transcriptReaderEl.style.display = "";
    transcriptReaderTitleEl.textContent = "#" + entry.id + " · " + entry.title;
    transcriptReaderLinkEl.href = "transcripts/" + entry.file;
    if (transcriptReaderOriginalLinkEl) {
      transcriptReaderOriginalLinkEl.href = entry.url || "#";
      transcriptReaderOriginalLinkEl.style.display = entry.url ? "" : "none";
    }
    transcriptReaderBodyEl.textContent = "";
    transcriptReaderStatusEl.textContent = "Loading transcript…";
    if (transcriptReaderQuizBtn) {
      transcriptReaderQuizBtn.style.display = entry.hasQuiz ? "" : "none";
      transcriptReaderQuizBtn.onclick = function () { startQuiz(entry.id); };
    }

    // Prev/next walk the full transcript list in id order. A disabled button
    // (first/last episode) keeps its slot so the pager doesn't jump around.
    var all = getAllTranscripts();
    var pos = all.findIndex(function (e) { return e.id === entry.id; });
    wirePagerButton(transcriptPrevBtn, pos > 0 ? all[pos - 1] : null, "prev", function (n) { openTranscriptReader(n); });
    wirePagerButton(transcriptNextBtn, pos !== -1 && pos < all.length - 1 ? all[pos + 1] : null, "next", function (n) { openTranscriptReader(n); });

    // The key ideas sit above the transcript and start open: they're the point,
    // the transcript is the evidence.
    if (transcriptLearnBox) {
      transcriptLearnBox.style.display = "none";
      if (transcriptLearnBodyEl) transcriptLearnBodyEl.innerHTML = "";
      fetchLearnData(entry.id).then(function (data) {
        if (transcriptReaderId !== entry.id) return; // reader moved on while we fetched
        if (!hasLearnContent(data)) return;
        renderLearnPanel(transcriptLearnBodyEl, data);
        transcriptLearnBox.style.display = "";
      });
    }

    fetch("transcripts/" + entry.file)
      .then(function (res) { if (!res.ok) throw new Error("fetch failed"); return res.text(); })
      .then(function (raw) {
        if (transcriptReaderId !== entry.id) return;
        transcriptReaderStatusEl.textContent = "";
        transcriptReaderText = stripTranscriptHeader(raw);
        var paragraphs = renderTranscriptBody(transcriptReaderText);
        if (!anchorText) return;
        var hit = findAnchorParagraph(paragraphs, anchorText);
        if (!hit) return;
        hit.classList.add("passage-hit");
        hit.scrollIntoView({ block: "center" });
      })
      .catch(function () {
        transcriptReaderStatusEl.textContent = "Could not load this transcript.";
      });
  }

  // Pure DOM reset of the reader panel — no URL, no navigation. Called by
  // showView on every view change, so no other code has to remember it.
  function hideTranscriptReaderPanel() {
    if (!transcriptReaderEl) return;
    transcriptReaderId = null;
    transcriptReaderText = "";
    transcriptReaderEl.style.display = "none";
    if (transcriptTitleListEl) transcriptTitleListEl.style.display = "";
    if (transcriptListFilterInput) transcriptListFilterInput.style.display = "";
  }

  // "← all transcripts": back to the title list, as a real navigation.
  function closeTranscriptReader() {
    setUrl("/transcripts");
    showView("transcripts");
  }

  function copyTranscriptText() {
    // The paragraph elements drop the blank lines between them, so copy from
    // the raw body we kept when the transcript loaded.
    var text = transcriptReaderText || (transcriptReaderBodyEl ? transcriptReaderBodyEl.textContent : "");
    if (!text) return;
    var showResult = function (ok) {
      if (!transcriptCopyBtn) return;
      transcriptCopyBtn.textContent = ok ? "Copied ✓" : "Copy failed";
      setTimeout(function () { transcriptCopyBtn.textContent = "Copy transcript"; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showResult(true); }, function () { showResult(false); });
      return;
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(textarea);
    showResult(ok);
  }

  if (transcriptCopyBtn) transcriptCopyBtn.addEventListener("click", copyTranscriptText);
  if (transcriptReaderBackBtn) transcriptReaderBackBtn.addEventListener("click", closeTranscriptReader);
  if (transcriptListFilterInput) {
    transcriptListFilterInput.addEventListener("input", renderTranscriptList);
  }
  var episodeList = document.getElementById("episodeList");
  var topicFilterInput = document.getElementById("topicFilter");
  var topicOtherEl = document.getElementById("topicOther");
  var pageSizeSelect = document.getElementById("pageSizeSelect");
  var pagePrevBtn = document.getElementById("pagePrevBtn");
  var pageNextBtn = document.getElementById("pageNextBtn");
  var pageStatusEl = document.getElementById("pageStatus");

  function textMatches(text, query) {
    return !!text && QuizLogic.fuzzyIncludes(text.toLowerCase(), query);
  }

  // ---------- episode list pagination ----------

  var PAGE_SIZES = [5, 10, 50, 100];
  var PAGE_SIZE_KEY = "phil-this-page-size-v1";

  function loadPageSize() {
    var v = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.indexOf(v) !== -1 ? v : 10;
  }

  var currentPageSize = loadPageSize();
  var currentPage = 1;

  if (pageSizeSelect) {
    pageSizeSelect.value = String(currentPageSize);
    pageSizeSelect.addEventListener("change", function () {
      currentPageSize = Number(pageSizeSelect.value);
      localStorage.setItem(PAGE_SIZE_KEY, String(currentPageSize));
      currentPage = 1;
      renderEpisodeList();
    });
  }
  if (pagePrevBtn) {
    pagePrevBtn.addEventListener("click", function () {
      currentPage--;
      renderEpisodeList();
    });
  }
  if (pageNextBtn) {
    pageNextBtn.addEventListener("click", function () {
      currentPage++;
      renderEpisodeList();
    });
  }

  // ---------- learning paths ----------
  // Curriculum arcs from paths.js (optional — with no paths.js the strip stays
  // hidden and the ledger behaves exactly as before). Selecting a path narrows
  // the ledger to that arc's quizzed episodes, in listening order; the text
  // filter and pagination still apply on top of it.

  var pathsStripEl = document.getElementById("pathsStrip");
  var pathBlurbEl = document.getElementById("pathBlurb");
  var selectedPathKey = null;

  function getPaths() {
    return (typeof LEARNING_PATHS !== "undefined" && Array.isArray(LEARNING_PATHS)) ? LEARNING_PATHS : [];
  }

  function selectedPath() {
    if (!selectedPathKey) return null;
    return getPaths().filter(function (p) { return p.key === selectedPathKey; })[0] || null;
  }

  // Of this path's episodes that actually have a quiz, how many has the user
  // passed (some attempt at 80%+ — i.e. 8 of the 10 sampled questions)?
  function pathProgress(path, scores) {
    var covered = getCoveredIds();
    var quizzed = (path.episodes || []).filter(function (id) { return covered[id]; });
    var done = 0;
    quizzed.forEach(function (id) {
      if (episodePassed(scores[String(id)])) done++;
    });
    return { done: done, total: quizzed.length };
  }

  function togglePath(key) {
    selectedPathKey = (key && key !== selectedPathKey) ? key : null;
    currentPage = 1;
    renderEpisodeList();
  }

  function renderPathsStrip(scores) {
    if (!pathsStripEl) return;
    var paths = getPaths();
    pathsStripEl.innerHTML = "";
    if (!paths.length) {
      pathsStripEl.style.display = "none";
      if (pathBlurbEl) pathBlurbEl.style.display = "none";
      return;
    }
    pathsStripEl.style.display = "";

    paths.forEach(function (path) {
      var progress = pathProgress(path, scores);
      if (!progress.total) return; // nothing quizzable in this arc yet
      var isActive = selectedPathKey === path.key;
      var chip = document.createElement("button");
      chip.className = "path-chip" + (isActive ? " active" : "");
      chip.type = "button";
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      chip.addEventListener("click", function () { togglePath(path.key); });

      var title = document.createElement("span");
      title.className = "path-chip-title";
      title.textContent = path.title;
      var count = document.createElement("span");
      count.className = "path-chip-count mono";
      count.textContent = progress.done + "/" + progress.total;
      var track = document.createElement("span");
      track.className = "path-chip-track";
      var fill = document.createElement("span");
      fill.className = "path-chip-fill";
      fill.style.width = ((progress.done / progress.total) * 100) + "%";
      track.appendChild(fill);

      chip.appendChild(title);
      chip.appendChild(count);
      chip.appendChild(track);
      pathsStripEl.appendChild(chip);
    });

    if (!pathBlurbEl) return;
    var path = selectedPath();
    pathBlurbEl.innerHTML = "";
    if (!path) {
      pathBlurbEl.style.display = "none";
      return;
    }
    pathBlurbEl.style.display = "";
    var blurb = document.createElement("span");
    blurb.textContent = path.blurb || "";
    var clear = document.createElement("button");
    clear.className = "search-row-link";
    clear.type = "button";
    clear.textContent = "clear";
    clear.addEventListener("click", function () { togglePath(null); });
    pathBlurbEl.appendChild(blurb);
    pathBlurbEl.appendChild(clear);
  }

  function renderDashboard() {
    renderEpisodeList();
  }

  function renderEpisodeList() {
    var scores = loadScores();
    var progress = loadProgress();
    var query = ((topicFilterInput && topicFilterInput.value) || "").trim().toLowerCase();

    renderPathsStrip(scores);

    episodeList.innerHTML = "";
    var path = selectedPath();
    var sortedEpisodes = path
      ? (path.episodes || []).map(getEpisodeById).filter(Boolean)
      : QUIZ_DATA.slice().sort(function (a, b) { return a.id - b.id; });
    var visibleEpisodes = query
      ? sortedEpisodes.filter(function (ep) { return textMatches(ep.title, query) || textMatches(ep.teaser, query); })
      : sortedEpisodes;

    var totalPages = Math.max(1, Math.ceil(visibleEpisodes.length / currentPageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    var pageStart = (currentPage - 1) * currentPageSize;
    var pageEpisodes = visibleEpisodes.slice(pageStart, pageStart + currentPageSize);

    pageEpisodes.forEach(function (ep) {
      var record = scores[String(ep.id)];
      var inProgress = progress[String(ep.id)];
      var card = document.createElement("div");
      card.className = "ep-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", function () { startQuiz(ep.id); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startQuiz(ep.id); }
      });

      var number = document.createElement("div");
      number.className = "ep-number mono";
      number.textContent = "#" + ep.id;

      var body = document.createElement("div");
      body.className = "ep-body";
      var title = document.createElement("p");
      title.className = "ep-title";
      title.textContent = ep.title;
      var teaser = document.createElement("p");
      teaser.className = "ep-teaser";
      teaser.textContent = ep.teaser;
      body.appendChild(title);
      body.appendChild(teaser);
      // One row of card actions, in the order that matters: the ideas first,
      // the transcript second, the source last. Both boxes expand *below* the
      // row, so a toggle never slides out from under the cursor when it opens.
      var actions = document.createElement("div");
      actions.className = "ep-actions";

      // Inline "Key ideas" shortcut: skim the episode's argument, key ideas,
      // and terms right in the list, without starting the quiz or the reader.
      var learnToggle = document.createElement("button");
      learnToggle.className = "ep-transcript-link ep-learn-toggle mono";
      learnToggle.type = "button";
      learnToggle.textContent = "Key ideas ▾";
      var learnBox = document.createElement("div");
      learnBox.className = "ep-learn";
      learnBox.style.display = "none";
      learnToggle.addEventListener("keydown", function (e) { e.stopPropagation(); });
      learnToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        if (learnBox.style.display !== "none") {
          learnBox.style.display = "none";
          learnToggle.textContent = "Key ideas ▾";
          return;
        }
        learnBox.style.display = "";
        learnToggle.textContent = "Key ideas ▴";
        if (learnBox.hasChildNodes()) return;
        var loading = document.createElement("p");
        loading.className = "ep-learn-status mono";
        loading.textContent = "Loading…";
        learnBox.appendChild(loading);
        fetchLearnData(ep.id).then(function (data) {
          learnBox.innerHTML = "";
          if (!hasLearnContent(data)) {
            var none = document.createElement("p");
            none.className = "ep-learn-status mono";
            none.textContent = "No key ideas for this episode yet.";
            learnBox.appendChild(none);
            return;
          }
          var panel = document.createElement("div");
          panel.className = "learn-panel";
          renderLearnPanel(panel, data);
          learnBox.appendChild(panel);
        });
      });
      learnBox.addEventListener("click", function (e) { e.stopPropagation(); });
      learnBox.addEventListener("keydown", function (e) { e.stopPropagation(); });
      actions.appendChild(learnToggle);

      // Inline "Transcript" shortcut, same pattern as the key-ideas toggle:
      // the full transcript expands in a scrollable box right in the list —
      // deliberately smaller and quieter than the key ideas above it.
      var txBox = null;
      if (ep.transcriptFile) {
        var txToggle = document.createElement("button");
        txToggle.className = "ep-transcript-link ep-learn-toggle mono";
        txToggle.type = "button";
        txToggle.textContent = "Transcript ▾";
        txBox = document.createElement("div");
        txBox.className = "ep-learn";
        txBox.style.display = "none";
        txToggle.addEventListener("keydown", function (e) { e.stopPropagation(); });
        txToggle.addEventListener("click", function (e) {
          e.stopPropagation();
          if (txBox.style.display !== "none") {
            txBox.style.display = "none";
            txToggle.textContent = "Transcript ▾";
            return;
          }
          txBox.style.display = "";
          txToggle.textContent = "Transcript ▴";
          if (txBox.hasChildNodes()) return;
          var loading = document.createElement("p");
          loading.className = "ep-learn-status mono";
          loading.textContent = "Loading…";
          txBox.appendChild(loading);
          fetch(ep.transcriptFile)
            .then(function (res) { if (!res.ok) throw new Error("fetch failed"); return res.text(); })
            .then(function (raw) {
              txBox.innerHTML = "";
              var readerBtn = document.createElement("button");
              readerBtn.className = "search-row-link";
              readerBtn.type = "button";
              readerBtn.textContent = "Open in reader →";
              readerBtn.addEventListener("click", function () {
                var entry = getAllTranscripts().find(function (t) { return t.id === ep.id; });
                if (!entry) return;
                openTranscriptReader(entry);
              });
              var scroll = document.createElement("div");
              scroll.className = "ep-transcript-inline";
              appendTranscriptParagraphs(scroll, stripTranscriptHeader(raw));
              txBox.appendChild(readerBtn);
              txBox.appendChild(scroll);
            })
            .catch(function () {
              txBox.innerHTML = "";
              var failed = document.createElement("p");
              failed.className = "ep-learn-status mono";
              failed.textContent = "Could not load this transcript.";
              txBox.appendChild(failed);
            });
        });
        txBox.addEventListener("click", function (e) { e.stopPropagation(); });
        txBox.addEventListener("keydown", function (e) { e.stopPropagation(); });
        actions.appendChild(txToggle);
      }
      if (ep.url) {
        var originalLink = document.createElement("a");
        originalLink.className = "ep-transcript-link mono";
        originalLink.href = ep.url;
        originalLink.target = "_blank";
        originalLink.rel = "noopener";
        originalLink.textContent = "Original episode ↗";
        originalLink.addEventListener("click", function (e) { e.stopPropagation(); });
        actions.appendChild(originalLink);
      }

      body.appendChild(actions);
      body.appendChild(learnBox);
      if (txBox) body.appendChild(txBox);

      var status = document.createElement("div");
      status.className = "ep-status mono";
      if (inProgress) {
        var badge = document.createElement("span");
        badge.className = "in-progress-badge";
        var progressTotal = Array.isArray(inProgress.sample) && inProgress.sample.length ? inProgress.sample.length : QUIZ_SAMPLE_SIZE;
        badge.textContent = "in progress · Q" + (inProgress.currentIndex + 1) + "/" + progressTotal;
        status.appendChild(badge);
      }
      if (record) {
        var best = bestAttempt(record);
        var bestLine = document.createElement("span");
        if (best) {
          var passedEver = episodePassed(record);
          bestLine.className = "best" + (passedEver ? " perfect" : "");
          bestLine.textContent = best.score + "/" + best.total + (passedEver ? " ✓" : "");
        } else {
          // legacy record with no per-attempt totals
          bestLine.className = "best";
          bestLine.textContent = record.best + "/" + ep.questions.length;
        }
        var attemptsLine = document.createElement("span");
        attemptsLine.textContent = record.attempts.length + (record.attempts.length === 1 ? " attempt" : " attempts");
        status.appendChild(bestLine);
        status.appendChild(attemptsLine);
      } else if (!inProgress) {
        var notTaken = document.createElement("span");
        notTaken.textContent = "not taken";
        status.appendChild(notTaken);
      }

      card.appendChild(number);
      card.appendChild(body);
      card.appendChild(status);
      episodeList.appendChild(card);
    });

    if (query && !visibleEpisodes.length) {
      var noQuizMatch = document.createElement("p");
      noQuizMatch.className = "request-empty";
      noQuizMatch.textContent = "No quizzes match “" + query + "”.";
      episodeList.appendChild(noQuizMatch);
    }

    if (pageStatusEl) {
      pageStatusEl.textContent = visibleEpisodes.length
        ? "Page " + currentPage + " / " + totalPages + " · " + visibleEpisodes.length + (visibleEpisodes.length === 1 ? " episode" : " episodes")
        : "0 episodes";
    }
    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;

    renderTopicOther(query);
  }

  // ---------- topic filter: episodes without a quiz yet ----------

  function renderTopicOther(query) {
    if (!topicOtherEl) return;
    topicOtherEl.innerHTML = "";
    if (!query || typeof EPISODE_INDEX === "undefined") {
      topicOtherEl.style.display = "none";
      return;
    }
    var covered = getCoveredIds();
    var matches = EPISODE_INDEX.filter(function (ep) {
      return !covered[ep.id] && textMatches(ep.label, query);
    });
    if (!matches.length) {
      topicOtherEl.style.display = "none";
      return;
    }
    topicOtherEl.style.display = "";
    var heading = document.createElement("p");
    heading.className = "topic-other-title mono";
    heading.textContent = "Also on “" + query + "” (no quiz yet)";
    topicOtherEl.appendChild(heading);
    matches.forEach(function (ep) {
      var row = document.createElement("div");
      row.className = "topic-other-row";
      var text = document.createElement("span");
      text.textContent = "#" + ep.id + " · " + ep.label;
      var link = document.createElement("a");
      link.className = "search-row-link";
      link.href = "transcripts/" + ep.file;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Read transcript ↗";
      row.appendChild(text);
      row.appendChild(link);
      topicOtherEl.appendChild(row);
    });
  }

  if (topicFilterInput) {
    topicFilterInput.addEventListener("input", function () { currentPage = 1; renderEpisodeList(); });
  }

  // ---------- shared helper: which episode ids already have a quiz ----------

  var coveredIds = null;
  var episodesById = null;

  function getCoveredIds() {
    if (!coveredIds) {
      coveredIds = {};
      QUIZ_DATA.forEach(function (ep) { coveredIds[ep.id] = true; });
    }
    return coveredIds;
  }

  function getEpisodeById(id) {
    if (!episodesById) {
      episodesById = {};
      QUIZ_DATA.forEach(function (ep) { episodesById[ep.id] = ep; });
    }
    return episodesById[id] || null;
  }

  // ---------- transcript search ----------
  // Full-text, typo-tolerant search across every transcript (not just the
  // ones with quizzes). Everything happens in the browser: the first search
  // fetches all 245 transcript files and builds an in-memory index, which every
  // later search in the same visit reuses.

  var transcriptSearchInput = document.getElementById("transcriptSearch");
  var searchStatus = document.getElementById("searchStatus");
  var searchResultsEl = document.getElementById("searchResults");
  var searchDebounceTimer = null;
  var clientTranscriptIndex = null;
  var clientIndexBuilding = false;

  function renderSearchResults(data) {
    searchResultsEl.innerHTML = "";
    var query = data.query || "";
    if (!query) { searchStatus.textContent = ""; return; }
    if (!data.results || !data.results.length) {
      searchStatus.textContent = "No matches for “" + query + "”.";
      return;
    }
    var shown = data.results.length;
    var total = data.totalMatches || shown;
    searchStatus.textContent = shown + (total > shown ? " of " + total : "") +
      (shown === 1 ? " episode matches " : " episodes match ") + "“" + query + "”." +
      (data.fuzzy ? " (no exact hits, showing close/typo matches)" : "");

    var covered = getCoveredIds();
    data.results.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "search-row";

      var head = document.createElement("div");
      head.className = "search-row-head";
      var titleEl = document.createElement("span");
      titleEl.className = "search-row-title";
      titleEl.textContent = "#" + r.id + " · " + r.title;
      var countEl = document.createElement("span");
      countEl.className = "search-row-count mono";
      countEl.textContent = r.fuzzy ? "approximate match" : (r.count + (r.count === 1 ? " match" : " matches"));
      head.appendChild(titleEl);
      head.appendChild(countEl);

      var snippet = document.createElement("p");
      snippet.className = "search-row-snippet";
      snippet.appendChild(document.createTextNode(r.pre + " "));
      var mark = document.createElement("mark");
      mark.textContent = r.match;
      snippet.appendChild(mark);
      snippet.appendChild(document.createTextNode(" " + r.post));

      var actions = document.createElement("div");
      actions.className = "search-row-actions";
      if (covered[r.id]) {
        var quizBtn = document.createElement("button");
        quizBtn.className = "search-row-link";
        quizBtn.type = "button";
        quizBtn.textContent = "Take quiz";
        quizBtn.addEventListener("click", function () { startQuiz(r.id); });
        actions.appendChild(quizBtn);
      }
      var transcriptA = document.createElement("a");
      transcriptA.className = "search-row-link";
      transcriptA.href = "transcripts/" + r.file;
      transcriptA.target = "_blank";
      transcriptA.rel = "noopener";
      transcriptA.textContent = "Read transcript ↗";
      actions.appendChild(transcriptA);

      row.appendChild(head);
      row.appendChild(snippet);
      row.appendChild(actions);
      searchResultsEl.appendChild(row);
    });
  }

  function searchClientSide(query) {
    if (!clientTranscriptIndex) {
      var entries = (typeof EPISODE_INDEX !== "undefined") ? EPISODE_INDEX : [];
      searchStatus.textContent = "Loading all " + entries.length + " transcripts (first search only)…";
      // A build already in flight re-runs whatever the box says when it lands.
      if (clientIndexBuilding) return;
      clientIndexBuilding = true;
      Promise.all(entries.map(function (e) {
        return fetch("transcripts/" + e.file)
          .then(function (r) { return r.ok ? r.text() : ""; })
          .then(function (raw) {
            var lines = raw.split(/\r?\n/);
            var headerEnd = -1;
            for (var i = 0; i < lines.length; i++) {
              if (lines[i].trim() === "---") { headerEnd = i; break; }
            }
            var text = headerEnd >= 0 ? lines.slice(headerEnd + 1).join("\n") : raw;
            var textLower = text.toLowerCase();
            var quizMatch = QUIZ_DATA.filter(function (q) { return q.id === e.id; })[0];
            return {
              id: e.id, file: e.file, title: quizMatch ? quizMatch.title : e.label,
              text: text, textLower: textLower, words: QuizLogic.tokenize(textLower)
            };
          })
          .catch(function () { return null; });
      })).then(function (list) {
        clientTranscriptIndex = list.filter(Boolean);
        clientIndexBuilding = false;
        performSearch(transcriptSearchInput.value);
      });
      return;
    }

    renderSearchResults(QuizLogic.searchTranscripts(clientTranscriptIndex, query, { limit: 50 }));
  }

  function performSearch(rawQuery) {
    var query = (rawQuery || "").trim();
    if (!query) { searchResultsEl.innerHTML = ""; searchStatus.textContent = ""; return; }
    searchStatus.textContent = "Searching…";
    searchClientSide(query);
  }

  if (transcriptSearchInput) {
    transcriptSearchInput.addEventListener("input", function () {
      clearTimeout(searchDebounceTimer);
      var val = transcriptSearchInput.value;
      searchDebounceTimer = setTimeout(function () { performSearch(val); }, 300);
    });
  }

  // ---------- quiz engine ----------

  var currentEpisode = null;
  var currentIndex = 0;
  var currentScore = 0;
  var missed = [];
  var answered = false;

  // Each attempt is a random sample of QUIZ_SAMPLE_SIZE of the episode's 20
  // questions, in shuffled order, with the four options shuffled per question
  // too. currentSample holds ORIGINAL question indices (so passage anchors,
  // keyed by original index, stay correct);
  // currentOptionOrder maps displayed option position -> original position for
  // the question on screen. Passing an attempt means PASS_SCORE or more right.
  var QUIZ_SAMPLE_SIZE = 10;
  var PASS_SCORE = 8;
  var currentSample = [];
  var currentOptionOrder = [0, 1, 2, 3];

  function shuffledRange(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = a[j]; a[j] = a[k]; a[k] = tmp;
    }
    return a;
  }

  function drawSample(episode) {
    return shuffledRange(episode.questions.length).slice(0, Math.min(QUIZ_SAMPLE_SIZE, episode.questions.length));
  }

  // The question object and original index behind the current position.
  function activeQIndex() { return currentSample[currentIndex]; }
  function activeQuestion() { return currentEpisode.questions[activeQIndex()]; }

  // Did any attempt pass (>= 80% right)? Works for both the current 10-question
  // sampled attempts (8/10) and any legacy full-length attempts on record.
  function episodePassed(record) {
    if (!record || !record.attempts) return false;
    return record.attempts.some(function (a) { return a && a.total > 0 && a.score / a.total >= 0.8; });
  }

  // The attempt with the highest ratio, for the "best" line in the ledger.
  function bestAttempt(record) {
    var best = null;
    ((record && record.attempts) || []).forEach(function (a) {
      if (!a || !a.total) return;
      if (!best || a.score / a.total > best.score / best.total) best = a;
    });
    // Legacy records predating per-attempt totals: fall back to best-of-20.
    if (!best && record && typeof record.best === "number") return null;
    return best;
  }

  var qEls = {
    epLabel: document.getElementById("quizEpLabel"),
    progressLabel: document.getElementById("progressLabel"),
    scoreLive: document.getElementById("scoreLive"),
    progressFill: document.getElementById("progressFill"),
    qNumber: document.getElementById("qNumber"),
    questionText: document.getElementById("questionText"),
    options: document.getElementById("options"),
    note: document.getElementById("note"),
    nextRow: document.getElementById("nextRow"),
    nextBtn: document.getElementById("nextBtn"),
    quizBody: document.getElementById("quizBody"),
    results: document.getElementById("results"),
    scoreLine: document.getElementById("scoreLine"),
    scoreLabel: document.getElementById("scoreLabel"),
    passVerdict: document.getElementById("passVerdict"),
    missedWrap: document.getElementById("missedWrap"),
    resultsLearn: document.getElementById("resultsLearn"),
    backBtn: document.getElementById("backBtn"),
    transcriptLink: document.getElementById("quizTranscriptLink"),
    originalLink: document.getElementById("quizOriginalLink"),
    wordcloudLink: document.getElementById("quizWordcloudLink"),
    wordcloudImg: document.getElementById("quizWordcloudImg"),
    retakeBtn: document.getElementById("retakeBtn"),
    doneBtn: document.getElementById("doneBtn"),
    resumeBanner: document.getElementById("resumeBanner"),
    resumeBannerText: document.getElementById("resumeBannerText"),
    resumeRestartBtn: document.getElementById("resumeRestartBtn"),
    learnBox: document.getElementById("quizLearnBox"),
    learnBody: document.getElementById("quizLearnBody"),
    prevBtn: document.getElementById("quizPrevBtn"),
    nextEpBtn: document.getElementById("quizNextBtn")
  };

  // Fills the "Key ideas" box at the top of the quiz view for this episode.
  // Open by default (the ideas are what the quiz is about), collapsible by the
  // reader, and re-opened fresh whenever another episode's quiz starts.
  // Episodes with no learn data simply never show the box.
  function renderQuizLearnBox(episodeId) {
    if (!qEls.learnBox) return;
    qEls.learnBox.style.display = "none";
    if (qEls.learnBody) qEls.learnBody.innerHTML = "";
    fetchLearnData(episodeId).then(function (data) {
      if (!currentEpisode || currentEpisode.id !== episodeId) return; // moved on
      if (!hasLearnContent(data)) return;
      renderLearnPanel(qEls.learnBody, data);
      qEls.learnBox.style.display = "";
    });
  }

  // Returns false when there's no such quiz, so callers (dispatchRoute) can
  // fall back instead of leaving the user on a view that never changed.
  function startQuiz(episodeId, forceRestart) {
    currentEpisode = QUIZ_DATA.find(function (ep) { return ep.id === episodeId; });
    if (!currentEpisode) return false;
    setUrl("/episode/" + episodeId);
    // Warms the learn data too, so passage anchors are ready the moment
    // someone misses a question. A missing file is fine — it caches as "none".
    renderQuizLearnBox(episodeId);

    var cached = !forceRestart ? loadProgress()[String(episodeId)] : null;
    var cachedSampleOk = !!(cached && Array.isArray(cached.sample) && cached.sample.length > 0 &&
      cached.sample.every(function (i) { return typeof i === "number" && i >= 0 && i < currentEpisode.questions.length; }));
    var resumed = !!(cached && cachedSampleOk && cached.currentIndex > 0 && cached.currentIndex < cached.sample.length);
    if (resumed) {
      currentSample = cached.sample;
      currentIndex = cached.currentIndex;
      currentScore = cached.score || 0;
      missed = cached.missed || [];
    } else {
      currentSample = drawSample(currentEpisode);
      currentIndex = 0;
      currentScore = 0;
      missed = [];
      if (forceRestart || cached) clearEpisodeProgress(episodeId);
    }

    showView("quiz");
    qEls.results.classList.remove("show");
    qEls.quizBody.style.display = "";
    qEls.epLabel.textContent = "Episode " + currentEpisode.id + " · " + currentEpisode.title;

    // Prev/next step through quizzed episodes in id order (data.js order is
    // insertion order, not episode order).
    var quizIds = QUIZ_DATA.map(function (ep) { return ep.id; }).sort(function (a, b) { return a - b; });
    var qPos = quizIds.indexOf(currentEpisode.id);
    var prevEp = qPos > 0 ? QUIZ_DATA.find(function (ep) { return ep.id === quizIds[qPos - 1]; }) : null;
    var nextEp = qPos !== -1 && qPos < quizIds.length - 1 ? QUIZ_DATA.find(function (ep) { return ep.id === quizIds[qPos + 1]; }) : null;
    wirePagerButton(qEls.prevBtn, prevEp, "prev", function (n) { startQuiz(n.id); });
    wirePagerButton(qEls.nextEpBtn, nextEp, "next", function (n) { startQuiz(n.id); });

    if (qEls.resumeBanner) {
      if (resumed) {
        qEls.resumeBannerText.textContent = "Resumed at question " + (currentIndex + 1) + " · " + currentScore + " correct so far.";
        qEls.resumeBanner.style.display = "";
      } else {
        qEls.resumeBanner.style.display = "none";
      }
    }

    if (currentEpisode.wordcloud) {
      qEls.wordcloudImg.src = currentEpisode.wordcloud;
      qEls.wordcloudLink.href = currentEpisode.wordcloud;
      qEls.wordcloudLink.style.display = "";
    } else {
      qEls.wordcloudLink.style.display = "none";
    }
    if (currentEpisode.transcriptFile) {
      // href is only the no-JS fallback; the click opens the in-app reader.
      qEls.transcriptLink.href = currentEpisode.transcriptFile;
      qEls.transcriptLink.style.display = "";
    } else {
      qEls.transcriptLink.style.display = "none";
    }
    if (qEls.originalLink) {
      if (currentEpisode.url) {
        qEls.originalLink.href = currentEpisode.url;
        qEls.originalLink.style.display = "";
      } else {
        qEls.originalLink.style.display = "none";
      }
    }
    renderQuestion();
    return true;
  }

  if (qEls.resumeRestartBtn) {
    qEls.resumeRestartBtn.addEventListener("click", function () {
      if (currentEpisode) startQuiz(currentEpisode.id, true);
    });
  }

  function goToDashboard() {
    setUrl("/");
    showView("dashboard");
  }

  function renderQuestion() {
    var item = activeQuestion();
    answered = false;
    var total = currentSample.length;
    qEls.progressLabel.textContent = "§ " + (currentIndex + 1) + " / " + total;
    qEls.scoreLive.textContent = currentScore + " correct so far";
    qEls.progressFill.style.width = ((currentIndex / total) * 100) + "%";
    qEls.qNumber.textContent = String(currentIndex + 1) + ".";
    qEls.questionText.textContent = item.q;
    qEls.note.classList.remove("show");
    qEls.note.innerHTML = "";
    qEls.nextRow.classList.remove("show");

    // Fresh option shuffle each time the question is shown, so neither the
    // authored position nor a remembered layout gives the answer away.
    currentOptionOrder = shuffledRange(item.options.length);

    qEls.options.innerHTML = "";
    currentOptionOrder.forEach(function (origIdx, displayIdx) {
      var btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      var letterEl = document.createElement("span");
      letterEl.className = "letter";
      letterEl.textContent = LETTERS[displayIdx];
      var labelEl = document.createElement("span");
      labelEl.textContent = item.options[origIdx];
      btn.appendChild(letterEl);
      btn.appendChild(labelEl);
      btn.addEventListener("click", function () { selectAnswer(displayIdx); });
      qEls.options.appendChild(btn);
    });
  }

  function selectAnswer(displayIdx) {
    if (answered) return;
    answered = true;
    var item = activeQuestion();
    var origQIndex = activeQIndex();
    var buttons = qEls.options.querySelectorAll(".option");
    var chosenOrig = currentOptionOrder[displayIdx];
    var isCorrect = chosenOrig === item.correct;
    var correctDisplayIdx = currentOptionOrder.indexOf(item.correct);

    if (isCorrect) currentScore++;
    else missed.push({ q: item.q, note: item.note, qIndex: origQIndex });

    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === correctDisplayIdx) b.classList.add("correct");
      else if (i === displayIdx) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    qEls.note.innerHTML = "<strong>" + (isCorrect ? "Right." : "Not quite.") + "</strong> " + item.note;
    qEls.note.classList.add("show");
    if (!isCorrect) {
      var epId = currentEpisode.id;
      var posSnapshot = currentIndex;
      appendPassageLink(qEls.note, epId, origQIndex, function () {
        return answered && !!currentEpisode && currentEpisode.id === epId && currentIndex === posSnapshot;
      });
    }
    qEls.nextRow.classList.add("show");
    qEls.scoreLive.textContent = currentScore + " correct so far";
    qEls.nextBtn.focus();
  }

  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= currentSample.length) {
      finishQuiz();
    } else {
      setEpisodeProgress(currentEpisode.id, { currentIndex: currentIndex, score: currentScore, missed: missed, sample: currentSample });
      renderQuestion();
    }
  }

  var scoreCommentary = QuizLogic.scoreCommentary;

  function finishQuiz() {
    var total = currentSample.length;
    var passed = currentScore >= Math.min(PASS_SCORE, total);
    recordResult(currentEpisode.id, currentScore, total);
    clearEpisodeProgress(currentEpisode.id);

    qEls.quizBody.style.display = "none";
    qEls.results.classList.add("show");
    qEls.scoreLine.textContent = currentScore + " / " + total;
    qEls.scoreLabel.textContent = scoreCommentary(currentScore, total);
    if (qEls.passVerdict) {
      qEls.passVerdict.textContent = passed
        ? "Passed · " + PASS_SCORE + "/" + total + " needed"
        : "Not passed · " + PASS_SCORE + "/" + total + " needed";
      qEls.passVerdict.className = "pass-verdict mono " + (passed ? "pass" : "fail");
    }

    var episodeId = currentEpisode.id;
    var missedRows = [];

    qEls.missedWrap.innerHTML = "";
    if (missed.length) {
      var title = document.createElement("p");
      title.className = "missed-title";
      title.textContent = "Worth revisiting";
      qEls.missedWrap.appendChild(title);
      missed.forEach(function (m) {
        var row = document.createElement("div");
        row.className = "missed-item";
        row.innerHTML = "<div class=\"q\">" + escapeHtml(m.q) + "</div><div>" + m.note + "</div>";
        qEls.missedWrap.appendChild(row);
        // Progress cached before this feature existed has no qIndex; those
        // rows simply don't get a passage link.
        missedRows.push({ row: row, qIndex: m.qIndex });
      });
    }

    if (qEls.resultsLearn) qEls.resultsLearn.innerHTML = "";
    fetchLearnData(episodeId).then(function (data) {
      if (!currentEpisode || currentEpisode.id !== episodeId) return; // moved on
      if (qEls.resultsLearn && hasLearnContent(data)) {
        var learnTitle = document.createElement("p");
        learnTitle.className = "missed-title";
        learnTitle.textContent = "Key ideas from this episode";
        var panel = document.createElement("div");
        panel.className = "learn-panel";
        renderLearnPanel(panel, data);
        qEls.resultsLearn.appendChild(learnTitle);
        qEls.resultsLearn.appendChild(panel);
      }
      missedRows.forEach(function (entry) {
        var anchor = learnAnchor(data, entry.qIndex);
        if (!anchor) return;
        var actions = document.createElement("div");
        actions.className = "note-actions";
        actions.appendChild(makePassageButton(episodeId, anchor));
        entry.row.appendChild(actions);
      });
    });
  }

  qEls.nextBtn.addEventListener("click", nextQuestion);
  qEls.backBtn.addEventListener("click", goToDashboard);
  if (qEls.transcriptLink) {
    qEls.transcriptLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (!currentEpisode) return;
      var entry = getAllTranscripts().find(function (t) { return t.id === currentEpisode.id; });
      if (!entry) return;
      showView("transcripts");
      openTranscriptReader(entry);
    });
  }
  qEls.doneBtn.addEventListener("click", goToDashboard);
  qEls.retakeBtn.addEventListener("click", function () {
    if (currentEpisode) startQuiz(currentEpisode.id, true);
  });

  // ---------- routing ----------
  // Reads the app-relative path (routePath, i.e. location.pathname minus
  // BASE_PATH) on load and on back/forward and opens the matching view. Every
  // branch ends in a showView() (directly, or via startQuiz /
  // openTranscriptReader, which are the same calls the click handlers use), so
  // back and forward always land in a state that matches the URL. Anything
  // unrecognised — a typo'd path, an episode with no quiz, a transcript that
  // isn't in the index — falls back to the dashboard and rewrites the address
  // bar to match. setUrl() no-ops when already at that path, so dispatching a
  // route never double-pushes history.
  function goHome() {
    replaceUrl("/");
    showView("dashboard");
  }

  function dispatchRoute() {
    var pathname = routePath();
    var m = pathname.match(/^\/episode\/(\d+)\/transcript$/);
    if (m) {
      var entry = getAllTranscripts().find(function (e) { return e.id === Number(m[1]); });
      if (entry) openTranscriptReader(entry);
      else goHome();
      return;
    }
    m = pathname.match(/^\/episode\/(\d+)$/);
    if (m) {
      if (!startQuiz(Number(m[1]))) goHome();
      return;
    }
    if (pathname === "/transcripts") { showView("transcripts"); return; }
    if (pathname === "/credit") { showView("credit"); return; }
    if (pathname === "/") { showView("dashboard"); return; }
    goHome();
  }
  window.addEventListener("popstate", dispatchRoute);

  dispatchRoute();
})();
