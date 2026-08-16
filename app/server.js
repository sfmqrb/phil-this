#!/usr/bin/env node
// Zero-dependency static file server + JSON store for the quiz app.
// Run:  node server.js [port]      (defaults to 4173)
// Then open http://localhost:4173/ instead of double-clicking index.html.
//
// GET  /api/store    -> { scores, requests } currently saved on disk
// POST /api/store    -> body { scores, requests }, overwrites store.json
// GET  /api/search?q=<term> -> case-insensitive full-text search across every transcript
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = Number(process.argv[2]) || 4173;
var APP_DIR = __dirname;
var ROOT_DIR = path.join(APP_DIR, "..");
var TRANSCRIPTS_DIR = path.join(ROOT_DIR, "transcripts");
var STORE_FILE = path.join(APP_DIR, "store.json");

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch (e) {
    return { scores: {}, requests: [] };
  }
}

function writeStore(data) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(STORE_FILE)) writeStore({ scores: {}, requests: [] });

// ---------- transcript search index ----------
// Built once at startup: every transcript's body (markdown header stripped),
// kept in memory so /api/search can scan all ~245 episodes instantly.

function stripHeader(raw) {
  var lines = raw.split("\n");
  var i = 0;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") { i++; break; }
  }
  return lines.slice(i).join("\n");
}

function titleFor(id, fallbackLabel) {
  try {
    var quizData = require(path.join(APP_DIR, "data.js"));
    var match = quizData.filter(function (e) { return e.id === id; })[0];
    if (match) return match.title;
  } catch (e) {}
  return fallbackLabel || ("Episode " + id);
}

function buildTranscriptIndex() {
  var labelById = {};
  try {
    var episodeIndex = require(path.join(APP_DIR, "episode-index.js"));
    episodeIndex.forEach(function (e) { labelById[e.id] = e.label; });
  } catch (e) {}

  var files = fs.readdirSync(TRANSCRIPTS_DIR).filter(function (f) { return f.endsWith(".md"); });
  var index = [];
  files.forEach(function (file) {
    var m = file.match(/^(\d+)-/);
    if (!m) return;
    var id = Number(m[1]);
    var raw;
    try {
      raw = fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), "utf8");
    } catch (e) {
      return;
    }
    var text = stripHeader(raw);
    index.push({
      id: id,
      file: file,
      title: titleFor(id, labelById[id]),
      text: text,
      textLower: text.toLowerCase()
    });
  });
  index.sort(function (a, b) { return a.id - b.id; });
  return index;
}

var TRANSCRIPT_INDEX = buildTranscriptIndex();
console.log("Indexed " + TRANSCRIPT_INDEX.length + " transcripts for search.");

function countOccurrences(haystackLower, needleLower) {
  if (!needleLower) return 0;
  var count = 0;
  var pos = 0;
  while (true) {
    var idx = haystackLower.indexOf(needleLower, pos);
    if (idx === -1) break;
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

function searchTranscripts(query) {
  var q = (query || "").trim();
  if (!q) return { query: q, results: [] };
  var qLower = q.toLowerCase();

  var results = TRANSCRIPT_INDEX.map(function (entry) {
    var count = countOccurrences(entry.textLower, qLower);
    if (!count) return null;
    var firstIdx = entry.textLower.indexOf(qLower);
    var snippet = makeSnippet(entry.text, firstIdx, q.length);
    return {
      id: entry.id,
      title: entry.title,
      file: entry.file,
      count: count,
      pre: snippet.pre,
      match: snippet.match,
      post: snippet.post
    };
  }).filter(Boolean);

  results.sort(function (a, b) { return b.count - a.count || a.id - b.id; });
  return { query: q, results: results.slice(0, 50), totalMatches: results.length };
}

function sendJson(res, status, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, cb) {
  var chunks = [];
  var size = 0;
  req.on("data", function (c) {
    size += c.length;
    if (size > 5 * 1024 * 1024) { req.destroy(); return; } // 5MB safety cap
    chunks.push(c);
  });
  req.on("end", function () {
    try {
      cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    } catch (e) {
      cb(e);
    }
  });
}

function isInside(baseDir, target) {
  var rel = path.relative(baseDir, target);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  var pathname = decodeURIComponent(req.url.split("?")[0]);

  if (pathname === "/api/search" && req.method === "GET") {
    var parsedUrl = new URL(req.url, "http://localhost");
    sendJson(res, 200, searchTranscripts(parsedUrl.searchParams.get("q")));
    return;
  }

  if (pathname === "/api/store" && req.method === "GET") {
    sendJson(res, 200, readStore());
    return;
  }

  if (pathname === "/api/store" && req.method === "POST") {
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "invalid JSON" }); return; }
      var current = readStore();
      var next = {
        scores: body.scores && typeof body.scores === "object" ? body.scores : current.scores,
        requests: Array.isArray(body.requests) ? body.requests : current.requests
      };
      writeStore(next);
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405).end("Method not allowed");
    return;
  }

  // Everything under /transcripts/ comes from the project root's transcripts/ folder;
  // everything else is served out of app/, with "/" mapping to index.html.
  var filePath;
  if (pathname.indexOf("/transcripts/") === 0) {
    filePath = path.normalize(path.join(ROOT_DIR, pathname));
    if (!isInside(path.join(ROOT_DIR, "transcripts"), filePath)) { res.writeHead(403).end("Forbidden"); return; }
  } else {
    filePath = path.normalize(path.join(APP_DIR, pathname === "/" ? "index.html" : pathname));
    if (!isInside(APP_DIR, filePath)) { res.writeHead(403).end("Forbidden"); return; }
  }

  serveFile(res, filePath);
});

server.listen(PORT, "127.0.0.1", function () {
  console.log("Philosophize This! quiz app running at http://localhost:" + PORT + "/");
  console.log("Scores are being saved to " + STORE_FILE);
});
