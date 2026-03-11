import type { Candle, Signal } from "../types";

export interface Strategy {
  name: string;
  description: string;
  /** Minimum number of candles required before generate() can produce a signal. */
  minBars: number;
  /**
   * Returns a Signal for the last candle in the array, or null if no actionable signal.
   * Receives all candles up to and including the current bar.
   */
  generate(candles: Candle[]): Signal | null;
}
