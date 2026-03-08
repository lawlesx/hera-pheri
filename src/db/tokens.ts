import { db } from "./client";
import type { UserId } from "../types";

// Store a fresh access token for a user (called after OAuth login)
export async function saveAccessToken(userId: UserId, token: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]!;
  await db.execute({
    sql: `UPDATE users SET access_token = ?, token_date = ? WHERE id = ?`,
    args: [token, today, userId],
  });
}

// Get stored access token — returns null if missing or expired (not from today)
export async function getValidAccessToken(userId: UserId): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0];
  const result = await db.execute({
    sql: `SELECT access_token, token_date FROM users WHERE id = ?`,
    args: [userId],
  });

  const row = result.rows[0];
  if (!row || !row.access_token || row.token_date !== today) return null;

  return row.access_token as string;
}
