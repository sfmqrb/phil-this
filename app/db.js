// SQLite-backed accounts + per-user quiz storage for Philosophitor. Uses
// Node's built-in (experimental) node:sqlite module, so there are still
// zero npm dependencies.
"use strict";

var path = require("path");
var crypto = require("crypto");
var fs = require("fs");
var DatabaseSync = require("node:sqlite").DatabaseSync;

// DATA_DIR lets deployments point the SQLite file at a mounted persistent
// volume (e.g. Fly.io) instead of the code directory, so redeploys don't
// wipe accounts. Defaults to app/ for local/dev use.
var DATA_DIR = process.env.DATA_DIR || __dirname;
var DB_FILE = path.join(DATA_DIR, "data.sqlite");
var LEGACY_STORE_FILE = path.join(__dirname, "store.json");
var SESSION_DAYS = 30;

fs.mkdirSync(DATA_DIR, { recursive: true });
var db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(
  "CREATE TABLE IF NOT EXISTS users (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  email TEXT NOT NULL UNIQUE," +
  "  name TEXT NOT NULL," +
  "  password_hash TEXT NOT NULL," +
  "  created_at TEXT NOT NULL" +
  ")"
);

db.exec(
  "CREATE TABLE IF NOT EXISTS sessions (" +
  "  token TEXT PRIMARY KEY," +
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
  "  created_at TEXT NOT NULL," +
  "  expires_at TEXT NOT NULL" +
  ")"
);

db.exec(
  "CREATE TABLE IF NOT EXISTS attempts (" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
  "  episode_id INTEGER NOT NULL," +
  "  score INTEGER NOT NULL," +
  "  total INTEGER NOT NULL," +
  "  created_at TEXT NOT NULL" +
  ")"
);
db.exec("CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, episode_id)");

db.exec(
  "CREATE TABLE IF NOT EXISTS quiz_progress (" +
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE," +
  "  episode_id INTEGER NOT NULL," +
  "  current_index INTEGER NOT NULL," +
  "  score INTEGER NOT NULL," +
  "  missed_json TEXT NOT NULL," +
  "  updated_at TEXT NOT NULL," +
  "  PRIMARY KEY (user_id, episode_id)" +
  ")"
);

// ---------- password hashing (scrypt, no dependency needed) ----------

function hashPassword(password) {
  var salt = crypto.randomBytes(16);
  var hash = crypto.scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + hash.toString("hex");
}

function verifyPassword(password, stored) {
  var parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  var salt = Buffer.from(parts[1], "hex");
  var expected = Buffer.from(parts[2], "hex");
  var actual = crypto.scryptSync(password, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// ---------- users ----------

function publicUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name };
}

function countUsers() {
  return db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
}

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(String(email || "").trim());
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function createUser(email, name, password) {
  email = String(email || "").trim();
  name = String(name || "").trim();
  var hash = hashPassword(password);
  var info = db.prepare(
    "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)"
  ).run(email, name, hash, new Date().toISOString());
  var user = getUserById(info.lastInsertRowid);

  // First-ever account inherits the old single-shared store.json history
  // (from before accounts existed) so nobody loses prior quiz scores.
  if (countUsers() === 1) importLegacyStore(user.id);

  return user;
}

function verifyLogin(email, password) {
  var user = getUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

function updateProfile(userId, fields) {
  var user = getUserById(userId);
  if (!user) return null;
  var name = fields.name !== undefined ? String(fields.name).trim() : user.name;
  var email = fields.email !== undefined ? String(fields.email).trim() : user.email;
  if (!name) throw new Error("Name can't be empty.");
  if (!email) throw new Error("Email can't be empty.");

  if (fields.newPassword) {
    if (!fields.currentPassword || !verifyPassword(fields.currentPassword, user.password_hash)) {
      throw new Error("Current password is incorrect.");
    }
    if (String(fields.newPassword).length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    var newHash = hashPassword(fields.newPassword);
    db.prepare("UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?")
      .run(name, email, newHash, userId);
  } else {
    db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, userId);
  }
  return getUserById(userId);
}

// ---------- sessions ----------

function createSession(userId) {
  var token = crypto.randomBytes(32).toString("hex");
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, userId, now.toISOString(), expires.toISOString());
  return token;
}

function getSessionUser(token) {
  if (!token) return null;
  var row = db.prepare(
    "SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id " +
    "WHERE sessions.token = ? AND sessions.expires_at > ?"
  ).get(token, new Date().toISOString());
  return row || null;
}

function deleteSession(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ---------- scores / requests (the per-user replacement for store.json) ----------

function getStoreForUser(userId) {
  var attemptRows = db.prepare(
    "SELECT episode_id, score, total, created_at FROM attempts WHERE user_id = ? ORDER BY created_at ASC"
  ).all(userId);

  var scores = {};
  attemptRows.forEach(function (row) {
    var key = String(row.episode_id);
    if (!scores[key]) scores[key] = { attempts: [], best: 0 };
    scores[key].attempts.push({ score: row.score, total: row.total, date: row.created_at });
    scores[key].best = Math.max(scores[key].best, row.score);
  });

  var progressRows = db.prepare(
    "SELECT episode_id, current_index, score, missed_json FROM quiz_progress WHERE user_id = ?"
  ).all(userId);
  var progress = {};
  progressRows.forEach(function (row) {
    var missed = [];
    try { missed = JSON.parse(row.missed_json); } catch (e) {}
    progress[String(row.episode_id)] = { currentIndex: row.current_index, score: row.score, missed: missed };
  });

  return { scores: scores, progress: progress };
}

function replaceScoresForUser(userId, scores) {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM attempts WHERE user_id = ?").run(userId);
    var insert = db.prepare(
      "INSERT INTO attempts (user_id, episode_id, score, total, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    Object.keys(scores || {}).forEach(function (episodeId) {
      var record = scores[episodeId];
      (record && record.attempts || []).forEach(function (a) {
        insert.run(userId, Number(episodeId), Number(a.score) || 0, Number(a.total) || 0, String(a.date || new Date().toISOString()));
      });
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ---------- in-progress quiz cache ("half-taken quizzes") ----------

function saveProgress(userId, episodeId, data) {
  db.prepare(
    "INSERT INTO quiz_progress (user_id, episode_id, current_index, score, missed_json, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(user_id, episode_id) DO UPDATE SET current_index = excluded.current_index, " +
    "score = excluded.score, missed_json = excluded.missed_json, updated_at = excluded.updated_at"
  ).run(userId, Number(episodeId), Number(data.currentIndex) || 0, Number(data.score) || 0,
    JSON.stringify(data.missed || []), new Date().toISOString());
}

function clearProgress(userId, episodeId) {
  db.prepare("DELETE FROM quiz_progress WHERE user_id = ? AND episode_id = ?").run(userId, Number(episodeId));
}

// ---------- one-time migration of the old shared store.json ----------

function importLegacyStore(userId) {
  var legacy;
  try {
    legacy = JSON.parse(fs.readFileSync(LEGACY_STORE_FILE, "utf8"));
  } catch (e) {
    return;
  }
  if (legacy && legacy.scores && Object.keys(legacy.scores).length) {
    replaceScoresForUser(userId, legacy.scores);
  }
}

module.exports = {
  DB_FILE: DB_FILE,
  publicUser: publicUser,
  createUser: createUser,
  verifyLogin: verifyLogin,
  getUserByEmail: getUserByEmail,
  getUserById: getUserById,
  updateProfile: updateProfile,
  createSession: createSession,
  getSessionUser: getSessionUser,
  deleteSession: deleteSession,
  getStoreForUser: getStoreForUser,
  replaceScoresForUser: replaceScoresForUser,
  saveProgress: saveProgress,
  clearProgress: clearProgress
};
