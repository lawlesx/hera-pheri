import type { Candle, Signal } from "../types";
import type { Strategy } from "./base";
import { calcDonchian } from "../indicators/index";

const PERIOD = 20;

export const donchianStrategy: Strategy = {
  name: "donchian",
  description: `Donchian Channel(${PERIOD}) breakout — BUY on new ${PERIOD}-bar high, SELL on new ${PERIOD}-bar low`,
  minBars: PERIOD + 1,

  generate(candles: Candle[]): Signal | null {
    // Compute channel on all bars EXCEPT the current one (look-ahead free)
    // Signal fires when current close breaks out of the previous bar's channel
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const dc = calcDonchian(highs, lows, PERIOD);

    const i = candles.length - 1;
    // Use yesterday's channel as the reference to avoid look-ahead
    const prevDC = dc[i - 1];

    if (prevDC == null) return null;

    const bar = candles[i]!;

    // BUY: close breaks above prior N-bar high (upside breakout)
    if (bar.close > prevDC.upper) {
      return {
        action: "BUY",
        reason: `Close broke ${PERIOD}-bar high (${bar.close.toFixed(2)} > ${prevDC.upper.toFixed(2)})`,
        price: bar.close,
        indicators: { dc_upper: prevDC.upper, dc_lower: prevDC.lower },
      };
    }

    // SELL: close breaks below prior N-bar low (downside breakout)
    if (bar.close < prevDC.lower) {
      return {
        action: "SELL",
        reason: `Close broke ${PERIOD}-bar low (${bar.close.toFixed(2)} < ${prevDC.lower.toFixed(2)})`,
        price: bar.close,
        indicators: { dc_upper: prevDC.upper, dc_lower: prevDC.lower },
      };
    }

    return null;
  },
};
