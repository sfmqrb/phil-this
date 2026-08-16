// Pure, DOM-free logic shared between the browser app and the Node test suite.
// No localStorage, no document — everything here takes its state as arguments
// and returns a value, so it can be exercised directly by tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.QuizLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  // ---------- lenient ("fuzzy") text matching ----------
  // Used everywhere the app searches user-typed text against titles, labels,
  // or transcripts, so small typos don't produce "no results".

  function levenshtein(a, b) {
    if (a === b) return 0;
    var al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    var prev = new Array(bl + 1);
    for (var j = 0; j <= bl; j++) prev[j] = j;
    for (var i = 1; i <= al; i++) {
      var cur = [i];
      var ca = a.charCodeAt(i - 1);
      for (var j2 = 1; j2 <= bl; j2++) {
        var cost = ca === b.charCodeAt(j2 - 1) ? 0 : 1;
        cur[j2] = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + cost);
      }
      prev = cur;
    }
    return prev[bl];
  }

  // Very short words stay exact-only (too many false positives otherwise);
  // medium words tolerate one typo, longer words tolerate two.
  function fuzzyTolerance(len) {
    if (len <= 3) return 0;
    if (len <= 6) return 1;
    return 2;
  }

  function tokenize(textLower) {
    return (textLower || "").split(/[^a-z0-9']+/).filter(Boolean);
  }

  // Returns the haystack word forms that approximately match needleWord.
  function fuzzyWordMatches(haystackWords, needleWord) {
    var tol = fuzzyTolerance(needleWord.length);
    var hits = [];
    for (var i = 0; i < haystackWords.length; i++) {
      var hw = haystackWords[i];
      if (hw === needleWord) return [hw];
      if (tol === 0) continue;
      if (Math.abs(hw.length - needleWord.length) > tol) continue;
      if (levenshtein(hw, needleWord) <= tol) hits.push(hw);
    }
    return hits;
  }

  // Does haystackLower contain (exactly, or with small typos, word-by-word) needleLower?
  function fuzzyIncludes(haystackLower, needleLower) {
    if (!needleLower) return false;
    if (haystackLower.indexOf(needleLower) !== -1) return true;
    var needleWords = tokenize(needleLower);
    if (!needleWords.length) return false;
    var haystackWords = tokenize(haystackLower);
    return needleWords.every(function (nw) { return fuzzyWordMatches(haystackWords, nw).length > 0; });
  }

  function countOccurrences(haystackLower, needleLower) {
    if (!needleLower) return 0;
    var count = 0, pos = 0, idx;
    while ((idx = haystackLower.indexOf(needleLower, pos)) !== -1) {
      count++;
      pos = idx + needleLower.length;
    }
    return count;
  }

  function makeSnippet(text, matchIndex, matchLen) {
    var padding = 70;
    var start = Math.max(0, matchIndex - padding);
    var end = Math.min(text.length, matchIndex + matchLen + padding);
    var pre = text.slice(start, matchIndex).replace(/\s+/g, " ").trim();
    var match = text.slice(matchIndex, matchIndex + matchLen);
    var post = text.slice(matchIndex + matchLen, end).replace(/\s+/g, " ").trim();
    if (start > 0) pre = "…" + pre;
    if (end < text.length) post = post + "…";
    return { pre: pre, match: match, post: post };
  }

  // entries: [{ id, title, file, text, textLower, words? }] (words = precomputed
  // unique lowercase tokens, optional — computed on the fly if missing).
  // Tries an exact substring search first; only falls back to per-word fuzzy
  // matching (typo-tolerant) if that comes up completely empty.
  function searchTranscripts(entries, query, opts) {
    opts = opts || {};
    var limit = opts.limit || 50;
    var q = (query || "").trim();
    if (!q) return { query: q, results: [] };
    var qLower = q.toLowerCase();

    var results = [];
    entries.forEach(function (entry) {
      var count = countOccurrences(entry.textLower, qLower);
      if (!count) return;
      var firstIdx = entry.textLower.indexOf(qLower);
      var snippet = makeSnippet(entry.text, firstIdx, q.length);
      results.push({
        id: entry.id, title: entry.title, file: entry.file, count: count,
        pre: snippet.pre, match: snippet.match, post: snippet.post, fuzzy: false
      });
    });

    var fuzzyUsed = false;
    if (!results.length) {
      var needleWords = tokenize(qLower);
      if (needleWords.length) {
        entries.forEach(function (entry) {
          var haystackWords = entry.words || tokenize(entry.textLower);
          var matchedForms = [];
          var allMatch = needleWords.every(function (nw) {
            var hits = fuzzyWordMatches(haystackWords, nw);
            if (hits.length) matchedForms.push(hits[0]);
            return hits.length > 0;
          });
          if (!allMatch) return;
          var probe = matchedForms[0];
          var firstIdx = entry.textLower.indexOf(probe);
          if (firstIdx === -1) return;
          var snippet = makeSnippet(entry.text, firstIdx, probe.length);
          results.push({
            id: entry.id, title: entry.title, file: entry.file, count: 1,
            pre: snippet.pre, match: snippet.match, post: snippet.post, fuzzy: true
          });
        });
        if (results.length) fuzzyUsed = true;
      }
    }

    results.sort(function (a, b) { return (b.count - a.count) || (a.id - b.id); });
    return { query: q, results: results.slice(0, limit), totalMatches: results.length, fuzzy: fuzzyUsed };
  }

  function pct(score, total) {
    if (!total) return 0;
    return Math.round((score / total) * 100);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // scores: { [episodeId: string]: { attempts: [{score,total,date}], best: number } }
  function computeSuggestion(scores, quizData) {
    var untaken = quizData.filter(function (ep) { return !scores[String(ep.id)]; });
    if (untaken.length) {
      var pick = untaken[Math.floor(Math.random() * untaken.length)];
      return {
        episode: pick,
        text: "You haven't quizzed on <strong>Episode " + pick.id + "</strong> yet: " + escapeHtml(pick.title) + ".",
        cta: "Take it"
      };
    }

    var worst = null;
    var worstPct = 101;
    quizData.forEach(function (ep) {
      var record = scores[String(ep.id)];
      if (!record) return;
      var p = pct(record.best, ep.questions.length);
      if (p < worstPct) {
        worstPct = p;
        worst = ep;
      }
    });

    if (worst && worstPct < 100) {
      return {
        episode: worst,
        text: "Worth revisiting: your best score on <strong>Episode " + worst.id + "</strong> (" + escapeHtml(worst.title) + ") is " + worstPct + "%.",
        cta: "Retake"
      };
    }

    return {
      episode: null,
      text: "Perfect scores across every episode. Nothing left to suggest.",
      cta: null
    };
  }

  function scoreCommentary(n, total) {
    var p = pct(n, total);
    if (p === 100) return "Perfect score. You could teach this episode.";
    if (p >= 80) return "Solid grasp of the episode's core arguments.";
    if (p >= 60) return "Good foundation. A couple of details slipped through.";
    if (p >= 40) return "Worth a re-listen for the finer points.";
    return "This one's worth listening to again from the top.";
  }

  // Mutates and returns `scores` with a new attempt recorded for episodeId.
  function applyResult(scores, episodeId, score, total, dateIso) {
    var key = String(episodeId);
    if (!scores[key]) scores[key] = { attempts: [], best: 0 };
    scores[key].attempts.push({ score: score, total: total, date: dateIso || new Date().toISOString() });
    scores[key].best = Math.max(scores[key].best, score);
    return scores[key];
  }

  return {
    pct: pct,
    escapeHtml: escapeHtml,
    computeSuggestion: computeSuggestion,
    scoreCommentary: scoreCommentary,
    applyResult: applyResult,
    levenshtein: levenshtein,
    tokenize: tokenize,
    fuzzyIncludes: fuzzyIncludes,
    searchTranscripts: searchTranscripts
  };
});
