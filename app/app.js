(function () {
  var STORAGE_KEY = "phil-this-quiz-scores-v1";
  var PROGRESS_KEY = "phil-this-quiz-progress-v1";
  var LETTERS = ["A", "B", "C", "D"];
  var serverAvailable = false;
  var currentUser = null; // { id, email, name } | null — guests use local-only, unscoped keys

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
      })
      .catch(function () {});
  }

  var pct = QuizLogic.pct;
  var escapeHtml = QuizLogic.escapeHtml;

  function computeSuggestion(scores) {
    return QuizLogic.computeSuggestion(scores, QUIZ_DATA);
  }

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
      }).catch(function () { loginErrorEl.textContent = "Network error — is the server running?"; });
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
      }).catch(function () { registerErrorEl.textContent = "Network error — is the server running?"; });
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
      }).catch(function () { profileErrorEl.textContent = "Network error — is the server running?"; });
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

  // ---------- view tabs (episodes / transcripts) ----------

  var dashboardView = document.getElementById("dashboardView");
  var quizView = document.getElementById("quizView");
  var transcriptsView = document.getElementById("transcriptsView");
  var tabEpisodesBtn = document.getElementById("tabEpisodesBtn");
  var tabTranscriptsBtn = document.getElementById("tabTranscriptsBtn");

  function showEpisodesTab() {
    if (tabEpisodesBtn) tabEpisodesBtn.classList.add("active");
    if (tabTranscriptsBtn) tabTranscriptsBtn.classList.remove("active");
    if (transcriptsView) transcriptsView.classList.remove("show");
    if (dashboardView) dashboardView.classList.remove("hide");
  }

  function showTranscriptsTab() {
    if (tabTranscriptsBtn) tabTranscriptsBtn.classList.add("active");
    if (tabEpisodesBtn) tabEpisodesBtn.classList.remove("active");
    if (dashboardView) dashboardView.classList.add("hide");
    if (transcriptsView) transcriptsView.classList.add("show");
    renderTranscriptList();
  }

  if (tabEpisodesBtn) tabEpisodesBtn.addEventListener("click", showEpisodesTab);
  if (tabTranscriptsBtn) tabTranscriptsBtn.addEventListener("click", showTranscriptsTab);

  // ---------- transcripts tab: browse every transcript by title ----------

  var transcriptListFilterInput = document.getElementById("transcriptListFilter");
  var transcriptTitleListEl = document.getElementById("transcriptTitleList");
  var transcriptReaderEl = document.getElementById("transcriptReader");
  var transcriptReaderTitleEl = document.getElementById("transcriptReaderTitle");
  var transcriptReaderLinkEl = document.getElementById("transcriptReaderLink");
  var transcriptReaderStatusEl = document.getElementById("transcriptReaderStatus");
  var transcriptReaderBodyEl = document.getElementById("transcriptReaderBody");
  var transcriptReaderBackBtn = document.getElementById("transcriptReaderBackBtn");
  var transcriptCopyBtn = document.getElementById("transcriptCopyBtn");

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
      return { id: e.id, file: e.file, title: titleById[e.id] || e.label };
    }).sort(function (a, b) { return a.id - b.id; });
    return ALL_TRANSCRIPTS;
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
      var row = document.createElement("button");
      row.className = "transcript-row";
      row.type = "button";
      var id = document.createElement("span");
      id.className = "transcript-row-id mono";
      id.textContent = "#" + e.id;
      var title = document.createElement("span");
      title.className = "transcript-row-title";
      title.textContent = e.title;
      row.appendChild(id);
      row.appendChild(title);
      row.addEventListener("click", function () { openTranscriptReader(e); });
      transcriptTitleListEl.appendChild(row);
    });
  }

  function openTranscriptReader(entry) {
    if (!transcriptReaderEl) return;
    transcriptTitleListEl.style.display = "none";
    if (transcriptListFilterInput) transcriptListFilterInput.style.display = "none";
    transcriptReaderEl.style.display = "";
    transcriptReaderTitleEl.textContent = "#" + entry.id + " — " + entry.title;
    transcriptReaderLinkEl.href = "../transcripts/" + entry.file;
    transcriptReaderBodyEl.textContent = "";
    transcriptReaderStatusEl.textContent = "Loading transcript…";

    fetch("../transcripts/" + entry.file)
      .then(function (res) { if (!res.ok) throw new Error("fetch failed"); return res.text(); })
      .then(function (raw) {
        transcriptReaderStatusEl.textContent = "";
        transcriptReaderBodyEl.textContent = stripTranscriptHeader(raw);
      })
      .catch(function () {
        transcriptReaderStatusEl.textContent = "Could not load this transcript — is the server still running?";
      });
  }

  function closeTranscriptReader() {
    if (!transcriptReaderEl) return;
    transcriptReaderEl.style.display = "none";
    transcriptTitleListEl.style.display = "";
    if (transcriptListFilterInput) transcriptListFilterInput.style.display = "";
  }

  function copyTranscriptText() {
    var text = transcriptReaderBodyEl ? transcriptReaderBodyEl.textContent : "";
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
  var suggestionBox = document.getElementById("suggestionBox");
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

  function renderDashboard() {
    var scores = loadScores();
    var suggestion = computeSuggestion(scores);

    suggestionBox.innerHTML = "";
    var label = document.createElement("p");
    label.className = "suggestion-label mono";
    label.textContent = "Suggested next";
    var text = document.createElement("p");
    text.className = "suggestion-text";
    text.innerHTML = suggestion.text;
    suggestionBox.appendChild(label);
    suggestionBox.appendChild(text);
    if (suggestion.episode && suggestion.cta) {
      var actions = document.createElement("div");
      actions.className = "suggestion-actions";
      var btn = document.createElement("button");
      btn.className = "pill";
      btn.type = "button";
      btn.textContent = suggestion.cta;
      btn.addEventListener("click", function () { startQuiz(suggestion.episode.id); });
      actions.appendChild(btn);
      suggestionBox.appendChild(actions);
    }

    renderEpisodeList();
  }

  function renderEpisodeList() {
    var scores = loadScores();
    var progress = loadProgress();
    var query = ((topicFilterInput && topicFilterInput.value) || "").trim().toLowerCase();

    episodeList.innerHTML = "";
    var sortedEpisodes = QUIZ_DATA.slice().sort(function (a, b) { return a.id - b.id; });
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
      if (ep.transcriptFile) {
        var link = document.createElement("a");
        link.className = "ep-transcript-link mono";
        link.href = ep.transcriptFile;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Read full transcript ↗";
        link.addEventListener("click", function (e) { e.stopPropagation(); });
        body.appendChild(link);
      }

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
    heading.textContent = "Also on “" + query + "” — no quiz yet";
    topicOtherEl.appendChild(heading);
    matches.forEach(function (ep) {
      var row = document.createElement("div");
      row.className = "topic-other-row";
      var text = document.createElement("span");
      text.textContent = "#" + ep.id + " — " + ep.label;
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

  function getCoveredIds() {
    if (!coveredIds) {
      coveredIds = {};
      QUIZ_DATA.forEach(function (ep) { coveredIds[ep.id] = true; });
    }
    return coveredIds;
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
      (data.fuzzy ? " (no exact hits — showing close/typo matches)" : "");

    var covered = getCoveredIds();
    data.results.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "search-row";

      var head = document.createElement("div");
      head.className = "search-row-head";
      var titleEl = document.createElement("span");
      titleEl.className = "search-row-title";
      titleEl.textContent = "#" + r.id + " — " + r.title;
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
        quizBtn.textContent = "Take quiz →";
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
        .catch(function () { searchStatus.textContent = "Search failed — is the server still running?"; });
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
    backBtn: document.getElementById("backBtn"),
    transcriptLink: document.getElementById("quizTranscriptLink"),
    wordcloudLink: document.getElementById("quizWordcloudLink"),
    wordcloudImg: document.getElementById("quizWordcloudImg"),
    retakeBtn: document.getElementById("retakeBtn"),
    doneBtn: document.getElementById("doneBtn"),
    resumeBanner: document.getElementById("resumeBanner"),
    resumeBannerText: document.getElementById("resumeBannerText"),
    resumeRestartBtn: document.getElementById("resumeRestartBtn")
  };

  function startQuiz(episodeId, forceRestart) {
    currentEpisode = QUIZ_DATA.find(function (ep) { return ep.id === episodeId; });
    if (!currentEpisode) return;

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

    dashboardView.classList.add("hide");
    quizView.classList.add("show");
    qEls.results.classList.remove("show");
    qEls.quizBody.style.display = "";
    qEls.epLabel.textContent = "Episode " + currentEpisode.id + " — " + currentEpisode.title;

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
      qEls.transcriptLink.href = currentEpisode.transcriptFile;
      qEls.transcriptLink.style.display = "";
    } else {
      qEls.transcriptLink.style.display = "none";
    }
    renderQuestion();
  }

  if (qEls.resumeRestartBtn) {
    qEls.resumeRestartBtn.addEventListener("click", function () {
      if (currentEpisode) startQuiz(currentEpisode.id, true);
    });
  }

  function goToDashboard() {
    quizView.classList.remove("show");
    dashboardView.classList.remove("hide");
    renderDashboard();
  }

  function renderQuestion() {
    var item = currentEpisode.questions[currentIndex];
    answered = false;
    var total = currentEpisode.questions.length;
    qEls.progressLabel.textContent = "§ " + (currentIndex + 1) + " / " + total;
    qEls.scoreLive.textContent = "correct so far — " + currentScore;
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
    else missed.push({ q: item.q, note: item.note });

    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === item.correct) b.classList.add("correct");
      else if (i === idx) b.classList.add("wrong");
      else b.classList.add("dim");
    });

    qEls.note.innerHTML = "<strong>" + (isCorrect ? "Right." : "Not quite.") + "</strong> " + item.note;
    qEls.note.classList.add("show");
    qEls.nextRow.classList.add("show");
    qEls.scoreLive.textContent = "correct so far — " + currentScore;
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
      });
    }
  }

  qEls.nextBtn.addEventListener("click", nextQuestion);
  qEls.backBtn.addEventListener("click", goToDashboard);
  qEls.doneBtn.addEventListener("click", goToDashboard);
  qEls.retakeBtn.addEventListener("click", function () { startQuiz(currentEpisode.id, true); });

  fetchMe().then(function (user) {
    currentUser = user;
    renderAccountBar();
    return currentUser ? hydrateStoreFromServer() : null;
  }).then(renderDashboard);
})();
