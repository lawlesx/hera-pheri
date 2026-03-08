import type { KiteInstance } from "./client";
import { getQuote } from "./client";
import { logTrade } from "../db/trades";
import type { UserId, OrderResult } from "../types";

export async function placeOrder(
  kite: KiteInstance,
  action: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  userId: UserId
): Promise<OrderResult> {
  try {
    const orderId = await kite.placeOrder("regular", {
      exchange: "NSE",
      tradingsymbol: symbol.toUpperCase(),
      transaction_type: action,
      quantity,
      product: "MIS",       // Intraday — auto squared off at market close
      order_type: "MARKET",
      validity: "DAY",
    });

    const price = await getQuote(kite, symbol);

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
