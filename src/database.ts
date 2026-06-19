import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "xp.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS user_xp (
    user_id        TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    xp             INTEGER NOT NULL DEFAULT 0,
    last_earned_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS missions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    xp_reward    INTEGER NOT NULL,
    target_house TEXT,
    status       TEXT    NOT NULL DEFAULT 'active',
    created_by   TEXT    NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mission_claims (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id   INTEGER NOT NULL,
    user_id      TEXT    NOT NULL,
    guild_id     TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'pending',
    claimed_at   INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (mission_id) REFERENCES missions(id),
    UNIQUE (mission_id, user_id)
  );
`);

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("missions", "claimed_by",      "TEXT");
addColumnIfMissing("missions", "message_id",     "TEXT");
addColumnIfMissing("missions", "submission_text", "TEXT");
addColumnIfMissing("missions", "submitted_at",    "INTEGER");
addColumnIfMissing("missions", "verified_by",     "TEXT");

export default db;
                            
