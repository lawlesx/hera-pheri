import {
  EMA,
  SMA,
  RSI,
  MACD,
  BollingerBands,
} from "technicalindicators";
import type { Candle } from "../types";

/** Pad a shorter indicator result array to match the original input length. */
function pad<T>(values: T[], inputLength: number): (T | null)[] {
  const leading = inputLength - values.length;
  return [...Array(leading).fill(null), ...values] as (T | null)[];
}

export function calcEMA(closes: number[], period: number): (number | null)[] {
  const result = EMA.calculate({ period, values: closes });
  return pad(result, closes.length);
}

export function calcSMA(closes: number[], period: number): (number | null)[] {
  const result = SMA.calculate({ period, values: closes });
  return pad(result, closes.length);
}

export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result = RSI.calculate({ period, values: closes });
  return pad(result, closes.length);
}

export interface MACDPoint {
  macd: number;
  signal: number;
  histogram: number;
}

export function calcMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): (MACDPoint | null)[] {
  const result = MACD.calculate({
    values: closes,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const mapped = result.map((r) => {
    if (r.MACD == null || r.signal == null || r.histogram == null) return null;
    return { macd: r.MACD, signal: r.signal, histogram: r.histogram };
  });

  return pad(mapped, closes.length);
}

export interface BBPoint {
  upper: number;
  middle: number;
  lower: number;
}

export function calcBollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2
): (BBPoint | null)[] {
  const result = BollingerBands.calculate({ period, values: closes, stdDev });
  const mapped = result.map((r) => ({ upper: r.upper, middle: r.middle, lower: r.lower }));
  return pad(mapped, closes.length);
}

export interface DonchianPoint {
  upper: number;
  lower: number;
}

/** Rolling N-bar Donchian channel (highest high / lowest low). */
export function calcDonchian(
  highs: number[],
  lows: number[],
  period = 20
): (DonchianPoint | null)[] {
  const result: (DonchianPoint | null)[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const windowHighs = highs.slice(i - period + 1, i + 1);
      const windowLows = lows.slice(i - period + 1, i + 1);
      result.push({
        upper: Math.max(...windowHighs),
        lower: Math.min(...windowLows),
      });
    }
  }
  return result;
}

/**
 * Rolling N-bar VWAP: sum(typical_price × volume) / sum(volume).
 * Falls back to SMA of close when volume is zero.
 */
export function calcVWAP(candles: Candle[], period = 20): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const window = candles.slice(i - period + 1, i + 1);
      const totalVol = window.reduce((s, c) => s + c.volume, 0);
      if (totalVol === 0) {
        const avg = window.reduce((s, c) => s + c.close, 0) / window.length;
        result.push(avg);
      } else {
        const tpvol = window.reduce(
          (s, c) => s + ((c.high + c.low + c.close) / 3) * c.volume,
          0
        );
        result.push(tpvol / totalVol);
      }
    }
  }
  return result;
}
