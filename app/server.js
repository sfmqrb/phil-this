#!/usr/bin/env node
// Zero-dependency static file server + accounts + per-user quiz store for
// the quiz app. Accounts and scores live in SQLite (app/data.sqlite) via
// Node's built-in node:sqlite; see db.js.
// Run:  node server.js [port]      (defaults to 4173)
// Then open http://localhost:4173/ instead of double-clicking index.html.
//
// Auth:
//   POST   /api/auth/register  { email, name, password } -> { user }
//   POST   /api/auth/login     { email, password }        -> { user }
//   POST   /api/auth/logout                                -> { ok }
//   GET    /api/auth/me                                    -> { user | null }
//   PATCH  /api/auth/me  { name, email, currentPassword?, newPassword? } -> { user }
//
// Per-user data (requires an authenticated session cookie):
//   GET  /api/store  -> { scores, progress, review }
//   POST /api/store  body { scores } -> overwrites the caller's own scores
//   POST   /api/progress  { episodeId, currentIndex, score, missed } -> upsert
//   DELETE /api/progress/:episodeId                                  -> clear
//   POST /api/review  body { review } -> overwrites the caller's own
//                                        spaced-repetition review deck
//
// GET /api/search?q=<term> -> case-insensitive, typo-tolerant full-text
//                              search across every transcript
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var QuizLogic = require("./logic.js");
var db = require("./db.js");

var PORT = Number(process.argv[2]) || Number(process.env.PORT) || 4173;
var HOST = process.env.HOST || "0.0.0.0";
var APP_DIR = __dirname;
var ROOT_DIR = path.join(APP_DIR, "..");
var TRANSCRIPTS_DIR = path.join(ROOT_DIR, "transcripts");
var SESSION_COOKIE = "phil_this_sid";

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

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
    var textLower = text.toLowerCase();
    index.push({
      id: id,
      file: file,
      title: titleFor(id, labelById[id]),
      text: text,
      textLower: textLower,
      words: Array.from(new Set(QuizLogic.tokenize(textLower)))
    });
  });
  index.sort(function (a, b) { return a.id - b.id; });
  return index;
}

var TRANSCRIPT_INDEX = buildTranscriptIndex();
console.log("Indexed " + TRANSCRIPT_INDEX.length + " transcripts for search.");

function searchTranscripts(query) {
  return QuizLogic.searchTranscripts(TRANSCRIPT_INDEX, query, { limit: 50 });
}

// ---------- small HTTP helpers ----------

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

// ---------- cookies / sessions ----------

function parseCookies(req) {
  var header = req.headers.cookie || "";
  var out = {};
  header.split(";").forEach(function (part) {
    var idx = part.indexOf("=");
    if (idx === -1) return;
    var k = part.slice(0, idx).trim();
    var v = part.slice(idx + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; } }
  });
  return out;
}

function setSessionCookie(res, token) {
  var maxAge = 30 * 24 * 60 * 60;
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function currentUser(req) {
  var token = parseCookies(req)[SESSION_COOKIE];
  var user = db.getSessionUser(token);
  return user ? { user: user, token: token } : null;
}

function requireAuth(req, res) {
  var session = currentUser(req);
  if (!session) {
    sendJson(res, 401, { error: "Sign in required." });
    return null;
  }
  return session;
}

// ---------- validation ----------

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

// ---------- routing ----------

var server = http.createServer(function (req, res) {
  var pathname = decodeURIComponent(req.url.split("?")[0]);

  // ----- auth -----

  if (pathname === "/api/auth/register" && req.method === "POST") {
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "Invalid request." }); return; }
      var email = String(body.email || "").trim();
      var name = String(body.name || "").trim();
      var password = String(body.password || "");
      if (!validateEmail(email)) { sendJson(res, 400, { error: "Enter a valid email address." }); return; }
      if (!name) { sendJson(res, 400, { error: "Enter a display name." }); return; }
      if (password.length < 8) { sendJson(res, 400, { error: "Password must be at least 8 characters." }); return; }
      if (db.getUserByEmail(email)) { sendJson(res, 409, { error: "An account with that email already exists." }); return; }
      var user = db.createUser(email, name, password);
      var token = db.createSession(user.id);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: db.publicUser(user) });
    });
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "Invalid request." }); return; }
      var user = db.verifyLogin(String(body.email || ""), String(body.password || ""));
      if (!user) { sendJson(res, 401, { error: "Wrong email or password." }); return; }
      var token = db.createSession(user.id);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: db.publicUser(user) });
    });
    return;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    var token = parseCookies(req)[SESSION_COOKIE];
    db.deleteSession(token);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    var session = currentUser(req);
    sendJson(res, 200, { user: session ? db.publicUser(session.user) : null });
    return;
  }

  if (pathname === "/api/auth/me" && req.method === "PATCH") {
    var authed = requireAuth(req, res);
    if (!authed) return;
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "Invalid request." }); return; }
      if (body.email !== undefined && !validateEmail(body.email)) {
        sendJson(res, 400, { error: "Enter a valid email address." });
        return;
      }
      if (body.email !== undefined) {
        var existing = db.getUserByEmail(body.email);
        if (existing && existing.id !== authed.user.id) {
          sendJson(res, 409, { error: "Another account already uses that email." });
          return;
        }
      }
      try {
        var updated = db.updateProfile(authed.user.id, {
          name: body.name,
          email: body.email,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword
        });
        sendJson(res, 200, { user: db.publicUser(updated) });
      } catch (e) {
        sendJson(res, 400, { error: e.message || "Could not update profile." });
      }
    });
    return;
  }

  // ----- per-user store -----

  if (pathname === "/api/store" && req.method === "GET") {
    var storeSession = requireAuth(req, res);
    if (!storeSession) return;
    sendJson(res, 200, db.getStoreForUser(storeSession.user.id));
    return;
  }

  if (pathname === "/api/store" && req.method === "POST") {
    var postSession = requireAuth(req, res);
    if (!postSession) return;
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "Invalid JSON" }); return; }
      if (body.scores && typeof body.scores === "object") {
        db.replaceScoresForUser(postSession.user.id, body.scores);
      }
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  // ----- spaced-repetition review deck -----

  if (pathname === "/api/review" && req.method === "POST") {
    var reviewSession = requireAuth(req, res);
    if (!reviewSession) return;
    readBody(req, function (err, body) {
      if (err) { sendJson(res, 400, { error: "Invalid JSON" }); return; }
      if (body.review && typeof body.review === "object") {
        db.replaceReviewForUser(reviewSession.user.id, body.review);
      }
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  // ----- in-progress ("half-taken") quiz cache -----

  if (pathname === "/api/progress" && req.method === "POST") {
    var progressSession = requireAuth(req, res);
    if (!progressSession) return;
    readBody(req, function (err, body) {
      if (err || typeof body.episodeId === "undefined") { sendJson(res, 400, { error: "Invalid request." }); return; }
      db.saveProgress(progressSession.user.id, body.episodeId, {
        currentIndex: body.currentIndex,
        score: body.score,
        missed: body.missed,
        sample: body.sample
      });
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  if (pathname.indexOf("/api/progress/") === 0 && req.method === "DELETE") {
    var deleteSession = requireAuth(req, res);
    if (!deleteSession) return;
    var episodeId = Number(pathname.slice("/api/progress/".length));
    db.clearProgress(deleteSession.user.id, episodeId);
    sendJson(res, 200, { ok: true });
    return;
  }

  // ----- transcript search -----

  if (pathname === "/api/search" && req.method === "GET") {
    var parsedUrl = new URL(req.url, "http://localhost");
    sendJson(res, 200, searchTranscripts(parsedUrl.searchParams.get("q")));
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

  // Client-side routes like /episode/90 or /episode/90/transcript have no file
  // on disk. They have no dot in the last path segment (unlike real assets:
  // style.css, app.js, wordclouds/90.png), so fall back to index.html and let
  // app.js read location.pathname and render the right view.
  var lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (pathname !== "/" && lastSegment.indexOf(".") === -1 && pathname.indexOf("/transcripts/") !== 0) {
    fs.access(filePath, fs.constants.F_OK, function (err) {
      serveFile(res, err ? path.join(APP_DIR, "index.html") : filePath);
    });
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, HOST, function () {
  console.log("Philosophitor running at http://" + HOST + ":" + PORT + "/");
  console.log("Accounts + scores are stored in " + db.DB_FILE);
});
