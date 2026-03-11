import type { KiteInstance } from "./client";
import { getQuote } from "./client";
import { logGTT } from "../db/gtt";
import type { UserId } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GTTOrderLeg {
  transaction_type: "BUY" | "SELL";
  order_type: "LIMIT" | "MARKET";
  product: string;
  quantity: number;
  price: number;
}

export interface PlaceGTTParams {
  trigger_type: "single" | "two-leg";
  tradingsymbol: string;
  exchange: string;
  trigger_values: number[];
  last_price: number;
  orders: GTTOrderLeg[];
}

export interface GTTResult {
  trigger_id: string;
  status: "success" | "error";
  message: string;
}

// ── Place ──────────────────────────────────────────────────────────────────

/**
 * Single-leg GTT: fires one order when price crosses the trigger.
 * Defaults to CNC (delivery) since GTT persists across sessions.
 */
export async function placeSingleGTT(
  kite: KiteInstance,
  action: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  trigger: number,
  price: number,
  userId: UserId
): Promise<GTTResult> {
  const last_price = (await getQuote(kite, symbol)) ?? price;

  try {
    const result = await (kite as unknown as {
      placeGTT(p: PlaceGTTParams): Promise<{ trigger_id: number }>;
    }).placeGTT({
      trigger_type: "single",
      tradingsymbol: symbol.toUpperCase(),
      exchange: "NSE",
      trigger_values: [trigger],
      last_price,
      orders: [
        {
          transaction_type: action,
          order_type: "LIMIT",
          product: "CNC",
          quantity,
          price,
        },
      ],
    });

    const id = String(result.trigger_id);

    await logGTT({
      user_id: userId,
      trigger_id: id,
      gtt_type: "single",
      symbol: symbol.toUpperCase(),
      quantity,
      sl_trigger: action === "SELL" ? trigger : null,
      sl_price: action === "SELL" ? price : null,
      target_trigger: action === "BUY" ? trigger : null,
      target_price: action === "BUY" ? price : null,
      action,
      placed_at: new Date().toISOString(),
    });

    return {
      trigger_id: id,
      status: "success",
      message: `GTT ${action} ${quantity} ${symbol.toUpperCase()} — trigger ₹${trigger}, limit ₹${price} (ID: ${id})`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { trigger_id: "", status: "error", message: `GTT failed: ${message}` };
  }
}

/**
 * OCO (One Cancels Other) GTT: two SELL legs on a long holding.
 * sl_trigger < current price < target_trigger
 * When either triggers, the other is automatically cancelled by Kite.
 */
export async function placeOCOGTT(
  kite: KiteInstance,
  symbol: string,
  quantity: number,
  slTrigger: number,
  slPrice: number,
  targetTrigger: number,
  targetPrice: number,
  userId: UserId
): Promise<GTTResult> {
  const last_price = (await getQuote(kite, symbol)) ?? slTrigger;

  try {
    const result = await (kite as unknown as {
      placeGTT(p: PlaceGTTParams): Promise<{ trigger_id: number }>;
    }).placeGTT({
      trigger_type: "two-leg",
      tradingsymbol: symbol.toUpperCase(),
      exchange: "NSE",
      trigger_values: [slTrigger, targetTrigger],
      last_price,
      orders: [
        {
          transaction_type: "SELL",
          order_type: "LIMIT",
          product: "CNC",
          quantity,
          price: slPrice,
        },
        {
          transaction_type: "SELL",
          order_type: "LIMIT",
          product: "CNC",
          quantity,
          price: targetPrice,
        },
      ],
    });

    const id = String(result.trigger_id);

    await logGTT({
      user_id: userId,
      trigger_id: id,
      gtt_type: "two-leg",
      symbol: symbol.toUpperCase(),
      quantity,
      sl_trigger: slTrigger,
      sl_price: slPrice,
      target_trigger: targetTrigger,
      target_price: targetPrice,
      action: null,
      placed_at: new Date().toISOString(),
    });

    return {
      trigger_id: id,
      status: "success",
      message:
        `GTT OCO ${quantity} ${symbol.toUpperCase()} — SL ₹${slTrigger}→₹${slPrice} | Target ₹${targetTrigger}→₹${targetPrice} (ID: ${id})`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { trigger_id: "", status: "error", message: `GTT OCO failed: ${message}` };
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteGTT(kite: KiteInstance, triggerId: string): Promise<GTTResult> {
  try {
    await (kite as unknown as {
      deleteGTT(id: number): Promise<unknown>;
    }).deleteGTT(parseInt(triggerId));
    return {
      trigger_id: triggerId,
      status: "success",
      message: `GTT ${triggerId} deleted`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { trigger_id: triggerId, status: "error", message: `Delete failed: ${message}` };
  }
}

// ── Display ────────────────────────────────────────────────────────────────

interface GTTEntry {
  id: number;
  status: string;
  type: string;
  condition: { tradingsymbol: string; trigger_values: number[]; last_price: number };
  orders: { transaction_type: string; quantity: number; price: number }[];
  created_at: string;
}

function col(text: string, width: number): string {
  return String(text).padEnd(width);
}

export async function displayGTTs(kite: KiteInstance): Promise<void> {
  const gtts = await (kite as unknown as { getGTTs(): Promise<GTTEntry[]> }).getGTTs();

  const active = gtts.filter(
    (g) => g.status === "active" || g.status === "triggered"
  );

  if (active.length === 0) {
    console.log("📭 No active GTT orders.");
    return;
  }

  const C = 14;
  const SEP = "─".repeat(C * 6);
  console.log(`\n⏰ GTT Orders (${active.length} active):\n`);
  console.log(SEP);
  console.log(
    ["ID", "Symbol", "Type", "Trigger(s)", "Price(s)", "Status"].map((h) => col(h, C)).join("")
  );
  console.log(SEP);

  for (const g of active) {
    const sym = g.condition.tradingsymbol;
    const triggers = g.condition.trigger_values.map((t) => `₹${t}`).join(" / ");
    const prices = g.orders.map((o) => `₹${o.price}`).join(" / ");
    const statusColored =
      g.status === "active"
        ? `\x1b[32m${col(g.status, C)}\x1b[0m`
        : `\x1b[33m${col(g.status, C)}\x1b[0m`;

    console.log(
      col(String(g.id), C) +
        col(sym, C) +
        col(g.type, C) +
        col(triggers, C) +
        col(prices, C) +
        statusColored
    );
  }

  console.log(SEP);
  console.log();
}
