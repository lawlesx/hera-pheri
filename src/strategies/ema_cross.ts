import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcEMA } from "../indicators/index";

const FAST = 9;
const SLOW = 21;

export const emaCrossStrategy: Strategy = {
  name: "ema_cross",
  description: `EMA(${FAST})/EMA(${SLOW}) golden/death cross — BUY on golden cross, SELL on death cross`,
  minBars: SLOW + 2,

  generate(candles: Candle[]): Signal | null {
    const closes = candles.map((c) => c.close);
    const fast = calcEMA(closes, FAST);
    const slow = calcEMA(closes, SLOW);

    const i = candles.length - 1;
    const fastCur = fast[i];
    const slowCur = slow[i];
    const fastPrev = fast[i - 1];
    const slowPrev = slow[i - 1];

    if (fastCur == null || slowCur == null || fastPrev == null || slowPrev == null) {
      return null;
    }

    const cur = candles[i]!;

    // Golden cross: fast crosses above slow
    if (fastPrev <= slowPrev && fastCur > slowCur) {
      return { action: "BUY", reason: `EMA(${FAST}) crossed above EMA(${SLOW})`, price: cur.close, indicators: { [`ema_${FAST}`]: fastCur, [`ema_${SLOW}`]: slowCur } };
    }

    // Death cross: fast crosses below slow
    if (fastPrev >= slowPrev && fastCur < slowCur) {
      return { action: "SELL", reason: `EMA(${FAST}) crossed below EMA(${SLOW})`, price: cur.close, indicators: { [`ema_${FAST}`]: fastCur, [`ema_${SLOW}`]: slowCur } };
    }

    return null;
  },
};
