(function () {
  var STORAGE_KEY = "phil-this-quiz-scores-v1";
  var REQUEST_KEY = "phil-this-quiz-requests-v1";
  var SYNC_ENDPOINT = "/api/store";
  var LETTERS = ["A", "B", "C", "D"];
  var serverAvailable = false;

  function loadRequests() {
    try {
      return JSON.parse(localStorage.getItem(REQUEST_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveRequests(ids) {
    localStorage.setItem(REQUEST_KEY, JSON.stringify(ids));
    pushToServer();
  }

  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveScores(scores) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  function recordResult(episodeId, score, total) {
    var scores = loadScores();
    var record = QuizLogic.applyResult(scores, episodeId, score, total);
    saveScores(scores);
    pushToServer();
    return record;
  }

  // ---------- optional server persistence ----------
  // If app.js is served by server.js (http://localhost:.../), scores and
  // requests are also written to store.json on disk. Opened straight from
  // disk via file://, these calls just fail silently and localStorage alone
  // is used, same as before.

  function pushToServer() {
    if (!serverAvailable || typeof fetch !== "function") return;
    fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: loadScores(), requests: loadRequests() })
    }).catch(function () {});
  }

  function hydrateFromServer() {
    if (typeof fetch !== "function") return Promise.resolve();
    return fetch(SYNC_ENDPOINT)
      .then(function (r) { if (!r.ok) throw new Error("no server"); return r.json(); })
      .then(function (data) {
        serverAvailable = true;
        var serverHasData = data && ((data.scores && Object.keys(data.scores).length) || (data.requests && data.requests.length));
        var localHasData = Object.keys(loadScores()).length > 0 || loadRequests().length > 0;
        if (serverHasData) {
          saveScores(data.scores || {});
          saveRequests(data.requests || []);
        } else if (localHasData) {
          // First time pointing this browser's existing progress at the server — seed the file.
          pushToServer();
        }
      })
      .catch(function () { serverAvailable = false; });
  }

  var pct = QuizLogic.pct;
  var escapeHtml = QuizLogic.escapeHtml;

  function computeSuggestion(scores) {
    return QuizLogic.computeSuggestion(scores, QUIZ_DATA);
  }

  // ---------- dashboard rendering ----------

  var dashboardView = document.getElementById("dashboardView");
  var quizView = document.getElementById("quizView");
  var suggestionBox = document.getElementById("suggestionBox");
  var episodeList = document.getElementById("episodeList");

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

    episodeList.innerHTML = "";
    var sortedEpisodes = QUIZ_DATA.slice().sort(function (a, b) { return a.id - b.id; });
    sortedEpisodes.forEach(function (ep) {
      var record = scores[String(ep.id)];
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
      if (record) {
        var p = pct(record.best, ep.questions.length);
        var bestLine = document.createElement("span");
        bestLine.className = "best" + (p === 100 ? " perfect" : "");
        bestLine.textContent = record.best + "/" + ep.questions.length;
        var attemptsLine = document.createElement("span");
        attemptsLine.textContent = record.attempts.length + (record.attempts.length === 1 ? " attempt" : " attempts");
        status.appendChild(bestLine);
        status.appendChild(attemptsLine);
      } else {
        var notTaken = document.createElement("span");
        notTaken.textContent = "not taken";
        status.appendChild(notTaken);
      }

      card.appendChild(number);
      card.appendChild(body);
      card.appendChild(status);
      episodeList.appendChild(card);
    });

    renderRequestPanel();
  }

  // ---------- request-a-quiz panel ----------

  var requestList = document.getElementById("requestList");
  var requestSearch = document.getElementById("requestSearch");
  var requestCount = document.getElementById("requestCount");
  var requestSavedLine = document.getElementById("requestSavedLine");
  var requestSaveBtn = document.getElementById("requestSaveBtn");
  var requestCopyBtn = document.getElementById("requestCopyBtn");

  var coveredIds = null;
  var pendingSelection = null;

  function getCoveredIds() {
    if (!coveredIds) {
      coveredIds = {};
      QUIZ_DATA.forEach(function (ep) { coveredIds[ep.id] = true; });
    }
    return coveredIds;
  }

  function renderRequestPanel() {
    if (!requestList || typeof EPISODE_INDEX === "undefined") return;
    if (!pendingSelection) {
      pendingSelection = {};
      loadRequests().forEach(function (id) { pendingSelection[id] = true; });
    }

    var covered = getCoveredIds();
    var query = (requestSearch.value || "").trim().toLowerCase();
    var candidates = EPISODE_INDEX.filter(function (ep) { return !covered[ep.id]; });
    if (query) {
      candidates = candidates.filter(function (ep) {
        return String(ep.id).indexOf(query) !== -1 || ep.label.toLowerCase().indexOf(query) !== -1;
      });
    }

    requestList.innerHTML = "";
    candidates.slice(0, 200).forEach(function (ep) {
      var row = document.createElement("label");
      row.className = "request-row";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!pendingSelection[ep.id];
      checkbox.addEventListener("change", function () {
        if (checkbox.checked) pendingSelection[ep.id] = true;
        else delete pendingSelection[ep.id];
        updateRequestCount();
      });
      var text = document.createElement("span");
      text.textContent = "#" + ep.id + " — " + ep.label;
      row.appendChild(checkbox);
      row.appendChild(text);
      requestList.appendChild(row);
    });
    if (!candidates.length) {
      var empty = document.createElement("p");
      empty.className = "request-empty";
      empty.textContent = query ? "No matching episodes." : "Every episode already has a quiz.";
      requestList.appendChild(empty);
    }

    updateRequestCount();
    renderSavedLine();
  }

  function updateRequestCount() {
    var n = Object.keys(pendingSelection || {}).length;
    requestCount.textContent = n + (n === 1 ? " selected" : " selected");
  }

  function renderSavedLine() {
    var saved = loadRequests();
    if (!saved.length) {
      requestSavedLine.textContent = "";
      return;
    }
    requestSavedLine.textContent = "Saved list (" + saved.length + "): " + saved.slice().sort(function (a, b) { return a - b; }).join(", ");
  }

  if (requestSearch) {
    requestSearch.addEventListener("input", function () { renderRequestPanel(); });
  }
  if (requestSaveBtn) {
    requestSaveBtn.addEventListener("click", function () {
      var ids = Object.keys(pendingSelection || {}).map(Number).sort(function (a, b) { return a - b; });
      saveRequests(ids);
      renderSavedLine();
    });
  }
  if (requestCopyBtn) {
    requestCopyBtn.addEventListener("click", function () {
      var saved = loadRequests();
      var text = saved.slice().sort(function (a, b) { return a - b; }).join(", ");
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          requestCopyBtn.textContent = "Copied!";
          setTimeout(function () { requestCopyBtn.textContent = "Copy saved list"; }, 1500);
        }).catch(function () { window.prompt("Copy this list:", text); });
      } else {
        window.prompt("Copy this list:", text);
      }
    });
  }

  // ---------- transcript search ----------
  // Full-text, case-insensitive search across every transcript (not just the
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
      (shown === 1 ? " episode matches " : " episodes match ") + "“" + query + "”.";

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
      countEl.textContent = r.count + (r.count === 1 ? " match" : " matches");
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
            var quizMatch = QUIZ_DATA.filter(function (q) { return q.id === e.id; })[0];
            return { id: e.id, file: e.file, title: quizMatch ? quizMatch.title : e.label, text: text, textLower: text.toLowerCase() };
          })
          .catch(function () { return null; });
      })).then(function (list) {
        clientTranscriptIndex = list.filter(Boolean);
        clientIndexBuilding = false;
        performSearch(transcriptSearchInput.value);
      });
      return;
    }

    var qLower = query.toLowerCase();
    var results = clientTranscriptIndex.map(function (entry) {
      var count = 0, pos = 0, idx;
      while ((idx = entry.textLower.indexOf(qLower, pos)) !== -1) { count++; pos = idx + qLower.length; }
      if (!count) return null;
      var firstIdx = entry.textLower.indexOf(qLower);
      var padding = 70;
      var start = Math.max(0, firstIdx - padding);
      var end = Math.min(entry.text.length, firstIdx + query.length + padding);
      var pre = entry.text.slice(start, firstIdx).replace(/\s+/g, " ").trim();
      var match = entry.text.slice(firstIdx, firstIdx + query.length);
      var post = entry.text.slice(firstIdx + query.length, end).replace(/\s+/g, " ").trim();
      if (start > 0) pre = "…" + pre;
      if (end < entry.text.length) post = post + "…";
      return { id: entry.id, title: entry.title, file: entry.file, count: count, pre: pre, match: match, post: post };
    }).filter(Boolean);

    results.sort(function (a, b) { return b.count - a.count || a.id - b.id; });
    renderSearchResults({ query: query, results: results.slice(0, 50), totalMatches: results.length });
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
    doneBtn: document.getElementById("doneBtn")
  };

  function startQuiz(episodeId) {
    currentEpisode = QUIZ_DATA.find(function (ep) { return ep.id === episodeId; });
    if (!currentEpisode) return;
    currentIndex = 0;
    currentScore = 0;
    missed = [];
    dashboardView.classList.add("hide");
    quizView.classList.add("show");
    qEls.results.classList.remove("show");
    qEls.quizBody.style.display = "";
    qEls.epLabel.textContent = "Episode " + currentEpisode.id + " — " + currentEpisode.title;
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
      renderQuestion();
    }
  }

  var scoreCommentary = QuizLogic.scoreCommentary;

  function finishQuiz() {
    var total = currentEpisode.questions.length;
    recordResult(currentEpisode.id, currentScore, total);

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
  qEls.retakeBtn.addEventListener("click", function () { startQuiz(currentEpisode.id); });

  hydrateFromServer().then(renderDashboard);
})();
