import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  throw new Error(
    "Missing TURSO_DATABASE_URL in environment.\n" +
    "  Local:  TURSO_DATABASE_URL=file:local.db\n" +
    "  Cloud:  TURSO_DATABASE_URL=libsql://your-db.turso.io"
  );
}

// authToken is only required for remote Turso connections, not local SQLite files
export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
