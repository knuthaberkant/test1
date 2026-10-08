import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  default_checklist_id INTEGER REFERENCES checklists(id) ON DELETE SET NULL,
  locked_to_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  ai_description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ai_description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ai_description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES checklists(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','signed')),
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  completed_at TEXT,
  summary TEXT,
  summary_source TEXT,
  summary_original TEXT,
  signature TEXT,
  signed_at TEXT,
  signer_name TEXT,
  location_lat REAL,
  location_lng REAL,
  location_accuracy REAL,
  location_label TEXT,
  location_status TEXT,
  report_json TEXT
);

CREATE TABLE IF NOT EXISTS run_items (
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  comment TEXT,
  comment_source TEXT,
  comment_original TEXT,
  PRIMARY KEY (run_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_checklist ON runs(checklist_id);
CREATE INDEX IF NOT EXISTS idx_sections_checklist ON sections(checklist_id);
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section_id);
`;

type Row = Record<string, unknown>;

/**
 * Thin wrapper around node:sqlite. Rows are copied into plain objects because node:sqlite returns
 * null-prototype objects, which React refuses to pass from server to client components.
 */
export class Db {
  constructor(private readonly raw: DatabaseSync) {}

  exec(sql: string) {
    this.raw.exec(sql);
  }

  prepare(sql: string) {
    const stmt = this.raw.prepare(sql);
    return {
      run: (...params: SQLInputValue[]) => stmt.run(...params),
      get: (...params: SQLInputValue[]): Row | undefined => {
        const row = stmt.get(...params);
        return row ? { ...row } : undefined;
      },
      all: (...params: SQLInputValue[]): Row[] => stmt.all(...params).map((row) => ({ ...row })),
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __checklistDb: Db | undefined;
}

function open(): Db {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "checklisten.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Db(new DatabaseSync(file));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  seed(db);
  return db;
}

export function getDb(): Db {
  if (!globalThis.__checklistDb) globalThis.__checklistDb = open();
  return globalThis.__checklistDb;
}

export const nowIso = () => new Date().toISOString();

/** Runs fn inside BEGIN/COMMIT, rolling back if it throws. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function seed(db: Db) {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (count > 0) return;

  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin";
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role, default_checklist_id) VALUES (?, ?, ?, ?, ?)",
  );

  transaction(db, () => {
    insertUser.run("Administrator", adminEmail, hashPassword(adminPassword), "admin", null);
    if (process.env.SEED_DEMO === "false") return;

    const checklistId = Number(
      db
        .prepare("INSERT INTO checklists (name, description) VALUES (?, ?)")
        .run(
          "Baustellenabnahme",
          "Abnahme eines Bauabschnitts vor Übergabe an den Auftraggeber.",
        ).lastInsertRowid,
    );
    const phases: [string, string | null, [string, string | null][]][] = [
      [
        "Vorbereitung",
        "Alles, was vor dem Rundgang erledigt sein muss.",
        [
          ["Bauunterlagen und Pläne vor Ort", null],
          ["Persönliche Schutzausrüstung angelegt", "Helm, Sicherheitsschuhe und Warnweste sind Pflicht."],
          ["Auftraggeber über Termin informiert", null],
        ],
      ],
      [
        "Begehung",
        null,
        [
          ["Rohbau auf Risse und Schäden geprüft", null],
          ["Fenster und Türen funktionsfähig", null],
          ["Elektroinstallation sichtgeprüft", null],
          ["Sanitäranlagen dicht", null],
        ],
      ],
      [
        "Abschluss",
        "Dokumentation und Übergabe.",
        [
          ["Mängel fotografiert und dokumentiert", null],
          ["Schlüssel übergeben", null],
        ],
      ],
    ];
    const insSection = db.prepare(
      "INSERT INTO sections (checklist_id, title, description, position) VALUES (?, ?, ?, ?)",
    );
    const insItem = db.prepare(
      "INSERT INTO items (section_id, title, description, position) VALUES (?, ?, ?, ?)",
    );
    phases.forEach(([title, desc, items], i) => {
      const sid = Number(insSection.run(checklistId, title, desc, i).lastInsertRowid);
      items.forEach(([t, d], j) => insItem.run(sid, t, d, j));
    });
    insertUser.run("Max Mustermann", "max@example.com", hashPassword("demo"), "user", checklistId);
  });
}
