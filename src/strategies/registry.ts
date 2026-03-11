import type { Strategy } from "./base";
import { emaCrossStrategy } from "./ema_cross";
import { rsiStrategy } from "./rsi";
import { macdStrategy } from "./macd";
import { bollingerStrategy } from "./bollinger";
import { donchianStrategy } from "./donchian";
import { vwapStrategy } from "./vwap";

export const STRATEGIES: Record<string, Strategy> = {
  ema_cross: emaCrossStrategy,
  rsi: rsiStrategy,
  macd: macdStrategy,
  bollinger: bollingerStrategy,
  donchian: donchianStrategy,
  vwap: vwapStrategy,
};
