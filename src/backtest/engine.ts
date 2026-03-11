import type { Candle, BacktestResult, BacktestTrade } from "../types";
import type { Strategy } from "../strategies/base";
import { calcSharpe, calcCAGR, calcMaxDrawdown, calcWinRate } from "./metrics";

export interface BacktestOptions {
  initialCapital: number;    // default 100_000
  positionSizePct: number;   // 0–1, fraction of available capital per trade; default 1.0
  commission: number;        // ₹ per order leg; default 20
}

const DEFAULTS: BacktestOptions = {
  initialCapital: 100_000,
  positionSizePct: 1.0,
  commission: 20,
};

type Position = { entryTs: string; entryPrice: number; qty: number; reason: string } | null;

export function runBacktest(
  strategy: Strategy,
  candles: Candle[],
  opts: Partial<BacktestOptions> = {}
): BacktestResult {
  const { initialCapital, positionSizePct, commission } = { ...DEFAULTS, ...opts };

  const trades: BacktestTrade[] = [];
  const equityCurve: { ts: string; equity: number }[] = [];

  let cash = initialCapital;
  let position: Position = null;

  for (let i = strategy.minBars - 1; i < candles.length; i++) {
    const history = candles.slice(0, i + 1);
    const signal = strategy.generate(history);

    // Record equity at each bar (mark-to-market)
    const barClose = candles[i]!.close;
    const positionValue = position ? position.qty * barClose : 0;
    equityCurve.push({ ts: candles[i]!.ts, equity: cash + positionValue });

    if (signal == null) continue;

    // Fills happen at the OPEN of the NEXT bar to avoid look-ahead bias
    const nextIdx = i + 1;
    if (nextIdx >= candles.length) continue;
    const fillPrice = candles[nextIdx]!.open;

    if (signal.action === "BUY" && position === null) {
      const budget = cash * positionSizePct;
      const qty = Math.floor((budget - commission) / fillPrice);
      if (qty <= 0) continue;

      const cost = qty * fillPrice + commission;
      cash -= cost;

      position = {
        entryTs: candles[nextIdx]!.ts,
        entryPrice: fillPrice,
        qty,
        reason: signal.reason,
      };
    } else if (signal.action === "SELL" && position !== null) {
      const proceeds = position.qty * fillPrice - commission;
      const pnl = proceeds - position.qty * position.entryPrice;
      cash += proceeds;

      trades.push({
        entryTs: position.entryTs,
        exitTs: candles[nextIdx]!.ts,
        action: "BUY",
        entryPrice: position.entryPrice,
        exitPrice: fillPrice,
        qty: position.qty,
        pnl: pnl - commission, // both entry and exit commission
        commission: commission * 2,
        reason: position.reason,
      });

      position = null;
    }
  }

  // Force-close any open position at the last bar's close
  if (position !== null && candles.length > 0) {
    const lastBar = candles[candles.length - 1]!;
    const fillPrice = lastBar.close;
    const proceeds = position.qty * fillPrice - commission;
    const pnl = proceeds - position.qty * position.entryPrice;
    cash += proceeds;

    trades.push({
      entryTs: position.entryTs,
      exitTs: lastBar.ts,
      action: "BUY",
      entryPrice: position.entryPrice,
      exitPrice: fillPrice,
      qty: position.qty,
      pnl: pnl - commission,
      commission: commission * 2,
      reason: position.reason + " [forced close]",
    });

    position = null;
  }

  const finalCapital = cash;
  const dailyReturns = equityCurve.map((p, i) =>
    i === 0 ? 0 : (p.equity - equityCurve[i - 1]!.equity) / equityCurve[i - 1]!.equity
  );

  const from = candles[strategy.minBars - 1]?.ts ?? candles[0]!.ts;
  const to = candles[candles.length - 1]!.ts;
  const days = Math.max(
    1,
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    strategy: strategy.name,
    symbol: candles[0]!.symbol,
    interval: candles[0]!.interval,
    from,
    to,
    initialCapital,
    finalCapital,
    totalReturn: ((finalCapital - initialCapital) / initialCapital) * 100,
    cagr: calcCAGR(initialCapital, finalCapital, days),
    sharpe: calcSharpe(dailyReturns),
    maxDrawdown: calcMaxDrawdown(equityCurve.map((p) => p.equity)),
    winRate: calcWinRate(trades),
    totalTrades: trades.length,
    trades,
    equityCurve,
  };
}
