import { db } from "./client";
import type { Trade } from "../types";

export interface UsageStats {
  today: number;
  week: number;
  month: number;
  allTime: number;
  byOrderType: Record<string, number>;
  estimatedBrokerage: { today: number; week: number; month: number };
}

// Zerodha intraday brokerage: min(₹20, 0.03% of turnover) per executed order.
// CNC (GTT) = zero brokerage. We estimate using ₹20 flat as a conservative upper bound.
function estimateBrokerage(orderCount: number): number {
  return orderCount * 20;
}

export async function logTrade(trade: Omit<Trade, "id">): Promise<void> {
  await db.execute({
    sql: `INSERT INTO trades (user_id, action, symbol, quantity, price, order_id, order_type, status, executed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      trade.user_id,
      trade.action,
      trade.symbol,
      trade.quantity,
      trade.price ?? null,
      trade.order_id ?? null,
      trade.order_type,
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
    sql: `SELECT t.*, u.id as user_name FROM trades t JOIN users u ON t.user_id = u.id ORDER BY t.executed_at DESC LIMIT 50`, // u.name doesn't exist — using u.id
    args: [],
  });

  return result.rows as unknown as Trade[];
}

export async function getUsageStats(userId: string): Promise<UsageStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayRes, weekRes, monthRes, allRes, byTypeRes] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as c FROM trades WHERE user_id = ? AND executed_at >= ?`, args: [userId, todayStart] }),
    db.execute({ sql: `SELECT COUNT(*) as c FROM trades WHERE user_id = ? AND executed_at >= ?`, args: [userId, weekStart] }),
    db.execute({ sql: `SELECT COUNT(*) as c FROM trades WHERE user_id = ? AND executed_at >= ?`, args: [userId, monthStart] }),
    db.execute({ sql: `SELECT COUNT(*) as c FROM trades WHERE user_id = ?`, args: [userId] }),
    db.execute({ sql: `SELECT order_type, COUNT(*) as c FROM trades WHERE user_id = ? GROUP BY order_type`, args: [userId] }),
  ]);

  const today = Number((todayRes.rows[0] as unknown as { c: number }).c);
  const week = Number((weekRes.rows[0] as unknown as { c: number }).c);
  const month = Number((monthRes.rows[0] as unknown as { c: number }).c);
  const allTime = Number((allRes.rows[0] as unknown as { c: number }).c);

  const byOrderType: Record<string, number> = {};
  for (const row of byTypeRes.rows as unknown as { order_type: string; c: number }[]) {
    byOrderType[row.order_type] = Number(row.c);
  }

  return {
    today, week, month, allTime,
    byOrderType,
    estimatedBrokerage: {
      today: estimateBrokerage(today),
      week: estimateBrokerage(week),
      month: estimateBrokerage(month),
    },
  };
}
