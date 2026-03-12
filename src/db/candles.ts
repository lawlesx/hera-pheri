import { db } from "./client";
import type { Candle, CandleInterval } from "../types";

export async function upsertCandles(candles: Candle[]): Promise<void> {
  if (candles.length === 0) return;

  // Batch upserts using INSERT OR REPLACE for idempotency
  for (const c of candles) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO candles (symbol, interval, ts, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [c.symbol, c.interval, c.ts, c.open, c.high, c.low, c.close, c.volume],
    });
  }
}

export async function getCandles(
  symbol: string,
  interval: CandleInterval,
  from?: string,
  to?: string
): Promise<Candle[]> {
  const sym = symbol.toUpperCase();

  let sql = `SELECT * FROM candles WHERE symbol = ? AND interval = ?`;
  const args: (string | number)[] = [sym, interval];

  if (from) {
    sql += ` AND ts >= ?`;
    args.push(from);
  }
  if (to) {
    sql += ` AND ts <= ?`;
    args.push(to);
  }
  sql += ` ORDER BY ts ASC`;

  const result = await db.execute({ sql, args });
  return result.rows as unknown as Candle[];
}

export async function getCandleCount(
  symbol: string,
  interval: CandleInterval
): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) as c FROM candles WHERE symbol = ? AND interval = ?`,
    args: [symbol.toUpperCase(), interval],
  });
  return Number((result.rows[0] as unknown as { c: number }).c);
}

export async function flushCandles(symbol?: string, interval?: CandleInterval): Promise<number> {
  let sql = `DELETE FROM candles`;
  const args: string[] = [];

  if (symbol && interval) {
    sql += ` WHERE symbol = ? AND interval = ?`;
    args.push(symbol.toUpperCase(), interval);
  } else if (symbol) {
    sql += ` WHERE symbol = ?`;
    args.push(symbol.toUpperCase());
  } else if (interval) {
    sql += ` WHERE interval = ?`;
    args.push(interval);
  }

  const result = await db.execute({ sql, args });
  return Number(result.rowsAffected ?? 0);
}

export async function logPaperTrade(
  strategy: string,
  symbol: string,
  action: "BUY" | "SELL",
  quantity: number,
  price: number,
  signal_reason: string,
  simulated_at: string
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO paper_trades (strategy, symbol, action, quantity, price, signal_reason, simulated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [strategy, symbol.toUpperCase(), action, quantity, price, signal_reason, simulated_at],
  });
}
