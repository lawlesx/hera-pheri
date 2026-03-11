import type { BacktestResult, Signal, Candle } from "../types";

export function buildBacktestPrompt(result: BacktestResult): string {
  const last5 = result.trades.slice(-5).map((t) =>
    `  ${t.action} entry ₹${t.entryPrice.toFixed(0)} → exit ₹${t.exitPrice?.toFixed(0) ?? "OPEN"}` +
    `  P&L: ₹${t.pnl?.toFixed(0) ?? "OPEN"}  (${t.reason})`
  ).join("\n");

  return `You are a quantitative trading expert and friendly mentor for Indian NSE markets. You have deep technical knowledge but explain everything in simple, everyday language — like a seasoned analyst sitting next to a beginner and walking them through the numbers. No jargon without explanation. Be direct and tell them clearly what to do next.

Strategy : ${result.strategy.toUpperCase()} on ${result.symbol}
Interval : ${result.interval}  |  Period: ${result.from.split("T")[0]} → ${result.to.split("T")[0]}

Performance numbers:
  Started with    : ₹${result.initialCapital.toLocaleString("en-IN")}
  Ended with      : ₹${Math.round(result.finalCapital).toLocaleString("en-IN")}
  Total Return    : ${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%
  CAGR            : ${result.cagr >= 0 ? "+" : ""}${result.cagr.toFixed(2)}%  (yearly growth rate)
  Sharpe Ratio    : ${result.sharpe.toFixed(3)}  (above 1.0 = good, above 2.0 = excellent)
  Max Drawdown    : -${result.maxDrawdown.toFixed(2)}%  (worst dip from peak — how much you could have lost at the worst point)
  Win Rate        : ${result.winRate.toFixed(1)}%  (percentage of trades that made money)
  Total Trades    : ${result.totalTrades}

Last 5 trades:
${last5 || "  (none)"}

Please respond in this structure:
1. **What happened** — In 2 simple sentences, did this strategy make or lose money on ${result.symbol} and by how much?
2. **Is this good or bad?** — Explain what the Sharpe ratio and max drawdown mean in plain English (e.g. "a Sharpe of 1.2 means for every unit of risk you took, you got 1.2 units of reward — that's decent").
3. **Should I use this strategy?** — Give a clear YES / MAYBE / NO with a simple reason a beginner would understand.
4. **What should I do next?** — One specific, actionable next step (e.g. "Try this on one more stock before committing real money" or "Avoid this strategy — the drawdown is too high for a beginner").`;
}

export function buildSignalPrompt(
  signal: Signal,
  candle: Candle,
  indicators: Record<string, number>
): string {
  const indStr = Object.entries(indicators)
    .map(([k, v]) => `  ${k}: ${v.toFixed(2)}`)
    .join("\n");

  return `You are a quantitative trading expert and patient mentor for Indian NSE markets. You deeply understand technical indicators and market mechanics, but you explain them in plain English — like a professional analyst guiding a beginner in real time. Avoid jargon or explain it immediately when you use it. Be direct about what the beginner should do.

Symbol    : ${candle.symbol}
Signal    : ${signal.action} (this means the strategy is suggesting to ${signal.action === "BUY" ? "buy shares" : "sell shares"})
Reason    : ${signal.reason}

Current indicator readings:
${indStr || "  (none)"}

Price bar:
  Open: ₹${candle.open.toFixed(2)}  High: ₹${candle.high.toFixed(2)}  Low: ₹${candle.low.toFixed(2)}  Close: ₹${candle.close.toFixed(2)}  Volume: ${candle.volume.toLocaleString("en-IN")}

Respond in this structure:
1. **What just happened** — In 1–2 sentences, explain what the indicator did that caused this signal (e.g. "The fast moving average just crossed above the slow one, which means the price trend is turning upward").
2. **What does this mean for me?** — Tell the beginner in simple terms whether this is a strong or weak signal and why.
3. **What should I do right now?** — Give a direct, concrete suggestion (e.g. "If you were paper trading, this is a reasonable entry — but watch the ₹X level as support").`;
}

export function buildStrategyRecommendPrompt(
  symbol: string,
  results: BacktestResult[]
): string {
  const C = 12;
  const rows = results
    .sort((a, b) => b.sharpe - a.sharpe)
    .map((r) =>
      `  ${r.strategy.padEnd(C)}` +
      ` Return: ${(r.totalReturn >= 0 ? "+" : "") + r.totalReturn.toFixed(1) + "%"}`.padEnd(14) +
      ` CAGR: ${(r.cagr >= 0 ? "+" : "") + r.cagr.toFixed(1) + "%"}`.padEnd(12) +
      ` Sharpe: ${r.sharpe.toFixed(2)}`.padEnd(12) +
      ` MaxDD: -${r.maxDrawdown.toFixed(1)}%`.padEnd(12) +
      ` WinRate: ${r.winRate.toFixed(0)}%`.padEnd(12) +
      ` Trades: ${r.totalTrades}`
    )
    .join("\n");

  return `You are a quantitative trading expert and friendly mentor for Indian NSE markets. You can read backtest statistics like a professional quant, but you present your analysis in simple language a beginner can act on. Explain any terms you use. Be direct and give a clear recommendation.

Here are the backtest results for all strategies tested on ${symbol} (period: ${results[0]?.from?.split("T")[0] ?? "N/A"} → ${results[0]?.to?.split("T")[0] ?? "N/A"}, starting capital ₹1,00,000):

${rows}

Respond in this structure:
1. **Quick summary** — In 1 sentence, what does the overall picture look like for ${symbol}?
2. **Strategy breakdown** — For each strategy, one line: label it ✅ Best / ⚠️ Okay / ❌ Avoid, and explain in plain English why (e.g. "❌ Avoid donchian — it made too few trades and lost 18% at its worst point, too risky for a beginner").
3. **My top pick for you** — Name one strategy clearly and explain in 2 simple sentences why a beginner should start with this one.
4. **Before you start** — One practical tip or warning (e.g. "Remember: past results don't guarantee future profits — always start with paper trading").`;
}

export function buildRiskPrompt(
  symbol: string,
  action: "BUY" | "SELL",
  qty: number,
  entryPrice: number | null
): string {
  const priceStr  = entryPrice != null ? `₹${entryPrice.toFixed(2)}` : "market price";
  const exposure  = entryPrice != null
    ? `₹${(entryPrice * qty).toLocaleString("en-IN")}`
    : "unknown";

  return `You are a quantitative risk expert and caring mentor for Indian NSE intraday trading. You understand position sizing, volatility, and risk-reward ratios at a professional level, but you explain them in simple, everyday language — like an experienced trader protecting a beginner from common mistakes. Be direct — tell them exactly what to do to protect their money.

Trade details:
  Stock    : ${symbol}
  Action   : ${action === "BUY" ? "BUY (buying shares)" : "SELL (selling shares)"}
  Quantity : ${qty} shares
  Price    : ${priceStr}
  Total money at risk : ${exposure}
  Order type : MIS (intraday — this position will be automatically closed by the broker at 3:20 PM today if you don't close it yourself)

Respond in this structure:
1. **How much are you risking?** — In 1 plain sentence, explain what ${exposure} exposure means (e.g. "You are putting ₹X into this trade — that's the amount you could lose if it goes completely wrong").
2. **Set a stoploss** — Suggest a specific stoploss price level with a simple explanation (e.g. "Set your stoploss at ₹X — if the price falls to that level, the system will sell automatically to limit your loss to roughly ₹Y").
3. **Set a target** — Suggest a realistic profit target price with a reason.
4. **One warning** — The single most important risk a beginner should watch for with this intraday trade.`;
}
