import type { Candle, CandleInterval } from "../types";
import { upsertCandles } from "../db/candles";

const TWELVEDATA_BASE = "https://api.twelvedata.com";

function getApiKey(): string {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) {
    throw new Error(
      "Missing TWELVEDATA_API_KEY in environment.\n" +
      "  Get a free API key at https://twelvedata.com\n" +
      "  Then add: TWELVEDATA_API_KEY=your_key to your .env"
    );
  }
  return key;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

interface TwelveDataBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TwelveDataResponse {
  status: string;
  message?: string;
  meta?: { symbol: string; interval: string };
  values?: TwelveDataBar[];
}

/**
 * Fetch OHLCV candles from TwelveData for an NSE symbol.
 * Uses start_date/end_date to control the range precisely.
 */
export async function fetchCandles(
  symbol: string,
  interval: CandleInterval,
  startDate: string,
  endDate: string
): Promise<Candle[]> {
  const apiKey = getApiKey();
  const sym = symbol.toUpperCase();

  const url = new URL(`${TWELVEDATA_BASE}/time_series`);
  url.searchParams.set("symbol", sym);
  url.searchParams.set("exchange", "NSE");
  url.searchParams.set("interval", interval);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("order", "ASC");
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TwelveData HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as TwelveDataResponse;

  if (data.status === "error") {
    throw new Error(`TwelveData error: ${data.message ?? "unknown error"}`);
  }

  if (!data.values || data.values.length === 0) {
    return [];
  }

  return data.values.map((bar) => ({
    symbol: sym,
    interval,
    ts: bar.datetime,
    open: parseFloat(bar.open),
    high: parseFloat(bar.high),
    low: parseFloat(bar.low),
    close: parseFloat(bar.close),
    volume: parseInt(bar.volume, 10) || 0,
  }));
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
  const endDate = toISODate(new Date());
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = toISODate(start);

  const candles = await fetchCandles(symbol, interval, startDate, endDate);
  if (candles.length > 0) {
    await upsertCandles(candles);
  }
  return candles.length;
}
