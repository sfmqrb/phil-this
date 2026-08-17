(function () {
  var STORAGE_KEY = "phil-this-quiz-scores-v1";
  var PROGRESS_KEY = "phil-this-quiz-progress-v1";
  var REVIEW_KEY = "phil-this-quiz-review-v1";
  var LETTERS = ["A", "B", "C", "D"];
  var serverAvailable = false;
  var currentUser = null; // { id, email, name } | null — guests use local-only, unscoped keys

  // Shareable URLs: /episode/N opens that episode's quiz, /episode/N/transcript
  // opens its transcript, /transcripts and /credit open those tabs. setUrl no-ops
  // when already at that path, so calling it from both a click handler and from
  // the initial route dispatch (below) never creates a duplicate history entry.
  function setUrl(path) {
    if (location.pathname !== path) history.pushState(null, "", path);
  }

  // Rewrites the address bar without adding a history entry — used when a URL
  // points at something that isn't there any more (an episode with no quiz, a
  // typo'd path), so the bar always agrees with the view we fell back to.
  function replaceUrl(path) {
    if (location.pathname !== path) history.replaceState(null, "", path);
  }

  // Every browser-storage key is namespaced per signed-in account, so two
  // people sharing a machine (or a guest, then an account) never see each
  // other's scores/requests/in-progress quizzes.
  function scopedKey(base) {
    return currentUser ? base + ":u" + currentUser.id : base;
  }

  function readJson(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function loadScores() { return readJson(scopedKey(STORAGE_KEY), {}); }
  function writeScoresLocal(scores) { localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(scores)); }

  function recordResult(episodeId, score, total) {
    var scores = loadScores();
    var record = QuizLogic.applyResult(scores, episodeId, score, total);
    writeScoresLocal(scores);
    pushStoreToServer();
    return record;
  }

  // ---------- spaced-repetition review deck ----------
  // { "<epId>:<qIndex>": { stage, due, lapses, added } } — every question
  // answered wrong lands here and comes back on a widening schedule.

  function loadReview() { return readJson(scopedKey(REVIEW_KEY), {}); }
  function writeReviewLocal(deck) { localStorage.setItem(scopedKey(REVIEW_KEY), JSON.stringify(deck)); }

  // In-progress review session, so a refresh mid-session resumes where you
  // were instead of dropping you back to the deck status.
  // { keys: ["epId:qIndex", ...], index, score }
  var REVIEW_SESSION_KEY = "phil-this-quiz-review-session-v1";
  function loadReviewSession() { return readJson(scopedKey(REVIEW_SESSION_KEY), null); }
  function writeReviewSession(state) { localStorage.setItem(scopedKey(REVIEW_SESSION_KEY), JSON.stringify(state)); }
  function clearReviewSession() { localStorage.removeItem(scopedKey(REVIEW_SESSION_KEY)); }

  // Grades one answer into the deck (from the quiz or a review session) and
  // persists it locally + upstream.
  function recordReviewAnswer(episodeId, qIndex, isCorrect) {
    var deck = loadReview();
    QuizLogic.applyReviewAnswer(deck, episodeId, qIndex, isCorrect, new Date().toISOString());
    writeReviewLocal(deck);
    pushReviewToServer();
    refreshReviewBadge();
    return deck;
  }

  // ---------- in-progress ("half-taken") quiz cache ----------

  function loadProgress() { return readJson(scopedKey(PROGRESS_KEY), {}); }
  function writeProgressLocal(all) { localStorage.setItem(scopedKey(PROGRESS_KEY), JSON.stringify(all)); }

  function setEpisodeProgress(episodeId, data) {
    var all = loadProgress();
    all[String(episodeId)] = data;
    writeProgressLocal(all);
    if (currentUser && typeof fetch === "function") {
      fetch("/api/progress", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episodeId, currentIndex: data.currentIndex, score: data.score, missed: data.missed })
      }).catch(function () {});
    }
  }

  function clearEpisodeProgress(episodeId) {
    var all = loadProgress();
    delete all[String(episodeId)];
    writeProgressLocal(all);
    if (currentUser && typeof fetch === "function") {
      fetch("/api/progress/" + episodeId, { method: "DELETE", credentials: "same-origin" }).catch(function () {});
    }
  }

  // ---------- accounts + server sync ----------
  // Guests are fully local (localStorage only, exactly like the original
  // single-device version). Signing in makes the server the source of truth:
  // on login/register the server's copy overwrites local storage, and every
  // mutation afterward is pushed back up under that account.

  function pushStoreToServer() {
    if (!currentUser || typeof fetch !== "function") return;
    fetch("/api/store", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: loadScores() })
    }).catch(function () {});
  }

  function pushReviewToServer() {
    if (!currentUser || typeof fetch !== "function") return;
    fetch("/api/review", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: loadReview() })
    }).catch(function () {});
  }

  function fetchMe() {
    if (typeof fetch !== "function") return Promise.resolve(null);
    return fetch("/api/auth/me", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("no server"); return r.json(); })
      .then(function (data) { serverAvailable = true; return data.user || null; })
      .catch(function () { serverAvailable = false; return null; });
  }

  function hydrateStoreFromServer() {
    if (!currentUser || typeof fetch !== "function") return Promise.resolve();
    return fetch("/api/store", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("store fetch failed"); return r.json(); })
      .then(function (data) {
        writeScoresLocal(data.scores || {});
        writeProgressLocal(data.progress || {});
        // The deck merges instead of overwriting: a server that predates the
        // review feature (or that missed our pushes while it was down) must
        // not wipe the local deck on every refresh. Server wins per entry;
        // entries it doesn't know about survive and get pushed back up.
        if (data.review && typeof data.review === "object") {
          var localDeck = loadReview();
          var merged = Object.assign({}, localDeck, data.review);
          writeReviewLocal(merged);
          var onlyLocal = Object.keys(localDeck).some(function (k) { return !(k in data.review); });
          if (onlyLocal) pushReviewToServer();
        }
      })
      .catch(function () {});
  }

  var pct = QuizLogic.pct;
  var escapeHtml = QuizLogic.escapeHtml;

  // ---------- account bar ----------

  var accountGuestEl = document.getElementById("accountGuest");
  var accountSignedInEl = document.getElementById("accountSignedIn");
  var accountNameEl = document.getElementById("accountName");
  var accountEmailEl = document.getElementById("accountEmail");
  var showLoginBtn = document.getElementById("showLoginBtn");
  var showRegisterBtn = document.getElementById("showRegisterBtn");
  var showProfileBtn = document.getElementById("showProfileBtn");
  var logoutBtn = document.getElementById("logoutBtn");

  var loginForm = document.getElementById("loginForm");
  var loginEmailInput = document.getElementById("loginEmail");
  var loginPasswordInput = document.getElementById("loginPassword");
  var loginErrorEl = document.getElementById("loginError");
  var loginCancelBtn = document.getElementById("loginCancelBtn");

  var registerForm = document.getElementById("registerForm");
  var registerNameInput = document.getElementById("registerName");
  var registerEmailInput = document.getElementById("registerEmail");
  var registerPasswordInput = document.getElementById("registerPassword");
  var registerErrorEl = document.getElementById("registerError");
  var registerCancelBtn = document.getElementById("registerCancelBtn");

  var profileForm = document.getElementById("profileForm");
  var profileNameInput = document.getElementById("profileName");
  var profileEmailInput = document.getElementById("profileEmail");
  var profileCurrentPasswordInput = document.getElementById("profileCurrentPassword");
  var profileNewPasswordInput = document.getElementById("profileNewPassword");
  var profileErrorEl = document.getElementById("profileError");
  var profileSuccessEl = document.getElementById("profileSuccess");
  var profileCancelBtn = document.getElementById("profileCancelBtn");

  function hideAllAccountForms() {
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "none";
    if (profileForm) profileForm.style.display = "none";
    if (loginErrorEl) loginErrorEl.textContent = "";
    if (registerErrorEl) registerErrorEl.textContent = "";
    if (profileErrorEl) profileErrorEl.textContent = "";
    if (profileSuccessEl) profileSuccessEl.textContent = "";
  }

  function renderAccountBar() {
    if (!accountGuestEl) return;
    if (currentUser) {
      accountGuestEl.style.display = "none";
      accountSignedInEl.style.display = "";
      accountNameEl.textContent = currentUser.name;
      accountEmailEl.textContent = currentUser.email;
    } else {
      accountGuestEl.style.display = "";
      accountSignedInEl.style.display = "none";
      hideAllAccountForms();
    }
  }

  function onAuthSuccess(user) {
    currentUser = user;
    renderAccountBar();
    hideAllAccountForms();
    hydrateStoreFromServer().then(renderDashboard);
  }

  function jsonFetch(url, options) {
    return fetch(url, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, data: data };
      });
    });
  }

  if (showLoginBtn) showLoginBtn.addEventListener("click", function () { hideAllAccountForms(); loginForm.style.display = ""; loginEmailInput.focus(); });
  if (showRegisterBtn) showRegisterBtn.addEventListener("click", function () { hideAllAccountForms(); registerForm.style.display = ""; registerNameInput.focus(); });
  if (showProfileBtn) showProfileBtn.addEventListener("click", function () {
    hideAllAccountForms();
    profileNameInput.value = currentUser.name;
    profileEmailInput.value = currentUser.email;
    profileCurrentPasswordInput.value = "";
    profileNewPasswordInput.value = "";
    profileForm.style.display = "";
  });
  if (loginCancelBtn) loginCancelBtn.addEventListener("click", hideAllAccountForms);
  if (registerCancelBtn) registerCancelBtn.addEventListener("click", hideAllAccountForms);
  if (profileCancelBtn) profileCancelBtn.addEventListener("click", hideAllAccountForms);

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      loginErrorEl.textContent = "";
      jsonFetch("/api/auth/login", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmailInput.value, password: loginPasswordInput.value })
      }).then(function (res) {
        if (!res.ok) { loginErrorEl.textContent = res.data.error || "Sign in failed."; return; }
        loginForm.reset();
        onAuthSuccess(res.data.user);
      }).catch(function () { loginErrorEl.textContent = "Network error. Is the server running?"; });
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      registerErrorEl.textContent = "";
      jsonFetch("/api/auth/register", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerEmailInput.value, name: registerNameInput.value, password: registerPasswordInput.value })
      }).then(function (res) {
        if (!res.ok) { registerErrorEl.textContent = res.data.error || "Could not create account."; return; }
        registerForm.reset();
        onAuthSuccess(res.data.user);
      }).catch(function () { registerErrorEl.textContent = "Network error. Is the server running?"; });
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      profileErrorEl.textContent = "";
      profileSuccessEl.textContent = "";
      var body = { name: profileNameInput.value, email: profileEmailInput.value };
      if (profileNewPasswordInput.value) {
        body.currentPassword = profileCurrentPasswordInput.value;
        body.newPassword = profileNewPasswordInput.value;
      }
      jsonFetch("/api/auth/me", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) { profileErrorEl.textContent = res.data.error || "Could not save changes."; return; }
        currentUser = res.data.user;
        renderAccountBar();
        profileSuccessEl.textContent = "Saved.";
        profileCurrentPasswordInput.value = "";
        profileNewPasswordInput.value = "";
      }).catch(function () { profileErrorEl.textContent = "Network error. Is the server running?"; });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(function () {}).then(function () {
        currentUser = null;
        renderAccountBar();
        renderDashboard();
      });
    });
  }

  // ---------- the one navigation function ----------
  // Five top-level views live in index.html, all hidden by CSS until they get
  // the "show" class. showView() is the ONLY place in this file that touches
  // those classes: it hides all five, shows exactly one, syncs the tab strip
  // (Episodes stays lit for both the dashboard and a quiz, since a quiz is an
  // episode you opened), scrolls back to the top, and refreshes whatever that
  // view renders. Every entry point — tab clicks, startQuiz, goToDashboard,
  // passage links, "Take quiz" buttons, the review session, dispatchRoute —
  // goes through it, so the visible view can never drift from the URL.

  var dashboardView = document.getElementById("dashboardView");
  var quizView = document.getElementById("quizView");
  var transcriptsView = document.getElementById("transcriptsView");
  var reviewView = document.getElementById("reviewView");
  var creditView = document.getElementById("creditView");
  var tabEpisodesBtn = document.getElementById("tabEpisodesBtn");
  var tabTranscriptsBtn = document.getElementById("tabTranscriptsBtn");
  var tabReviewBtn = document.getElementById("tabReviewBtn");
  var tabCreditBtn = document.getElementById("tabCreditBtn");

  // ---------- theme toggle ----------
  // Three states cycling system → light → dark. An explicit choice sets
  // data-theme on <html> and persists (device-level, deliberately not scoped
  // per account); "system" clears both so prefers-color-scheme decides. The
  // inline <head> script re-applies the saved choice before first paint.
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

  var VIEW_ORDER = ["dashboard", "quiz", "transcripts", "review", "credit"];
  var currentViewName = null;

  function viewContainer(name) {
    if (name === "dashboard") return dashboardView;
    if (name === "quiz") return quizView;
    if (name === "transcripts") return transcriptsView;
    if (name === "review") return reviewView;
    if (name === "credit") return creditView;
    return null;
  }

  function viewTab(name) {
    if (name === "dashboard" || name === "quiz") return tabEpisodesBtn;
    if (name === "transcripts") return tabTranscriptsBtn;
    if (name === "review") return tabReviewBtn;
    if (name === "credit") return tabCreditBtn;
    return null;
  }

  function showView(name) {
    var target = VIEW_ORDER.indexOf(name) === -1 ? "dashboard" : name;
    var activeTab = viewTab(target);
    var changed = currentViewName !== target;

    VIEW_ORDER.forEach(function (key) {
      var el = viewContainer(key);
      if (!el) return;
      if (key === target) el.classList.add("show");
      else el.classList.remove("show");
    });
    [tabEpisodesBtn, tabTranscriptsBtn, tabReviewBtn, tabCreditBtn].forEach(function (tab) {
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
    // A half-finished review session survives a trip to another tab; only a
    // view with no session running falls back to the deck summary.
    if (target === "review" && !reviewSessionActive) renderReviewStatus();
  }

  if (tabEpisodesBtn) tabEpisodesBtn.addEventListener("click", function () { setUrl("/"); showView("dashboard"); });
  if (tabTranscriptsBtn) tabTranscriptsBtn.addEventListener("click", function () { setUrl("/transcripts"); showView("transcripts"); });
  if (tabReviewBtn) tabReviewBtn.addEventListener("click", function () { setUrl("/review"); showView("review"); });
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

  // Fills a container with the argument / key ideas / terms block. Everything
  // goes in as text — learn data is never treated as HTML.
  function renderLearnPanel(container, data) {
    if (!container) return;
    container.innerHTML = "";
    if (!data) return;

    if (data.argument) {
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
    transcriptReaderLinkEl.href = "../transcripts/" + entry.file;
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
      transcriptLearnBox.open = true;
      if (transcriptLearnBodyEl) transcriptLearnBodyEl.innerHTML = "";
      fetchLearnData(entry.id).then(function (data) {
        if (transcriptReaderId !== entry.id) return; // reader moved on while we fetched
        if (!hasLearnContent(data)) return;
        renderLearnPanel(transcriptLearnBodyEl, data);
        transcriptLearnBox.style.display = "";
      });
    }

    fetch("../transcripts/" + entry.file)
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
        transcriptReaderStatusEl.textContent = "Could not load this transcript. Is the server still running?";
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
  var PATH_PASS_RATIO = 0.7;

  function getPaths() {
    return (typeof LEARNING_PATHS !== "undefined" && Array.isArray(LEARNING_PATHS)) ? LEARNING_PATHS : [];
  }

  function selectedPath() {
    if (!selectedPathKey) return null;
    return getPaths().filter(function (p) { return p.key === selectedPathKey; })[0] || null;
  }

  // Of this path's episodes that actually have a quiz, how many has the user
  // passed (best score >= 70%)?
  function pathProgress(path, scores) {
    var covered = getCoveredIds();
    var quizzed = (path.episodes || []).filter(function (id) { return covered[id]; });
    var done = 0;
    quizzed.forEach(function (id) {
      var record = scores[String(id)];
      var episode = getEpisodeById(id);
      if (!record || !episode || !episode.questions.length) return;
      if (record.best / episode.questions.length >= PATH_PASS_RATIO) done++;
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
    refreshReviewBadge();
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
              failed.textContent = "Could not load this transcript. Is the server still running?";
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
        badge.textContent = "in progress · Q" + (inProgress.currentIndex + 1) + "/" + ep.questions.length;
        status.appendChild(badge);
      }
      if (record) {
        var p = pct(record.best, ep.questions.length);
        var bestLine = document.createElement("span");
        bestLine.className = "best" + (p === 100 ? " perfect" : "");
        bestLine.textContent = record.best + "/" + ep.questions.length;
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
      link.href = "../transcripts/" + ep.file;
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
  // ones with quizzes). Uses the server's /api/search when available (fast —
  // the server indexes all 245 files at startup); falls back to fetching and
  // caching transcripts client-side when the app is opened via file://.

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
      transcriptA.href = "../transcripts/" + r.file;
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
      if (clientIndexBuilding) return;
      clientIndexBuilding = true;
      searchStatus.textContent = "Loading all transcripts for offline search (first search only)…";
      var entries = (typeof EPISODE_INDEX !== "undefined") ? EPISODE_INDEX : [];
      Promise.all(entries.map(function (e) {
        return fetch("../transcripts/" + e.file)
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
    if (serverAvailable) {
      fetch("/api/search?q=" + encodeURIComponent(query))
        .then(function (r) { return r.json(); })
        .then(renderSearchResults)
        .catch(function () { searchStatus.textContent = "Search failed. Is the server still running?"; });
    } else {
      searchClientSide(query);
    }
  }

  if (transcriptSearchInput) {
    transcriptSearchInput.addEventListener("input", function () {
      clearTimeout(searchDebounceTimer);
      var val = transcriptSearchInput.value;
      searchDebounceTimer = setTimeout(function () { performSearch(val); }, 300);
    });
  }

  // ---------- review tab: spaced-repetition sessions ----------
  // The deck fills up from wrong answers anywhere in the app. A session takes
  // whatever is due, re-asks it in a shuffled order, and re-grades it through
  // the same ladder, so a question only leaves your rotation by being right
  // several times over.

  var REVIEW_SESSION_MAX = 20;

  var rEls = {
    badge: document.getElementById("reviewDueBadge"),
    status: document.getElementById("reviewStatus"),
    startRow: document.getElementById("reviewStartRow"),
    startBtn: document.getElementById("reviewStartBtn"),
    resumeRow: document.getElementById("reviewResumeRow"),
    resumeText: document.getElementById("reviewResumeText"),
    resumeBtn: document.getElementById("reviewResumeBtn"),
    resumeDiscardBtn: document.getElementById("reviewResumeDiscardBtn"),
    session: document.getElementById("reviewSession"),
    progressLabel: document.getElementById("reviewProgressLabel"),
    scoreLive: document.getElementById("reviewScoreLive"),
    progressFill: document.getElementById("reviewProgressFill"),
    source: document.getElementById("reviewSource"),
    questionText: document.getElementById("reviewQuestionText"),
    options: document.getElementById("reviewOptions"),
    note: document.getElementById("reviewNote"),
    nextRow: document.getElementById("reviewNextRow"),
    nextBtn: document.getElementById("reviewNextBtn"),
    results: document.getElementById("reviewResults"),
    scoreLine: document.getElementById("reviewScoreLine"),
    scoreLabel: document.getElementById("reviewScoreLabel"),
    backBtn: document.getElementById("reviewBackBtn")
  };

  var reviewQueue = [];
  var reviewIndex = 0;
  var reviewScore = 0;
  var reviewAnswered = false;
  var reviewSessionActive = false; // a running session survives a trip to another tab

  function refreshReviewBadge() {
    if (!rEls.badge) return;
    var counts = QuizLogic.reviewCounts(loadReview(), new Date().toISOString());
    rEls.badge.textContent = String(counts.due);
    rEls.badge.style.display = counts.due ? "" : "none";
  }

  // One line about the soonest entry that isn't due yet.
  function nextDueLine(deck) {
    var now = Date.now();
    var soonest = null;
    Object.keys(deck).forEach(function (key) {
      var entry = deck[key];
      if (!entry || !entry.due) return;
      var when = new Date(entry.due).getTime();
      if (when <= now) return;
      if (soonest === null || when < soonest) soonest = when;
    });
    if (soonest === null) return "Nothing is scheduled ahead — your deck is clear.";
    var days = Math.max(1, Math.ceil((soonest - now) / (24 * 60 * 60 * 1000)));
    return days === 1 ? "The next question comes due tomorrow." : "The next question comes due in " + days + " days.";
  }

  // The cached session, but only if it still has unanswered questions that
  // resolve against the current quiz bank; anything stale is cleared.
  function pendingReviewSession() {
    var cached = loadReviewSession();
    if (!cached || !Array.isArray(cached.keys)) return null;
    var index = Number(cached.index) || 0;
    if (index >= cached.keys.length) { clearReviewSession(); return null; }
    var remaining = cached.keys.slice(index).filter(function (key) {
      var parsed = QuizLogic.parseReviewKey(key);
      var episode = parsed && QUIZ_DATA.find(function (ep) { return ep.id === parsed.epId; });
      return !!(episode && episode.questions[parsed.qIndex]);
    });
    if (!remaining.length) { clearReviewSession(); return null; }
    return cached;
  }

  function renderReviewStatus() {
    refreshReviewBadge();
    reviewSessionActive = false;
    if (rEls.session) rEls.session.style.display = "none";
    if (rEls.results) rEls.results.classList.remove("show");
    var deck = loadReview();
    var counts = QuizLogic.reviewCounts(deck, new Date().toISOString());
    if (rEls.status) {
      if (!counts.total) {
        rEls.status.textContent = "Your deck is empty. Miss a question in any quiz and it lands here, then comes back until it sticks.";
      } else if (counts.due) {
        rEls.status.textContent = counts.due + " due now · " + counts.total + " in your deck.";
      } else {
        rEls.status.textContent = "0 due now · " + counts.total + " in your deck. " + nextDueLine(deck);
      }
    }
    var cached = pendingReviewSession();
    if (rEls.resumeRow) {
      if (cached) {
        rEls.resumeText.textContent = "Session in progress · question " + ((Number(cached.index) || 0) + 1) +
          " of " + cached.keys.length + " · " + (Number(cached.score) || 0) + " correct so far.";
        rEls.resumeRow.style.display = "";
      } else {
        rEls.resumeRow.style.display = "none";
      }
    }
    if (rEls.startRow) rEls.startRow.style.display = counts.due && !cached ? "" : "none";
  }

  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = out[i];
      out[i] = out[j];
      out[j] = swap;
    }
    return out;
  }

  function startReviewSession() {
    var deck = loadReview();
    var due = QuizLogic.dueReviewEntries(deck, new Date().toISOString());
    var resolved = [];
    var pruned = false;
    due.forEach(function (entry) {
      var episode = QUIZ_DATA.find(function (ep) { return ep.id === entry.epId; });
      var question = episode && episode.questions[entry.qIndex];
      // The quiz bank grows and changes under decks built weeks earlier, so
      // quietly drop anything that no longer resolves to a real question.
      if (!question) { delete deck[entry.key]; pruned = true; return; }
      resolved.push({ epId: entry.epId, qIndex: entry.qIndex, episode: episode, question: question });
    });
    if (pruned) {
      writeReviewLocal(deck);
      pushReviewToServer();
    }
    if (!resolved.length) { renderReviewStatus(); return; }

    reviewQueue = shuffled(resolved).slice(0, REVIEW_SESSION_MAX);
    reviewIndex = 0;
    reviewScore = 0;
    saveReviewSessionState();
    showReviewSessionUi();
  }

  function saveReviewSessionState() {
    writeReviewSession({
      keys: reviewQueue.map(function (item) { return QuizLogic.reviewKey(item.epId, item.qIndex); }),
      index: reviewIndex,
      score: reviewScore
    });
  }

  function showReviewSessionUi() {
    reviewSessionActive = true;
    setUrl("/review");
    showView("review");
    if (rEls.results) rEls.results.classList.remove("show");
    if (rEls.startRow) rEls.startRow.style.display = "none";
    if (rEls.resumeRow) rEls.resumeRow.style.display = "none";
    if (rEls.status) {
      rEls.status.textContent = reviewQueue.length + (reviewQueue.length === 1 ? " question" : " questions") + " in this session.";
    }
    if (rEls.session) rEls.session.style.display = "";
    renderReviewQuestion();
  }

  // Rebuilds the queue a refresh threw away. Questions that no longer resolve
  // are dropped; the position shifts down by however many disappeared before it.
  function resumeReviewSession() {
    var cached = pendingReviewSession();
    if (!cached) { renderReviewStatus(); return; }
    var savedIndex = Number(cached.index) || 0;
    var queue = [];
    var index = savedIndex;
    cached.keys.forEach(function (key, i) {
      var parsed = QuizLogic.parseReviewKey(key);
      var episode = parsed && QUIZ_DATA.find(function (ep) { return ep.id === parsed.epId; });
      var question = episode && episode.questions[parsed.qIndex];
      if (!question) {
        if (i < savedIndex) index--;
        return;
      }
      queue.push({ epId: parsed.epId, qIndex: parsed.qIndex, episode: episode, question: question });
    });
    if (index >= queue.length) { clearReviewSession(); renderReviewStatus(); return; }
    reviewQueue = queue;
    reviewIndex = index;
    reviewScore = Number(cached.score) || 0;
    saveReviewSessionState();
    showReviewSessionUi();
  }

  function renderReviewQuestion() {
    var item = reviewQueue[reviewIndex];
    reviewAnswered = false;
    var total = reviewQueue.length;
    if (rEls.progressLabel) rEls.progressLabel.textContent = "§ " + (reviewIndex + 1) + " / " + total;
    if (rEls.scoreLive) rEls.scoreLive.textContent = reviewScore + " correct so far";
    if (rEls.progressFill) rEls.progressFill.style.width = ((reviewIndex / total) * 100) + "%";
    if (rEls.source) rEls.source.textContent = "from #" + item.episode.id + " · " + item.episode.title;
    if (rEls.questionText) rEls.questionText.textContent = item.question.q;
    if (rEls.note) { rEls.note.classList.remove("show"); rEls.note.innerHTML = ""; }
    if (rEls.nextRow) rEls.nextRow.classList.remove("show");
    if (!rEls.options) return;

    rEls.options.innerHTML = "";
    item.question.options.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      var letterEl = document.createElement("span");
      letterEl.className = "letter";
      letterEl.textContent = LETTERS[idx];
      var labelEl = document.createElement("span");
      labelEl.textContent = opt;
      btn.appendChild(letterEl);
      btn.appendChild(labelEl);
      btn.addEventListener("click", function () { selectReviewAnswer(idx); });
      rEls.options.appendChild(btn);
    });
  }

  function selectReviewAnswer(idx) {
    if (reviewAnswered) return;
    reviewAnswered = true;
    var item = reviewQueue[reviewIndex];
    var isCorrect = idx === item.question.correct;

    if (isCorrect) reviewScore++;

    if (rEls.options) {
      var buttons = rEls.options.querySelectorAll(".option");
      buttons.forEach(function (b, i) {
        b.disabled = true;
        if (i === item.question.correct) b.classList.add("correct");
        else if (i === idx) b.classList.add("wrong");
        else b.classList.add("dim");
      });
    }

    recordReviewAnswer(item.epId, item.qIndex, isCorrect);
    // Persist the position so a refresh resumes at the next unanswered
    // question; the last answer clears the cache instead.
    if (reviewIndex + 1 >= reviewQueue.length) {
      clearReviewSession();
    } else {
      writeReviewSession({
        keys: reviewQueue.map(function (q) { return QuizLogic.reviewKey(q.epId, q.qIndex); }),
        index: reviewIndex + 1,
        score: reviewScore
      });
    }

    if (rEls.note) {
      rEls.note.innerHTML = "<strong>" + (isCorrect ? "Right." : "Not quite.") + "</strong> " + item.question.note;
      rEls.note.classList.add("show");
      appendPassageLink(rEls.note, item.epId, item.qIndex, function () {
        return reviewAnswered && reviewQueue[reviewIndex] === item;
      });
    }
    if (rEls.nextRow) rEls.nextRow.classList.add("show");
    if (rEls.scoreLive) rEls.scoreLive.textContent = reviewScore + " correct so far";
    if (rEls.nextBtn) rEls.nextBtn.focus();
  }

  function nextReviewQuestion() {
    reviewIndex++;
    if (reviewIndex >= reviewQueue.length) {
      finishReviewSession();
    } else {
      renderReviewQuestion();
    }
  }

  function finishReviewSession() {
    clearReviewSession();
    reviewSessionActive = false;
    if (rEls.session) rEls.session.style.display = "none";
    if (rEls.results) rEls.results.classList.add("show");
    if (rEls.scoreLine) rEls.scoreLine.textContent = reviewScore + " / " + reviewQueue.length;
    if (rEls.scoreLabel) rEls.scoreLabel.textContent = nextDueLine(loadReview());
    refreshReviewBadge();
  }

  if (rEls.startBtn) rEls.startBtn.addEventListener("click", startReviewSession);
  if (rEls.nextBtn) rEls.nextBtn.addEventListener("click", nextReviewQuestion);
  if (rEls.backBtn) rEls.backBtn.addEventListener("click", renderReviewStatus);
  if (rEls.resumeBtn) rEls.resumeBtn.addEventListener("click", resumeReviewSession);
  if (rEls.resumeDiscardBtn) rEls.resumeDiscardBtn.addEventListener("click", function () {
    clearReviewSession();
    renderReviewStatus();
  });

  // ---------- quiz engine ----------

  var currentEpisode = null;
  var currentIndex = 0;
  var currentScore = 0;
  var missed = [];
  var answered = false;

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
    qEls.learnBox.open = true;
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
    var resumed = !!(cached && cached.currentIndex > 0 && cached.currentIndex < currentEpisode.questions.length);
    if (resumed) {
      currentIndex = cached.currentIndex;
      currentScore = cached.score || 0;
      missed = cached.missed || [];
    } else {
      currentIndex = 0;
      currentScore = 0;
      missed = [];
      if (forceRestart) clearEpisodeProgress(episodeId);
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
    var item = currentEpisode.questions[currentIndex];
    answered = false;
    var total = currentEpisode.questions.length;
    qEls.progressLabel.textContent = "§ " + (currentIndex + 1) + " / " + total;
    qEls.scoreLive.textContent = currentScore + " correct so far";
    qEls.progressFill.style.width = ((currentIndex / total) * 100) + "%";
    qEls.qNumber.textContent = String(currentIndex + 1) + ".";
    qEls.questionText.textContent = item.q;
    qEls.note.classList.remove("show");
    qEls.note.innerHTML = "";
    qEls.nextRow.classList.remove("show");

    qEls.options.innerHTML = "";
    item.options.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      var letterEl = document.createElement("span");
      letterEl.className = "letter";
      letterEl.textContent = LETTERS[idx];
      var labelEl = document.createElement("span");
      labelEl.textContent = opt;
      btn.appendChild(letterEl);
      btn.appendChild(labelEl);
      btn.addEventListener("click", function () { selectAnswer(idx); });
      qEls.options.appendChild(btn);
    });
  }

  function selectAnswer(idx) {
    if (answered) return;
    answered = true;
    var item = currentEpisode.questions[currentIndex];
    var buttons = qEls.options.querySelectorAll(".option");
    var isCorrect = idx === item.correct;

    if (isCorrect) currentScore++;
    else missed.push({ q: item.q, note: item.note, qIndex: currentIndex });

    // A miss enrols this question in the review deck; a hit on a question
    // already enrolled moves it one rung up the spaced-repetition ladder.
    recordReviewAnswer(currentEpisode.id, currentIndex, isCorrect);

    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === item.correct) b.classList.add("correct");
      else if (i === idx) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    qEls.note.innerHTML = "<strong>" + (isCorrect ? "Right." : "Not quite.") + "</strong> " + item.note;
    qEls.note.classList.add("show");
    if (!isCorrect) {
      var epId = currentEpisode.id;
      var qIdx = currentIndex;
      appendPassageLink(qEls.note, epId, qIdx, function () {
        return answered && !!currentEpisode && currentEpisode.id === epId && currentIndex === qIdx;
      });
    }
    qEls.nextRow.classList.add("show");
    qEls.scoreLive.textContent = currentScore + " correct so far";
    qEls.nextBtn.focus();
  }

  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= currentEpisode.questions.length) {
      finishQuiz();
    } else {
      setEpisodeProgress(currentEpisode.id, { currentIndex: currentIndex, score: currentScore, missed: missed });
      renderQuestion();
    }
  }

  var scoreCommentary = QuizLogic.scoreCommentary;

  function finishQuiz() {
    var total = currentEpisode.questions.length;
    recordResult(currentEpisode.id, currentScore, total);
    clearEpisodeProgress(currentEpisode.id);

    qEls.quizBody.style.display = "none";
    qEls.results.classList.add("show");
    qEls.scoreLine.textContent = currentScore + " / " + total;
    qEls.scoreLabel.textContent = scoreCommentary(currentScore, total);

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
  // Reads location.pathname on load and on back/forward and opens the matching
  // view. Every branch ends in a showView() (directly, or via startQuiz /
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
    var pathname = location.pathname.replace(/\/+$/, "") || "/";
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
    if (pathname === "/review") { showView("review"); return; }
    if (pathname === "/credit") { showView("credit"); return; }
    if (pathname === "/") { showView("dashboard"); return; }
    goHome();
  }
  window.addEventListener("popstate", dispatchRoute);

  fetchMe().then(function (user) {
    currentUser = user;
    renderAccountBar();
    return currentUser ? hydrateStoreFromServer() : null;
  }).then(function () {
    refreshReviewBadge(); // the tab badge is on screen in every view
    dispatchRoute();
  });
})();
