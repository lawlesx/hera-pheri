import type { BacktestResult } from "../types";

function col(text: string, width: number): string {
  return String(text).padEnd(width);
}

function pct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function color(text: string, positive: boolean): string {
  return positive ? `\x1b[32m${text}\x1b[0m` : `\x1b[31m${text}\x1b[0m`;
}

/** Print a formatted summary table to the terminal. */
export function printBacktestSummary(result: BacktestResult): void {
  const SEP = "─".repeat(52);
  console.log(`\n📊 Backtest Results — ${result.strategy.toUpperCase()} on ${result.symbol} (${result.interval})`);
  console.log(`   Period: ${result.from.split("T")[0]} → ${result.to.split("T")[0]}`);
  console.log(SEP);

  const rows: [string, string][] = [
    ["Initial Capital", `₹${result.initialCapital.toLocaleString("en-IN")}`],
    ["Final Capital",   `₹${Math.round(result.finalCapital).toLocaleString("en-IN")}`],
    ["Total Return",    color(pct(result.totalReturn), result.totalReturn >= 0)],
    ["CAGR",           color(pct(result.cagr), result.cagr >= 0)],
    ["Sharpe Ratio",   result.sharpe.toFixed(3)],
    ["Max Drawdown",   color(`-${result.maxDrawdown.toFixed(2)}%`, false)],
    ["Win Rate",       `${result.winRate.toFixed(1)}%`],
    ["Total Trades",   String(result.totalTrades)],
  ];

  for (const [label, value] of rows) {
    console.log(`  ${col(label, 20)} ${value}`);
  }
  console.log(SEP);

  if (result.trades.length > 0) {
    console.log("\n📋 Last 10 Trades:\n");
    const C = 12;
    console.log(["Entry", "Exit", "Buy@", "Sell@", "Qty", "P&L"].map((h) => col(h, C)).join(""));
    console.log("─".repeat(C * 6));
    const recent = result.trades.slice(-10);
    for (const t of recent) {
      const pnlStr = t.pnl != null ? `₹${Math.round(t.pnl)}` : "OPEN";
      const positive = (t.pnl ?? 0) >= 0;
      console.log(
        col((t.entryTs ?? "").slice(0, 10), C) +
          col((t.exitTs ?? "OPEN").slice(0, 10), C) +
          col(`₹${t.entryPrice.toFixed(0)}`, C) +
          col(t.exitPrice != null ? `₹${t.exitPrice.toFixed(0)}` : "-", C) +
          col(String(t.qty), C) +
          color(col(pnlStr, C), positive)
      );
    }
    console.log();
  }
}

/** Export full backtest result to a JSON file in ./exports/ */
export async function exportBacktestJSON(result: BacktestResult): Promise<string> {
  const dir = "./exports";
  await Bun.$`mkdir -p ${dir}`.quiet();

  const date = new Date().toISOString().split("T")[0];
  const filename = `${dir}/backtest_${result.strategy}_${result.symbol}_${date}.json`;

  await Bun.write(filename, JSON.stringify(result, null, 2));
  return filename;
}
