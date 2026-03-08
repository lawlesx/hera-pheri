import { db } from "./client";

export async function runMigrations(): Promise<void> {
  // Create users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create trades table
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

  // Seed users if not already present
  await db.execute(`
    INSERT OR IGNORE INTO users (id, name) VALUES ('lawless', 'Lawless')
  `);
  await db.execute(`
    INSERT OR IGNORE INTO users (id, name) VALUES ('splinter', 'Splinter')
  `);

  console.log("✅ Migrations complete. Users seeded.");
}

// Allow running directly: bun run src/db/migrate.ts
if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}
