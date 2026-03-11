import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcBollingerBands } from "../indicators/index";

const PERIOD = 20;
const STD_DEV = 2;

export const bollingerStrategy: Strategy = {
  name: "bollinger",
  description: `Bollinger Bands(${PERIOD}, ${STD_DEV}) — BUY when close reverts above lower band, SELL when close touches upper band`,
  minBars: PERIOD + 2,

  generate(candles: Candle[]): Signal | null {
    const closes = candles.map((c) => c.close);
    const bb = calcBollingerBands(closes, PERIOD, STD_DEV);

    const i = candles.length - 1;
    const curBB = bb[i];
    const prevBB = bb[i - 1];

    if (curBB == null || prevBB == null) return null;

    const bar = candles[i]!;
    const prevClose = candles[i - 1]!.close;

    // BUY: close was at or below lower band, now back above it (mean-reversion entry)
    if (prevClose <= prevBB.lower && bar.close > curBB.lower) {
      return {
        action: "BUY",
        reason: `Close reverted above lower BB (close: ${bar.close.toFixed(2)}, lower: ${curBB.lower.toFixed(2)})`,
        price: bar.close,
        indicators: { bb_upper: curBB.upper, bb_middle: curBB.middle, bb_lower: curBB.lower },
      };
    }

    // SELL: close touched or broke above upper band
    if (prevClose < prevBB.upper && bar.close >= curBB.upper) {
      return {
        action: "SELL",
        reason: `Close touched upper BB (close: ${bar.close.toFixed(2)}, upper: ${curBB.upper.toFixed(2)})`,
        price: bar.close,
        indicators: { bb_upper: curBB.upper, bb_middle: curBB.middle, bb_lower: curBB.lower },
      };
    }

    return null;
  },
};
