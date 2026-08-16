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

// ---------- 4. Pure logic tests (logic.js) ----------

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
