import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | undefined;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  repo_full_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issues_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_full_name TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_full_name, issue_number)
);
`;

export function getDb(databasePath: string): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

const READ_ONLY_PATTERN = /^\s*(select|with|explain|pragma\s+table_info)/i;

export function isReadOnlyQuery(sql: string): boolean {
  return READ_ONLY_PATTERN.test(sql);
}

export function listTables(database: Database.Database): string[] {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

export function describeTable(database: Database.Database, table: string) {
  return database.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
}

// better-sqlite3 doesn't parameterize identifiers, so table names used in
// PRAGMA/DDL-adjacent calls are validated against the real schema first.
export function quoteIdent(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
