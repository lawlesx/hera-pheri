import { db } from "./client";

export async function runMigrations(): Promise<void> {
  // Users table — only stores the daily rotating access token
  // api_key and api_secret live in Railway env vars, never in DB
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,   -- 'lawless' | 'splinter'
      access_token TEXT,               -- Kite access token (expires 6 AM daily)
      token_date   TEXT                -- ISO date string of when token was issued
    )
  `);

  // Trades table — per-user trade log
  await db.execute(`
    CREATE TABLE IF NOT EXISTS trades (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id),
      action      TEXT NOT NULL CHECK(action IN ('BUY', 'SELL')),
      symbol      TEXT NOT NULL,
      quantity    INTEGER NOT NULL,
      price       REAL,
      order_id    TEXT,
      status      TEXT NOT NULL,
      executed_at DATETIME NOT NULL
    )
  `);

  // Seed user rows (no secrets — just the ID placeholder)
  await db.execute(`INSERT OR IGNORE INTO users (id) VALUES ('lawless')`);
  await db.execute(`INSERT OR IGNORE INTO users (id) VALUES ('splinter')`);

  console.log("✅ Migrations complete.");
}

if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}
