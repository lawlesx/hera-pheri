import { KiteConnect } from "kiteconnect";

if (!process.env.KITE_API_KEY) {
  throw new Error("Missing KITE_API_KEY in environment");
}

export const kite = new KiteConnect({ api_key: process.env.KITE_API_KEY });

if (process.env.KITE_ACCESS_TOKEN) {
  kite.setAccessToken(process.env.KITE_ACCESS_TOKEN);
}

/**
 * Checks if the market is currently open (NSE equity: 9:15 AM – 3:30 PM IST, Mon–Fri)
 */
export function isMarketOpen(): boolean {
  // Get current time in IST (UTC+5:30)
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);

  const day = ist.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;

  const totalMins = ist.getHours() * 60 + ist.getMinutes();
  const marketOpen = 9 * 60 + 15;   // 9:15 AM IST
  const marketClose = 15 * 60 + 30; // 3:30 PM IST

  return totalMins >= marketOpen && totalMins < marketClose;
}

/**
 * Fetches the last traded price for a given NSE symbol
 */
export async function getQuote(symbol: string): Promise<number | null> {
  try {
    const quote = await kite.getQuote([`NSE:${symbol.toUpperCase()}`]);
    return (quote as Record<string, { last_price: number }>)[`NSE:${symbol.toUpperCase()}`]?.last_price ?? null;
  } catch {
    return null;
  }
}
