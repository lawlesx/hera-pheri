import { KiteConnect } from "kiteconnect";
import type { Connect } from "kiteconnect";
import type { UserId } from "../types";

// KiteInstance is the Connect instance type returned by `new KiteConnect()`
export type KiteInstance = Connect;

// Load per-user credentials from Railway env vars
// Format: LAWLESS_KITE_API_KEY, LAWLESS_KITE_API_SECRET
export function getEnvCredentials(userId: UserId): { apiKey: string; apiSecret: string } {
  const prefix = userId.toUpperCase();
  const apiKey = process.env[`${prefix}_KITE_API_KEY`];
  const apiSecret = process.env[`${prefix}_KITE_API_SECRET`];

  if (!apiKey || !apiSecret) {
    throw new Error(
      `Missing env vars: ${prefix}_KITE_API_KEY and/or ${prefix}_KITE_API_SECRET`
    );
  }

  return { apiKey, apiSecret };
}

// Create a per-user KiteConnect instance with access token set
export function createKiteClient(userId: UserId, accessToken: string): KiteInstance {
  const { apiKey } = getEnvCredentials(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kite = new (KiteConnect as any)({ api_key: apiKey }) as KiteInstance;
  kite.setAccessToken(accessToken);
  return kite;
}

// Check if the NSE market is currently open (9:15 AM – 3:30 PM IST, Mon–Fri)
export function isMarketOpen(): boolean {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);

  const day = ist.getDay();
  if (day === 0 || day === 6) return false;

  const totalMins = ist.getHours() * 60 + ist.getMinutes();
  return totalMins >= 9 * 60 + 15 && totalMins < 15 * 60 + 30;
}

// Fetch last traded price for a symbol
export async function getQuote(kite: KiteInstance, symbol: string): Promise<number | null> {
  try {
    const quotes = await kite.getQuote([`NSE:${symbol.toUpperCase()}`]);
    return (
      (quotes as Record<string, { last_price: number }>)[`NSE:${symbol.toUpperCase()}`]
        ?.last_price ?? null
    );
  } catch {
    return null;
  }
}
