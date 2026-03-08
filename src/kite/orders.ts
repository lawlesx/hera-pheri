import { kite, getQuote } from "./client";
import { logTrade } from "../db/trades";
import type { UserId, OrderResult } from "../types";

export async function placeOrder(
  action: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  userId: UserId
): Promise<OrderResult> {
  try {
    const orderId = await kite.placeOrder("regular", {
      exchange: "NSE",
      tradingsymbol: symbol.toUpperCase(),
      transaction_type: action === "BUY" ? "BUY" : "SELL",
      quantity,
      product: "MIS",          // Intraday — Margin Intraday Square-off
      order_type: "MARKET",
      validity: "DAY",
    });

    // Fetch last traded price as approximate execution price
    const price = await getQuote(symbol);

    await logTrade({
      user_id: userId,
      action,
      symbol: symbol.toUpperCase(),
      quantity,
      price,
      order_id: String(orderId),
      status: "PLACED",
      executed_at: new Date().toISOString(),
    });

    return {
      order_id: String(orderId),
      status: "success",
      message: `${action} ${quantity} ${symbol.toUpperCase()} @ MARKET placed successfully`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      order_id: "",
      status: "error",
      message: `Order failed: ${message}`,
    };
  }
}
