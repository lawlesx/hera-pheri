import type { BacktestTrade } from "../types";

/** Annualised Sharpe ratio (assumes risk-free rate ≈ 0 for simplicity). */
export function calcSharpe(dailyReturns: number[]): number {
  const n = dailyReturns.length;
  if (n < 2) return 0;

  const mean = dailyReturns.reduce((s, r) => s + r, 0) / n;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (mean / stdDev) * Math.sqrt(252); // annualise assuming ~252 trading days
}

/**
 * Compound Annual Growth Rate.
 * @param days - Calendar days between first and last bar.
 */
export function calcCAGR(initial: number, final: number, days: number): number {
  if (initial <= 0 || days <= 0) return 0;
  const years = days / 365;
  return (Math.pow(final / initial, 1 / years) - 1) * 100;
}

/**
 * Maximum drawdown as a percentage.
 * @param equityCurve - Array of equity values in chronological order.
 */
export function calcMaxDrawdown(equityCurve: number[]): number {
  let peak = equityCurve[0] ?? 0;
  let maxDD = 0;

  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }

  return maxDD;
}

/** Win rate as a percentage across all closed trades. */
export function calcWinRate(trades: BacktestTrade[]): number {
  const closed = trades.filter((t) => t.pnl != null);
  if (closed.length === 0) return 0;
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  return (wins / closed.length) * 100;
}
