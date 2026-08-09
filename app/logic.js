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
        text: "You haven't quizzed on <strong>Episode " + pick.id + "</strong> yet — " + escapeHtml(pick.title) + ".",
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
      text: "Perfect scores across every episode. Impressive — nothing left to suggest.",
      cta: null
    };
  }

  function scoreCommentary(n, total) {
    var p = pct(n, total);
    if (p === 100) return "Perfect score. You could teach this episode.";
    if (p >= 80) return "Solid grasp of the episode's core arguments.";
    if (p >= 60) return "Good foundation — a couple of details slipped through.";
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
    applyResult: applyResult
  };
});
