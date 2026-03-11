import type { Candle, CandleInterval } from "../types";
import { upsertCandles } from "../db/candles";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const INTERVAL_MAP: Record<CandleInterval, string> = {
  "1min":  "1m",
  "5min":  "5m",
  "15min": "15m",
  "1h":    "60m",
  "1day":  "1d",
};

function toUnix(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

interface YahooQuote {
  open:   (number | null)[];
  high:   (number | null)[];
  low:    (number | null)[];
  close:  (number | null)[];
  volume: (number | null)[];
}

interface YahooResponse {
  chart: {
    result: {
      timestamp: number[];
      indicators: { quote: YahooQuote[] };
    }[] | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Fetch OHLCV candles from Yahoo Finance for an NSE symbol.
 * Appends ".NS" to the symbol automatically.
 */
export async function fetchCandles(
  symbol: string,
  interval: CandleInterval,
  startDate: string,
  endDate: string
): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  const yahooInterval = INTERVAL_MAP[interval];
  const period1 = toUnix(new Date(startDate));
  const period2 = toUnix(new Date(`${endDate}T23:59:59`));

  const url =
    `${YAHOO_BASE}/${sym}.NS` +
    `?interval=${yahooInterval}&period1=${period1}&period2=${period2}&events=history`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as YahooResponse;

  if (data.chart.error) {
    throw new Error(`Yahoo Finance: ${data.chart.error.description}`);
  }

  const result = data.chart.result?.[0];
  if (!result?.timestamp?.length) return [];

  const quote = result.indicators.quote[0];
  if (!quote) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open   = quote.open[i];
    const high   = quote.high[i];
    const low    = quote.low[i];
    const close  = quote.close[i];
    const volume = quote.volume[i] ?? 0;

    // Skip null bars (Yahoo returns nulls for non-trading days)
    if (open == null || high == null || low == null || close == null) continue;

    const ts = new Date(result.timestamp[i]! * 1000).toISOString();
    candles.push({ symbol: sym, interval, ts, open, high, low, close, volume });
  }

  return candles;
}

/**
 * Fetch candles for the last `days` calendar days and store them in the DB.
 * Returns the number of candles upserted.
 */
export async function fetchAndStoreCandles(
  symbol: string,
  interval: CandleInterval,
  days: number
): Promise<number> {
  const endDate   = new Date().toISOString().split("T")[0]!;
  const startDate = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0]!; })();

  const candles = await fetchCandles(symbol, interval, startDate, endDate);
  if (candles.length > 0) await upsertCandles(candles);
  return candles.length;
}

