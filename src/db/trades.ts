import { db } from "./client";
import type { Trade } from "../types";

export async function logTrade(trade: Omit<Trade, "id">): Promise<void> {
  await db.execute({
    sql: `INSERT INTO trades (user_id, action, symbol, quantity, price, order_id, status, executed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      trade.user_id,
      trade.action,
      trade.symbol,
      trade.quantity,
      trade.price ?? null,
      trade.order_id ?? null,
      trade.status,
      trade.executed_at,
    ],
  });
}

export async function getTradeHistory(userId: string): Promise<Trade[]> {
  const result = await db.execute({
    sql: `SELECT * FROM trades WHERE user_id = ? ORDER BY executed_at DESC LIMIT 20`,
    args: [userId],
  });

  return result.rows as unknown as Trade[];
}

export async function getAllTrades(): Promise<Trade[]> {
  const result = await db.execute({
    sql: `SELECT t.*, u.id as user_name FROM trades t JOIN users u ON t.user_id = u.id ORDER BY t.executed_at DESC LIMIT 50`,
    args: [],
  });

  return result.rows as unknown as Trade[];
}
