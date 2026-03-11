import type { KiteInstance } from "./client";
import { getQuote } from "./client";
import { logTrade } from "../db/trades";
import type { UserId, OrderResult } from "../types";

export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";

export interface PlaceOrderOptions {
  /** Order type — defaults to MARKET */
  order_type?: OrderType;
  /** Limit price — required for LIMIT and SL order types */
  price?: number;
  /** Trigger price — required for SL and SL-M order types */
  trigger_price?: number;
}

export async function placeOrder(
  kite: KiteInstance,
  action: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  userId: UserId,
  options: PlaceOrderOptions = {}
): Promise<OrderResult> {
  const { order_type = "MARKET", price, trigger_price } = options;

  const orderLabel = buildOrderLabel(action, quantity, symbol, order_type, price, trigger_price);

  try {
    const params: Record<string, unknown> = {
      exchange: "NSE",
      tradingsymbol: symbol.toUpperCase(),
      transaction_type: action,
      quantity,
      product: "MIS",       // Intraday — auto squared off at market close
      order_type,
      validity: "DAY",
    };

    if (price !== undefined) params.price = price;
    if (trigger_price !== undefined) params.trigger_price = trigger_price;

    const orderId = await kite.placeOrder("regular", params as Parameters<KiteInstance["placeOrder"]>[1]);

    const executedPrice = order_type === "MARKET" ? await getQuote(kite, symbol) : (price ?? null);

    await logTrade({
      user_id: userId,
      action,
      symbol: symbol.toUpperCase(),
      quantity,
      price: executedPrice,
      order_id: String(orderId),
      status: "PLACED",
      executed_at: new Date().toISOString(),
    });

    return {
      order_id: String(orderId),
      status: "success",
      message: `${orderLabel} placed successfully`,
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

/**
 * Places exit orders (target and/or stoploss) opposite to the entry action.
 * Target → LIMIT exit order
 * Stoploss → SL-M exit order
 */
export async function placeExitOrders(
  kite: KiteInstance,
  entryAction: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  userId: UserId,
  target?: number,
  stoploss?: number
): Promise<{ targetResult?: OrderResult; slResult?: OrderResult }> {
  const exitAction = entryAction === "BUY" ? "SELL" : "BUY";
  const results: { targetResult?: OrderResult; slResult?: OrderResult } = {};

  if (target !== undefined) {
    results.targetResult = await placeOrder(kite, exitAction, symbol, quantity, userId, {
      order_type: "LIMIT",
      price: target,
    });
  }

  if (stoploss !== undefined) {
    results.slResult = await placeOrder(kite, exitAction, symbol, quantity, userId, {
      order_type: "SL-M",
      trigger_price: stoploss,
    });
  }

  return results;
}

function buildOrderLabel(
  action: string,
  quantity: number,
  symbol: string,
  order_type: OrderType,
  price?: number,
  trigger_price?: number
): string {
  const sym = symbol.toUpperCase();
  switch (order_type) {
    case "MARKET":
      return `${action} ${quantity} ${sym} @ MARKET`;
    case "LIMIT":
      return `${action} ${quantity} ${sym} @ LIMIT ₹${price}`;
    case "SL-M":
      return `${action} ${quantity} ${sym} SL-M trigger ₹${trigger_price}`;
    case "SL":
      return `${action} ${quantity} ${sym} SL trigger ₹${trigger_price} limit ₹${price}`;
  }
}
