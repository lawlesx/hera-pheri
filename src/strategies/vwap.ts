import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcVWAP } from "../indicators/index";

const PERIOD = 20;

export const vwapStrategy: Strategy = {
  name: "vwap",
  description: `Rolling VWAP(${PERIOD}) — BUY when close crosses above VWAP, SELL when close crosses below VWAP`,
  minBars: PERIOD + 2,

  generate(candles: Candle[]): Signal | null {
    const vwap = calcVWAP(candles, PERIOD);

    const i = candles.length - 1;
    const vwapCur = vwap[i];
    const vwapPrev = vwap[i - 1];

    if (vwapCur == null || vwapPrev == null) return null;

    const bar = candles[i]!;
    const prevClose = candles[i - 1]!.close;

    // BUY: close crosses above VWAP
    if (prevClose <= vwapPrev && bar.close > vwapCur) {
      return {
        action: "BUY",
        reason: `Close crossed above VWAP (close: ${bar.close.toFixed(2)}, VWAP: ${vwapCur.toFixed(2)})`,
        price: bar.close,
        indicators: { vwap: vwapCur },
      };
    }

    // SELL: close crosses below VWAP
    if (prevClose >= vwapPrev && bar.close < vwapCur) {
      return {
        action: "SELL",
        reason: `Close crossed below VWAP (close: ${bar.close.toFixed(2)}, VWAP: ${vwapCur.toFixed(2)})`,
        price: bar.close,
        indicators: { vwap: vwapCur },
      };
    }

    return null;
  },
};
