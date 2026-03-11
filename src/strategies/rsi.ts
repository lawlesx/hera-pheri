import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcRSI } from "../indicators/index";

const PERIOD = 14;
const OVERSOLD = 30;
const OVERBOUGHT = 70;

export const rsiStrategy: Strategy = {
  name: "rsi",
  description: `RSI(${PERIOD}) mean-reversion — BUY when RSI crosses above ${OVERSOLD}, SELL when RSI crosses below ${OVERBOUGHT}`,
  minBars: PERIOD + 2,

  generate(candles: Candle[]): Signal | null {
    const closes = candles.map((c) => c.close);
    const rsi = calcRSI(closes, PERIOD);

    const i = candles.length - 1;
    const rsiCur = rsi[i];
    const rsiPrev = rsi[i - 1];

    if (rsiCur == null || rsiPrev == null) return null;

    const cur = candles[i]!;

    // BUY: RSI crosses above oversold threshold (reversal from oversold)
    if (rsiPrev <= OVERSOLD && rsiCur > OVERSOLD) {
      return { action: "BUY", reason: `RSI(${PERIOD}) crossed above ${OVERSOLD} (oversold reversal: ${rsiCur.toFixed(1)})`, price: cur.close };
    }

    // SELL: RSI crosses below overbought threshold (reversal from overbought)
    if (rsiPrev >= OVERBOUGHT && rsiCur < OVERBOUGHT) {
      return { action: "SELL", reason: `RSI(${PERIOD}) crossed below ${OVERBOUGHT} (overbought reversal: ${rsiCur.toFixed(1)})`, price: cur.close };
    }

    return null;
  },
};
