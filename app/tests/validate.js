#!/usr/bin/env node
// Validates data.js (the quiz database) and exercises the pure logic in logic.js.
// Run with: node tests/validate.js
"use strict";

var fs = require("fs");
var path = require("path");

var APP_DIR = path.join(__dirname, "..");
var QUIZ_DATA = require(path.join(APP_DIR, "data.js"));
var EPISODE_INDEX = require(path.join(APP_DIR, "episode-index.js"));
var QuizLogic = require(path.join(APP_DIR, "logic.js"));

var failures = [];
var warnings = [];
var passed = 0;

function check(condition, message) {
  if (condition) {
    passed++;
  } else {
    failures.push(message);
  }
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

// ---------- 1. Structural validation of QUIZ_DATA ----------

check(Array.isArray(QUIZ_DATA), "QUIZ_DATA must be an array");
check(QUIZ_DATA.length > 0, "QUIZ_DATA must not be empty");

var seenIds = {};
var letterCounts = [0, 0, 0, 0]; // global correct-answer position distribution

QUIZ_DATA.forEach(function (ep, epIdx) {
  var where = "episode #" + (ep && ep.id !== undefined ? ep.id : "at index " + epIdx);

  check(typeof ep.id === "number" && Number.isInteger(ep.id), where + ": id must be an integer");
  check(!seenIds[ep.id], where + ": duplicate episode id");
  seenIds[ep.id] = true;

  check(typeof ep.title === "string" && ep.title.trim().length > 0, where + ": title must be a non-empty string");
  check(typeof ep.teaser === "string" && ep.teaser.trim().length > 0, where + ": teaser must be a non-empty string");

  check(typeof ep.transcriptFile === "string" && ep.transcriptFile.length > 0, where + ": transcriptFile must be set");
  if (typeof ep.transcriptFile === "string") {
    var resolved = path.join(APP_DIR, ep.transcriptFile);
    check(fs.existsSync(resolved), where + ": transcriptFile does not exist on disk (" + ep.transcriptFile + ")");
  }

  check(typeof ep.wordcloud === "string" && ep.wordcloud.length > 0, where + ": wordcloud must be set");
  if (typeof ep.wordcloud === "string") {
    var resolvedCloud = path.join(APP_DIR, ep.wordcloud);
    check(fs.existsSync(resolvedCloud), where + ": wordcloud image does not exist on disk (" + ep.wordcloud + ")");
    check(fs.existsSync(resolvedCloud) && fs.statSync(resolvedCloud).size > 500, where + ": wordcloud image looks empty/corrupt (" + ep.wordcloud + ")");
  }

  check(Array.isArray(ep.questions), where + ": questions must be an array");
  check(ep.questions && ep.questions.length === 10, where + ": expected exactly 10 questions, found " + (ep.questions ? ep.questions.length : "none"));

  var epCorrectCounts = [0, 0, 0, 0];

  (ep.questions || []).forEach(function (q, qIdx) {
    var qWhere = where + ", question " + (qIdx + 1);

    check(typeof q.q === "string" && q.q.trim().length > 0, qWhere + ": q must be a non-empty string");
    check(Array.isArray(q.options) && q.options.length === 4, qWhere + ": options must be an array of exactly 4");

    if (Array.isArray(q.options)) {
      q.options.forEach(function (opt, i) {
        check(typeof opt === "string" && opt.trim().length > 0, qWhere + ": option " + i + " must be a non-empty string");
      });
      var uniqueOptions = {};
      var hasDuplicate = false;
      q.options.forEach(function (opt) {
        var key = String(opt).trim().toLowerCase();
        if (uniqueOptions[key]) hasDuplicate = true;
        uniqueOptions[key] = true;
      });
      check(!hasDuplicate, qWhere + ": options must not contain duplicate text");
    }

    check(
      typeof q.correct === "number" && Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3,
      qWhere + ": correct must be an integer 0-3"
    );
    if (typeof q.correct === "number" && q.correct >= 0 && q.correct <= 3) {
      letterCounts[q.correct]++;
      epCorrectCounts[q.correct]++;
    }

    check(typeof q.note === "string" && q.note.trim().length > 0, qWhere + ": note must be a non-empty string");
  });

  // The bug that prompted this suite: every correct answer landing on the same letter.
  var maxShare = Math.max.apply(null, epCorrectCounts) / (ep.questions ? ep.questions.length : 10);
  check(maxShare < 0.8, where + ": correct answers are too concentrated on one option (" + epCorrectCounts.join("/") + " across A/B/C/D) — looks like the shuffle bug");
});

// ---------- 2. Global answer-position distribution ----------

var totalQuestions = letterCounts.reduce(function (a, b) { return a + b; }, 0);
check(totalQuestions > 0, "no questions found to check distribution");
letterCounts.forEach(function (count, i) {
  var letter = "ABCD"[i];
  var share = totalQuestions ? count / totalQuestions : 0;
  check(count > 0, "option " + letter + " is never the correct answer across the whole bank");
  warn(share >= 0.15 && share <= 0.35, "option " + letter + " is correct " + (share * 100).toFixed(1) + "% of the time (expected roughly 20-30%)");
});

// ---------- 3. Cross-reference with episode-index.js ----------

check(Array.isArray(EPISODE_INDEX) && EPISODE_INDEX.length > 0, "EPISODE_INDEX must be a non-empty array");
var indexById = {};
EPISODE_INDEX.forEach(function (e) { indexById[e.id] = e; });

QUIZ_DATA.forEach(function (ep) {
  var entry = indexById[ep.id];
  check(!!entry, "episode #" + ep.id + " is missing from episode-index.js (full archive index)");
  if (entry && typeof ep.transcriptFile === "string") {
    var base = path.basename(ep.transcriptFile);
    check(base === entry.file, "episode #" + ep.id + ": transcriptFile (" + base + ") doesn't match episode-index.js entry (" + entry.file + ")");
  }
});

// ---------- 4. Learning paths (paths.js) ----------
// paths.js is optional: a checkout without it still has a working app (the
// paths strip just stays hidden), so a missing file warns rather than fails.

(function () {
  var pathsFile = path.join(APP_DIR, "paths.js");
  var pathsExist = fs.existsSync(pathsFile);
  warn(pathsExist, "paths.js not found — skipping learning-path checks");
  if (!pathsExist) return;

  var LEARNING_PATHS = require(pathsFile);
  check(Array.isArray(LEARNING_PATHS) && LEARNING_PATHS.length > 0, "LEARNING_PATHS must be a non-empty array");
  if (!Array.isArray(LEARNING_PATHS)) return;

  var seenKeys = {};
  var seenEpisodeIds = {};

  LEARNING_PATHS.forEach(function (p, pIdx) {
    var where = "learning path " + (p && p.key ? "“" + p.key + "”" : "at index " + pIdx);
    check(typeof p.key === "string" && p.key.trim().length > 0, where + ": key must be a non-empty string");
    check(!seenKeys[p.key], where + ": duplicate path key");
    seenKeys[p.key] = true;
    check(typeof p.title === "string" && p.title.trim().length > 0, where + ": title must be a non-empty string");
    check(typeof p.blurb === "string" && p.blurb.trim().length > 0, where + ": blurb must be a non-empty string");
    check(Array.isArray(p.episodes) && p.episodes.length > 0, where + ": episodes must be a non-empty array");

    (p.episodes || []).forEach(function (id) {
      check(!!indexById[id], where + ": episode #" + id + " is not in episode-index.js");
      check(!seenEpisodeIds[id], "episode #" + id + " appears in more than one learning path");
      seenEpisodeIds[id] = true;
    });
  });

  var uncovered = EPISODE_INDEX.filter(function (e) { return !seenEpisodeIds[e.id]; }).map(function (e) { return e.id; });
  check(uncovered.length === 0, uncovered.length + " episode(s) from episode-index.js are in no learning path: " + uncovered.slice(0, 10).join(", "));
})();

// ---------- 5. Pure logic tests (logic.js) ----------

function assertEqual(actual, expected, message) {
  check(actual === expected, message + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
}

// pct()
assertEqual(QuizLogic.pct(5, 10), 50, "pct(5,10)");
assertEqual(QuizLogic.pct(10, 10), 100, "pct(10,10)");
assertEqual(QuizLogic.pct(0, 10), 0, "pct(0,10)");
assertEqual(QuizLogic.pct(3, 10), 30, "pct(3,10)");
assertEqual(QuizLogic.pct(0, 0), 0, "pct(0,0) should not divide by zero");

// escapeHtml()
assertEqual(QuizLogic.escapeHtml("<b>&\"'"), "&lt;b&gt;&amp;&quot;&#39;", "escapeHtml escapes all special characters");

// scoreCommentary()
check(/perfect/i.test(QuizLogic.scoreCommentary(10, 10)), "scoreCommentary(10,10) should call out a perfect score");
check(/again from the top/i.test(QuizLogic.scoreCommentary(1, 10)), "scoreCommentary(1,10) should suggest a re-listen");

// applyResult() — pure-ish, mutates the passed scores object
(function () {
  var scores = {};
  QuizLogic.applyResult(scores, 4, 7, 10, "2026-01-01T00:00:00.000Z");
  check(scores["4"] && scores["4"].best === 7, "applyResult records best score on first attempt");
  check(scores["4"].attempts.length === 1, "applyResult records one attempt");

  QuizLogic.applyResult(scores, 4, 5, 10, "2026-01-02T00:00:00.000Z");
  check(scores["4"].best === 7, "applyResult keeps the higher best score across attempts");
  check(scores["4"].attempts.length === 2, "applyResult appends rather than replaces attempts");

  QuizLogic.applyResult(scores, 4, 9, 10, "2026-01-03T00:00:00.000Z");
  check(scores["4"].best === 9, "applyResult updates best when a later attempt is higher");
})();

// computeSuggestion() — untaken episode should be suggested first
(function () {
  var suggestion = QuizLogic.computeSuggestion({}, QUIZ_DATA);
  check(!!suggestion.episode, "computeSuggestion with no scores should suggest some episode");
  check(suggestion.cta === "Take it", "computeSuggestion with no scores should invite taking a quiz, not retaking");
})();

// computeSuggestion() — once everything is attempted, worst score should be suggested
(function () {
  var scores = {};
  QUIZ_DATA.forEach(function (ep, i) {
    // give every episode a perfect score except one deliberately weak one
    var best = i === 2 ? 3 : ep.questions.length;
    scores[String(ep.id)] = { attempts: [{ score: best, total: ep.questions.length, date: "2026-01-01T00:00:00.000Z" }], best: best };
  });
  var weakEpisode = QUIZ_DATA[2];
  var suggestion = QuizLogic.computeSuggestion(scores, QUIZ_DATA);
  check(!!suggestion.episode && suggestion.episode.id === weakEpisode.id, "computeSuggestion should surface the lowest-scoring episode once all are attempted");
  check(suggestion.cta === "Retake", "computeSuggestion should invite a retake once all episodes are attempted");
})();

// computeSuggestion() — perfect scores everywhere means nothing left to suggest
(function () {
  var scores = {};
  QUIZ_DATA.forEach(function (ep) {
    scores[String(ep.id)] = { attempts: [{ score: ep.questions.length, total: ep.questions.length, date: "2026-01-01T00:00:00.000Z" }], best: ep.questions.length };
  });
  var suggestion = QuizLogic.computeSuggestion(scores, QUIZ_DATA);
  check(suggestion.episode === null, "computeSuggestion with all-perfect scores should suggest nothing further");
  check(suggestion.cta === null, "computeSuggestion with all-perfect scores should have no call to action");
})();

// applyReviewAnswer() — the spaced-repetition ladder
(function () {
  var deck = {};
  QuizLogic.applyReviewAnswer(deck, 4, 2, false, "2026-01-01T00:00:00.000Z");
  var entry = deck["4:2"];
  check(!!entry, "applyReviewAnswer enrols a question answered wrong");
  assertEqual(entry.stage, 0, "a freshly enrolled entry starts at stage 0");
  assertEqual(entry.due, "2026-01-02T00:00:00.000Z", "a freshly enrolled entry is due tomorrow");
  assertEqual(entry.lapses, 0, "a freshly enrolled entry has no lapses yet");
  assertEqual(entry.added, "2026-01-01T00:00:00.000Z", "a freshly enrolled entry records when it was added");

  QuizLogic.applyReviewAnswer(deck, 4, 2, true, "2026-01-02T00:00:00.000Z");
  assertEqual(deck["4:2"].stage, 1, "a correct review advances the stage");
  assertEqual(deck["4:2"].due, "2026-01-05T00:00:00.000Z", "stage 1 pushes the next review out 3 days");

  QuizLogic.applyReviewAnswer(deck, 4, 2, true, "2026-01-05T00:00:00.000Z");
  assertEqual(deck["4:2"].stage, 2, "a second correct review advances again");
  assertEqual(deck["4:2"].due, "2026-01-12T00:00:00.000Z", "stage 2 pushes the next review out 7 days");

  QuizLogic.applyReviewAnswer(deck, 4, 2, false, "2026-01-12T00:00:00.000Z");
  assertEqual(deck["4:2"].stage, 0, "getting it wrong again resets to stage 0");
  assertEqual(deck["4:2"].due, "2026-01-13T00:00:00.000Z", "a reset entry comes back tomorrow");
  assertEqual(deck["4:2"].lapses, 1, "a repeat mistake counts as a lapse");
  assertEqual(deck["4:2"].added, "2026-01-01T00:00:00.000Z", "a reset entry keeps its original added date");
})();

// applyReviewAnswer() — stage caps at the top of the ladder
(function () {
  var deck = { "9:0": { stage: 0, due: "2026-01-01T00:00:00.000Z", lapses: 0, added: "2026-01-01T00:00:00.000Z" } };
  var last = QuizLogic.REVIEW_INTERVALS.length - 1;
  for (var i = 0; i < 10; i++) QuizLogic.applyReviewAnswer(deck, 9, 0, true, "2026-01-01T00:00:00.000Z");
  assertEqual(deck["9:0"].stage, last, "stage never climbs past the last interval");
  assertEqual(
    deck["9:0"].due,
    new Date(Date.UTC(2026, 0, 1) + QuizLogic.REVIEW_INTERVALS[last] * 24 * 60 * 60 * 1000).toISOString(),
    "a capped entry still uses the longest interval"
  );
})();

// applyReviewAnswer() — first-try-correct questions never enter the deck
(function () {
  var deck = {};
  QuizLogic.applyReviewAnswer(deck, 12, 3, true, "2026-01-01T00:00:00.000Z");
  assertEqual(Object.keys(deck).length, 0, "a correct answer on an un-enrolled question is a no-op");
})();

// reviewKey() / parseReviewKey()
assertEqual(QuizLogic.reviewKey(4, 2), "4:2", "reviewKey joins episode and question index");
assertEqual(QuizLogic.parseReviewKey("4:2").epId, 4, "parseReviewKey reads the episode id back");
assertEqual(QuizLogic.parseReviewKey("4:2").qIndex, 2, "parseReviewKey reads the question index back");

// dueReviewEntries() — filtering by due date and ordering
(function () {
  var deck = {
    "1:0": { stage: 0, due: "2026-01-03T00:00:00.000Z", lapses: 0, added: "2026-01-01T00:00:00.000Z" },
    "2:1": { stage: 1, due: "2026-01-01T00:00:00.000Z", lapses: 2, added: "2026-01-01T00:00:00.000Z" },
    "3:2": { stage: 2, due: "2026-01-09T00:00:00.000Z", lapses: 0, added: "2026-01-01T00:00:00.000Z" }
  };
  var due = QuizLogic.dueReviewEntries(deck, "2026-01-05T00:00:00.000Z");
  assertEqual(due.length, 2, "dueReviewEntries drops entries that aren't due yet");
  assertEqual(due[0].key, "2:1", "dueReviewEntries returns the longest-overdue entry first");
  assertEqual(due[1].key, "1:0", "dueReviewEntries sorts by due date ascending");
  assertEqual(due[0].epId, 2, "dueReviewEntries resolves the episode id from the key");
  assertEqual(due[0].qIndex, 1, "dueReviewEntries resolves the question index from the key");
  assertEqual(due[0].lapses, 2, "dueReviewEntries carries the lapse count through");
  assertEqual(QuizLogic.dueReviewEntries(deck, "2026-01-01T00:00:00.000Z").length, 1, "an entry due exactly now counts as due");
  assertEqual(QuizLogic.dueReviewEntries({}, "2026-01-05T00:00:00.000Z").length, 0, "an empty deck has nothing due");
})();

// reviewCounts()
(function () {
  var deck = {
    "1:0": { stage: 0, due: "2026-01-03T00:00:00.000Z", lapses: 0, added: "2026-01-01T00:00:00.000Z" },
    "2:1": { stage: 1, due: "2026-01-01T00:00:00.000Z", lapses: 2, added: "2026-01-01T00:00:00.000Z" },
    "3:2": { stage: 2, due: "2026-01-09T00:00:00.000Z", lapses: 0, added: "2026-01-01T00:00:00.000Z" }
  };
  var counts = QuizLogic.reviewCounts(deck, "2026-01-05T00:00:00.000Z");
  assertEqual(counts.due, 2, "reviewCounts counts what's due now");
  assertEqual(counts.total, 3, "reviewCounts counts the whole deck");
  assertEqual(QuizLogic.reviewCounts({}, "2026-01-05T00:00:00.000Z").total, 0, "reviewCounts on an empty deck is zero");
})();

// ---------- report ----------

console.log("");
console.log(passed + " checks passed.");
if (warnings.length) {
  console.log("\n" + warnings.length + " warning(s):");
  warnings.forEach(function (w) { console.log("  ⚠ " + w); });
}
if (failures.length) {
  console.log("\n" + failures.length + " FAILURE(S):");
  failures.forEach(function (f) { console.log("  ✗ " + f); });
  console.log("");
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
  process.exit(0);
}
