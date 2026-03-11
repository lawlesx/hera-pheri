import { db } from "./client";
import type { UserId } from "../types";

export interface GTTLog {
  id?: number;
  user_id: UserId;
  trigger_id: string;
  gtt_type: "single" | "two-leg";
  symbol: string;
  quantity: number;
  sl_trigger?: number | null;
  sl_price?: number | null;
  target_trigger?: number | null;
  target_price?: number | null;
  action?: "BUY" | "SELL" | null;
  placed_at: string;
}

export async function logGTT(entry: Omit<GTTLog, "id">): Promise<void> {
  await db.execute({
    sql: `INSERT INTO gtt_orders
            (user_id, trigger_id, gtt_type, symbol, quantity,
             sl_trigger, sl_price, target_trigger, target_price, action, placed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.user_id,
      entry.trigger_id,
      entry.gtt_type,
      entry.symbol,
      entry.quantity,
      entry.sl_trigger ?? null,
      entry.sl_price ?? null,
      entry.target_trigger ?? null,
      entry.target_price ?? null,
      entry.action ?? null,
      entry.placed_at,
    ],
  });
}
