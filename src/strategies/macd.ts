import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcMACD } from "../indicators/index";

const FAST = 12;
const SLOW = 26;
const SIGNAL = 9;

export const macdStrategy: Strategy = {
  name: "macd",
  description: `MACD(${FAST},${SLOW},${SIGNAL}) — BUY on MACD-signal crossover, SELL on MACD-signal crossunder`,
  minBars: SLOW + SIGNAL + 2,

  generate(candles: Candle[]): Signal | null {
    const closes = candles.map((c) => c.close);
    const macd = calcMACD(closes, FAST, SLOW, SIGNAL);

    const i = candles.length - 1;
    const cur = macd[i];
    const prev = macd[i - 1];

    if (cur == null || prev == null) return null;

    const bar = candles[i]!;

    // BUY: MACD line crosses above signal line
    if (prev.macd <= prev.signal && cur.macd > cur.signal) {
      return {
        action: "BUY",
        reason: `MACD crossed above signal line (MACD: ${cur.macd.toFixed(2)}, Signal: ${cur.signal.toFixed(2)})`,
        price: bar.close,
      };
    }

    // SELL: MACD line crosses below signal line
    if (prev.macd >= prev.signal && cur.macd < cur.signal) {
      return {
        action: "SELL",
        reason: `MACD crossed below signal line (MACD: ${cur.macd.toFixed(2)}, Signal: ${cur.signal.toFixed(2)})`,
        price: bar.close,
      };
    }

    return null;
  },
};
