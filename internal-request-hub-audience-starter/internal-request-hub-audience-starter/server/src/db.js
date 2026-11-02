import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultDatabasePath = path.resolve(currentDir, "../data/request-hub.db");

export function createDatabase(filename = defaultDatabasePath) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON;");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('employee', 'reviewer', 'admin')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      requester_id INTEGER NOT NULL REFERENCES users(id),
      assigned_reviewer_id INTEGER REFERENCES users(id),
      priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled')),
      reviewer_comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
    CREATE INDEX IF NOT EXISTS idx_requests_reviewer ON requests(assigned_reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

    CREATE TABLE IF NOT EXISTS request_comments (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES requests(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_request_comments_request
      ON request_comments(request_id, created_at, id);

    CREATE TABLE IF NOT EXISTS request_decisions (
      request_id INTEGER PRIMARY KEY REFERENCES requests(id),
      decided_by_id INTEGER NOT NULL REFERENCES users(id),
      decided_at TEXT NOT NULL
    );
  `);
}

function seed(db) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (count > 0) return;

  transaction(db, () => {
    const insert = db.prepare(`
      INSERT INTO users (id, name, email, role, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    [
      [1, "Maya Nair", "maya.nair@example.test", "employee", 1],
      [2, "Rahul Shah", "rahul.shah@example.test", "employee", 1],
      [3, "Priya Menon", "priya.menon@example.test", "reviewer", 1],
      [4, "Daniel George", "daniel.george@example.test", "reviewer", 1],
      [5, "Alex Thomas", "alex.thomas@example.test", "admin", 1],
      [6, "Former Reviewer", "former.reviewer@example.test", "reviewer", 0],
    ].forEach((user) => insert.run(...user));
  });

  transaction(db, () => {
    const insert = db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)");
    [
      [1, "Equipment"],
      [2, "Software Access"],
      [3, "Training"],
      [4, "Workplace Services"],
    ].forEach((category) => insert.run(...category));
  });

  transaction(db, () => {
    const insert = db.prepare(`
      INSERT INTO requests (
        id, title, description, category_id, requester_id, assigned_reviewer_id,
        priority, status, reviewer_comment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      [101, "Additional monitor", "A second monitor is needed for frontend testing and accessibility reviews.", 1, 1, 3, "Medium", "Submitted", null, "2026-09-15T09:20:00Z", "2026-09-15T09:20:00Z"],
      [102, "API testing tool", "Access to the approved API testing workspace for the payments project.", 2, 1, 4, "High", "Approved", null, "2026-09-10T07:45:00Z", "2026-09-11T11:05:00Z"],
      [103, "Advanced React workshop", "Registration for the internal advanced React workshop next quarter.", 3, 2, 3, "Low", "Submitted", null, "2026-09-18T13:10:00Z", "2026-09-18T13:10:00Z"],
      [104, "Ergonomic keyboard", "Replacement keyboard requested following the workplace assessment.", 1, 2, 4, "Medium", "Rejected", "Please attach the workplace assessment reference.", "2026-09-08T06:30:00Z", "2026-09-09T08:15:00Z"],
      [105, "Design software license", "Draft request for a short-term design software license.", 2, 1, null, "Low", "Draft", null, "2026-09-20T10:00:00Z", "2026-09-20T10:00:00Z"],
    ].forEach((request) => insert.run(...request));
  });
}

export function transaction(db, operation) {
  db.exec("BEGIN");
  try {
    operation();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
