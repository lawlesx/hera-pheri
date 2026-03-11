import * as readline from "readline";
import type { KiteInstance } from "../kite/client";
import { createKiteClient, isMarketOpen, getQuote } from "../kite/client";
import { runKiteLogin } from "../kite/auth";
import { getValidAccessToken } from "../db/tokens";
import { placeOrder, placeExitOrders } from "../kite/orders";
import type { PlaceOrderOptions } from "../kite/orders";
import { placeSingleGTT, placeOCOGTT, deleteGTT, displayGTTs } from "../kite/gtt";
import { getTradeHistory, getUsageStats } from "../db/trades";
import { displayPositions, displayOrders, displayHistory, displayFunds, displayUsage } from "../kite/portfolio";
import { fetchAndStoreCandles } from "../kite/historical";
import { getCandles } from "../db/candles";
import { runBacktest } from "../backtest/engine";
import { printBacktestSummary, exportBacktestJSON } from "../backtest/reporter";
import { startPaperTrading } from "../paper/trader";
import { STRATEGIES } from "../strategies/registry";
import { analyzeBacktest, recommendStrategies, getRiskAdvice } from "../llm/analyst";
import type { UserId, CandleInterval } from "../types";

const VALID_USERS: UserId[] = ["lawless", "splinter"];

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════╗
║      🐍 HERA-PHERI TRADE BOT         ║
║    NSE Intraday — MIS / Limit / SL   ║
╚══════════════════════════════════════╝
`);
}

function printHelp(): void {
  console.log(`
📖 Commands:
  buy  <SYMBOL> <QTY> [limit <PRICE>]           Market or Limit BUY
  buy  <SYMBOL> <QTY> [sl <TRIGGER> [<PRICE>]]  SL-M or SL BUY
  sell <SYMBOL> <QTY> [limit <PRICE>]           Market or Limit SELL
  sell <SYMBOL> <QTY> [sl <TRIGGER> [<PRICE>]]  SL-M or SL SELL

  After any entry order you will be prompted for an optional
  Target price (LIMIT exit) and Stoploss price (SL-M exit).

  gtt  <buy|sell> <SYMBOL> <QTY> <TRIGGER> <PRICE>        Single-leg GTT (CNC)
  gtt  oco <SYMBOL> <QTY> <SL_TRIG> <SL_PX> <TGT_TRIG> <TGT_PX>   OCO GTT
  gtts                                                    List active GTT orders
  gtt  delete <ID>                                        Delete a GTT by ID

  watch <S1> [S2...]      Live price feed (press Enter to stop)
  quote <SYMBOL>          Get current price of a stock
  positions               Open positions with P&L
  orders                  Today's order book
  history                 Show your last 20 trades
  funds                   Show available cash & margin
  usage                   Show order usage & estimated brokerage

📐 Algorithmic / Backtesting:
  fetch <SYMBOL> [interval=1day] [days=365]
                          Download OHLCV candles from TwelveData into DB
  backtest <STRATEGY> <SYMBOL> [interval=1day] [days=365] [capital=100000]
                          Run backtest and export results to ./exports/
  recommend <SYMBOL> [interval=1day] [days=365]
                          Run all strategies on a symbol and get AI recommendation
  paper <STRATEGY> <SYMBOL> [qty=1]
                          Live paper trading loop (press Enter to stop)
  strategies              List available strategies

  help                    Show this help
  ref                     Quick reference — order types, GTT params, glossary
  exit                    Exit the bot

📌 Examples:
  buy  RELIANCE 10
  buy  RELIANCE 10 limit 2500
  sell INFY 5 sl 1400
  sell TCS 3 sl 3800 3795
  gtt  buy RELIANCE 10 2400 2395
  gtt  oco RELIANCE 10 2400 2390 2700 2710
  gtt  delete 123456
  gtts
  fetch RELIANCE 1day 365
  backtest ema_cross RELIANCE 1day 365 100000
  paper rsi RELIANCE 10
  strategies
`);
}

function printRef(): void {
  console.log(`
📚 Quick Reference

─── Order Types ─────────────────────────────────
  MARKET   Execute immediately at current market price. No price control.
  LIMIT    Execute only at your specified price or better. May not fill
           immediately if price isn’t reached.
  SL       Stop-Loss Limit. Waits for TRIGGER, then places a LIMIT at PRICE.
           You control both levels.
  SL-M     Stop-Loss Market. Waits for TRIGGER, then fires a MARKET order.
           Guaranteed fill, but no price control.

─── Products ──────────────────────────────────
  MIS      Margin Intraday Square-off. Zerodha auto-closes all open MIS
           positions at 3:20 PM IST. Used by buy/sell commands.
  CNC      Cash and Carry (delivery). Holds overnight/long term.
           Used by all GTT orders.

─── GTT – Good Till Triggered ──────────────────────
  Lives on Kite’s servers. Fires when price condition is met — survives
  across sessions, days, or weeks until triggered or deleted.

  single   One trigger → one order. Use for: buy a dip, set a target, set SL.
  OCO      Two triggers on the same holding. When one fires, Kite auto-cancels
           the other (One Cancels Other).

  GTT parameters:
    TRIGGER    Price level that activates the order.
    PRICE      Limit price of the order placed once triggered.
    SL_TRIG    Stoploss trigger — BELOW current price.
    SL_PX      Limit price for the SL SELL leg.
    TGT_TRIG   Target trigger   — ABOVE current price.
    TGT_PX     Limit price for the target SELL leg.

─── Intraday Target & Stoploss ──────────────────────
  After any buy/sell, bot prompts for optional Target and Stoploss.
  Target   → opposite-side LIMIT exit order (e.g. SELL above entry).
  Stoploss → opposite-side SL-M exit order  (e.g. SELL below entry).
  Both are regular DAY orders (MIS) — expire at market close.
`);
}

/**
 * Parses order-type modifiers from extra CLI tokens after <SYMBOL> <QTY>.
 * Returns null if the tokens are present but malformed.
 *   []                  → MARKET (empty options)
 *   ["limit", "2500"]   → LIMIT at ₹2500
 *   ["sl", "2450"]      → SL-M at trigger ₹2450
 *   ["sl", "2450", "2455"] → SL at trigger ₹2450, limit ₹2455
 */
function parseOrderOptions(extra: string[]): PlaceOrderOptions | null {
  if (extra.length === 0) return {};

  const keyword = extra[0]?.toLowerCase();

  if (keyword === "limit" || keyword === "l") {
    const price = parseFloat(extra[1] ?? "");
    if (isNaN(price) || price <= 0) return null;
    return { order_type: "LIMIT", price };
  }

  if (keyword === "sl") {
    const trigger = parseFloat(extra[1] ?? "");
    if (isNaN(trigger) || trigger <= 0) return null;
    if (extra[2] !== undefined) {
      const price = parseFloat(extra[2]);
      if (isNaN(price) || price <= 0) return null;
      return { order_type: "SL", price, trigger_price: trigger };
    }
    return { order_type: "SL-M", trigger_price: trigger };
  }

  return null;
}

async function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectUser(): Promise<UserId> {
  while (true) {
    const answer = await askQuestion("👤 Who are you? (lawless/splinter): ");
    const id = answer.toLowerCase() as UserId;
    if (VALID_USERS.includes(id)) return id;
    console.log("❌ Invalid user. Enter 'lawless' or 'splinter'.");
  }
}

/**
 * Ensure the user has a valid Kite access token.
 * Returns a ready-to-use KiteConnect instance.
 */
async function authenticateUser(userId: UserId): Promise<KiteInstance> {
  process.stdout.write("🔑 Checking authentication... ");

  let accessToken = await getValidAccessToken(userId);

  if (accessToken) {
    console.log("✅ Token valid.\n");
    return createKiteClient(userId, accessToken);
  }

  console.log("⚠️  Token expired or missing. Starting Kite login...\n");
  console.log(
    "📌 Note: Your Kite app's redirect URL must be set to: http://127.0.0.1:3000\n"
  );

  accessToken = await runKiteLogin(userId);
  console.log("\n✅ Authentication successful!\n");
  return createKiteClient(userId, accessToken);
}

export async function startCLI(): Promise<void> {
  printBanner();

  const userId = await selectUser();
  const userName = userId.charAt(0).toUpperCase() + userId.slice(1);

  const kite = await authenticateUser(userId);

  const marketStatus = isMarketOpen() ? "🟢 OPEN" : "🔴 CLOSED";
  console.log(`✅ Welcome, ${userName}! Market is ${marketStatus}`);
  if (!isMarketOpen()) {
    console.log("⚠️  Market is closed. Orders placed now may be rejected by the broker.\n");
  } else {
    console.log();
  }

  printHelp();

  let isWatching = false;
  let watchTimer: ReturnType<typeof setInterval> | null = null;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${userName}] > `,
  });

  rl.prompt();

  rl.on("line", (line) => {
    (async () => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (isWatching) {
      if (watchTimer !== null) { clearInterval(watchTimer); watchTimer = null; }
      isWatching = false;
      process.stdout.write("\n");
      console.log("🛑 Watch stopped.\n");
      rl.setPrompt(`[${userName}] > `);
      rl.prompt();
      return;
    }

    switch (cmd) {
      case "buy":
      case "sell": {
        const symbol = parts[1];
        const qty = parseInt(parts[2] ?? "", 10);

        if (!symbol || isNaN(qty) || qty <= 0) {
          console.log(`❌ Usage: ${cmd} <SYMBOL> <QTY> [limit <PRICE> | sl <TRIGGER> [<PRICE>]]`);
          break;
        }

        // Parse optional order-type modifier: limit / sl
        const orderOptions = parseOrderOptions(parts.slice(3));
        if (orderOptions === null) {
          console.log(`❌ Invalid order options. Use: limit <PRICE>  or  sl <TRIGGER> [<PRICE>]`);
          break;
        }

        const action = cmd.toUpperCase() as "BUY" | "SELL";
        const orderTypeLabel = orderOptions.order_type ?? "MARKET";
        console.log(`⏳ Placing ${action} — ${qty} × ${symbol.toUpperCase()} [${orderTypeLabel}]...`);
        const result = await placeOrder(kite, action, symbol, qty, userId, orderOptions);

        if (result.status === "success") {
          console.log(`✅ ${result.message}`);
          console.log(`   Order ID: ${result.order_id}`);

          // Prompt for optional target / stoploss exit orders
          const ask = (prompt: string): Promise<string> =>
            new Promise((resolve) => rl.question(prompt, (a) => resolve(a.trim())));

          const targetStr = await ask("🎯 Target price? (Enter to skip): ");
          const slStr = await ask("🛡  Stoploss price? (Enter to skip): ");

          const target = targetStr !== "" ? parseFloat(targetStr) : undefined;
          const stoploss = slStr !== "" ? parseFloat(slStr) : undefined;

          const hasExit = target !== undefined || stoploss !== undefined;
          if (hasExit) {
            if (target !== undefined && isNaN(target)) {
              console.log("⚠️  Invalid target price — skipped.");
            }
            if (stoploss !== undefined && isNaN(stoploss)) {
              console.log("⚠️  Invalid stoploss price — skipped.");
            }
            const validTarget = target !== undefined && !isNaN(target) ? target : undefined;
            const validSL = stoploss !== undefined && !isNaN(stoploss) ? stoploss : undefined;

            if (validTarget !== undefined || validSL !== undefined) {
              console.log("⏳ Placing exit orders...");
              const exits = await placeExitOrders(kite, action, symbol, qty, userId, validTarget, validSL);

              if (exits.targetResult) {
                if (exits.targetResult.status === "success") {
                  console.log(`✅ Target ${exits.targetResult.message}`);
                  console.log(`   Order ID: ${exits.targetResult.order_id}`);
                } else {
                  console.log(`❌ Target order failed: ${exits.targetResult.message}`);
                }
              }
              if (exits.slResult) {
                if (exits.slResult.status === "success") {
                  console.log(`✅ SL ${exits.slResult.message}`);
                  console.log(`   Order ID: ${exits.slResult.order_id}`);
                } else {
                  console.log(`❌ SL order failed: ${exits.slResult.message}`);
                }
              }
            }
          }

          console.log("\n⏳ Asking AI for risk assessment...");
          const riskAdvice = await getRiskAdvice(
            symbol.toUpperCase(),
            action,
            qty,
            orderOptions.price ?? null
          );
          if (riskAdvice) {
            console.log("\n🤖 Risk Assessment:\n");
            console.log(riskAdvice);
            console.log();
          }
        } else {
          console.log(`❌ ${result.message}`);
        }
        break;
      }

      case "quote": {
        const symbol = parts[1];
        if (!symbol) {
          console.log("❌ Usage: quote <SYMBOL>   e.g. quote INFY");
          break;
        }
        console.log(`⏳ Fetching price for ${symbol.toUpperCase()}...`);
        const price = await getQuote(kite, symbol);
        if (price !== null) {
          console.log(`📈 ${symbol.toUpperCase()} — ₹${price.toFixed(2)}`);
        } else {
          console.log(`❌ Could not fetch price for ${symbol.toUpperCase()}`);
        }
        break;
      }

      case "watch": {
        const symbols = parts.slice(1).map((s: string) => s.toUpperCase());
        if (symbols.length === 0) {
          console.log("❌ Usage: watch <SYMBOL> [SYMBOL2...]   e.g. watch RELIANCE TCS");
          break;
        }

        isWatching = true;
        console.log(`\n👁  LIVE FEED — ${symbols.join(", ")}  (Press Enter to stop)\n`);

        const C = 16;
        const SEP = "─".repeat(C * 5);
        let linesRendered = 0;

        const renderWatch = async () => {
          if (!isWatching) return;
          try {
            const quotes = await kite.getQuote(symbols.map((s: string) => `NSE:${s}`));
            if (!isWatching) return;
            const lines: string[] = [];
            lines.push(SEP);
            lines.push(["Symbol", "LTP", "Change", "Change%", "Volume"].map((h) => h.padEnd(C)).join(""));
            lines.push(SEP);
            for (const sym of symbols) {
              const q = quotes[`NSE:${sym}`];
              if (!q) { lines.push(sym.padEnd(C) + "N/A"); continue; }
              const change = q.net_change;
              const changePct = q.ohlc.close > 0 ? (change / q.ohlc.close) * 100 : 0;
              const sign = change >= 0 ? "+" : "";
              const pctSign = changePct >= 0 ? "+" : "";
              const colorFn = change >= 0
                ? (s: string) => `\x1b[32m${s}\x1b[0m`
                : (s: string) => `\x1b[31m${s}\x1b[0m`;
              const volStr = q.volume.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
              lines.push(
                sym.padEnd(C) +
                  `₹${q.last_price.toFixed(2)}`.padEnd(C) +
                  colorFn(`${sign}${change.toFixed(2)}`.padEnd(C)) +
                  colorFn(`${pctSign}${changePct.toFixed(2)}%`.padEnd(C)) +
                  volStr
              );
            }
            lines.push(SEP);
            lines.push(`Updated: ${new Date().toLocaleTimeString("en-IN")}`);

            if (linesRendered > 0) {
              process.stdout.write(`\x1b[${linesRendered}A`);
            }
            for (const line of lines) {
              process.stdout.write(`\x1b[2K${line}\n`);
            }
            linesRendered = lines.length;
          } catch {
            // ignore transient network errors silently
          }
        };

        await renderWatch();
        watchTimer = setInterval(renderWatch, 2000);
        return; // skip rl.prompt() while watching
      }

      case "positions": {
        console.log(`⏳ Fetching positions...`);
        await displayPositions(kite);
        break;
      }

      case "orders": {
        console.log(`⏳ Fetching orders...`);
        await displayOrders(kite);
        break;
      }

      case "funds": {
        console.log(`⏳ Fetching funds & margins...`);
        await displayFunds(kite);
        break;
      }

      case "history": {
        console.log(`⏳ Fetching trade history for ${userName}...`);
        const trades = await getTradeHistory(userId);
        displayHistory(trades);
        break;
      }

      case "gtts": {
        console.log("⏳ Fetching GTT orders...");
        await displayGTTs(kite);
        break;
      }

      case "gtt": {
        const sub = parts[1]?.toLowerCase();

        // gtt delete <ID>
        if (sub === "delete") {
          const id = parts[2];
          if (!id) {
            console.log("❌ Usage: gtt delete <ID>");
            break;
          }
          console.log(`⏳ Deleting GTT ${id}...`);
          const r = await deleteGTT(kite, id);
          console.log(r.status === "success" ? `✅ ${r.message}` : `❌ ${r.message}`);
          break;
        }

        // gtt oco <SYMBOL> <QTY> <SL_TRIG> <SL_PX> <TGT_TRIG> <TGT_PX>
        if (sub === "oco") {
          const symbol   = parts[2];
          const qty      = parseInt(parts[3] ?? "", 10);
          const slTrig   = parseFloat(parts[4] ?? "");
          const slPx     = parseFloat(parts[5] ?? "");
          const tgtTrig  = parseFloat(parts[6] ?? "");
          const tgtPx    = parseFloat(parts[7] ?? "");

          if (!symbol || isNaN(qty) || qty <= 0 || isNaN(slTrig) || isNaN(slPx) || isNaN(tgtTrig) || isNaN(tgtPx)) {
            console.log("❌ Usage: gtt oco <SYMBOL> <QTY> <SL_TRIGGER> <SL_PRICE> <TARGET_TRIGGER> <TARGET_PRICE>");
            console.log("ⓘ  SL trigger must be below current price; target trigger above.");
            break;
          }

          console.log("⏳ Placing OCO GTT for "+symbol.toUpperCase()+"...");
          const r = await placeOCOGTT(kite, symbol, qty, slTrig, slPx, tgtTrig, tgtPx, userId);
          console.log(r.status === "success" ? `✅ ${r.message}` : `❌ ${r.message}`);
          break;
        }

        // gtt <buy|sell> <SYMBOL> <QTY> <TRIGGER> <PRICE>
        if (sub === "buy" || sub === "sell") {
          const symbol  = parts[2];
          const qty     = parseInt(parts[3] ?? "", 10);
          const trigger = parseFloat(parts[4] ?? "");
          const price   = parseFloat(parts[5] ?? "");

          if (!symbol || isNaN(qty) || qty <= 0 || isNaN(trigger) || isNaN(price)) {
            console.log(`❌ Usage: gtt ${sub} <SYMBOL> <QTY> <TRIGGER> <PRICE>`);
            break;
          }

          const action = sub.toUpperCase() as "BUY" | "SELL";
          console.log("⏳ Placing single GTT "+action+" "+qty+" × "+symbol.toUpperCase()+" trigger ₹"+trigger+"...");
          const r = await placeSingleGTT(kite, action, symbol, qty, trigger, price, userId);
          console.log(r.status === "success" ? `✅ ${r.message}` : `❌ ${r.message}`);
          break;
        }

        console.log("❌ Usage: gtt <buy|sell> <SYMBOL> <QTY> <TRIGGER> <PRICE>");
        console.log("       gtt oco <SYMBOL> <QTY> <SL_TRIG> <SL_PX> <TGT_TRIG> <TGT_PX>");
        console.log("       gtt delete <ID>");
        break;
      }

      case "help":
        printHelp();
        break;

      case "ref":
        printRef();
        break;

      case "usage": {
        console.log(`⏳ Fetching usage stats for ${userName}...`);
        const stats = await getUsageStats(userId);
        displayUsage(userName, stats);
        break;
      }

      case "fetch": {
        const sym = parts[1];
        if (!sym) {
          console.log("❌ Usage: fetch <SYMBOL> [interval=1day] [days=365]");
          break;
        }
        const interval = (parts[2] ?? "1day") as CandleInterval;
        const days = parseInt(parts[3] ?? "365", 10);
        const validIntervals: CandleInterval[] = ["1min", "5min", "15min", "1h", "1day"];
        if (!validIntervals.includes(interval)) {
          console.log(`❌ Invalid interval '${interval}'. Choose from: ${validIntervals.join(", ")}`);
          break;
        }
        if (isNaN(days) || days <= 0) {
          console.log("❌ days must be a positive number");
          break;
        }
        console.log(`⏳ Fetching ${sym.toUpperCase()} ${interval} candles (last ${days} days) from TwelveData...`);
        try {
          const count = await fetchAndStoreCandles(sym, interval, days);
          if (count === 0) {
            console.log(`⚠️  No candles returned. Check symbol name and TWELVEDATA_API_KEY.`);
          } else {
            console.log(`✅ Stored ${count} candles for ${sym.toUpperCase()} (${interval})`);
          }
        } catch (err) {
          console.log(`❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }

      case "backtest": {
        const stratName = parts[1]?.toLowerCase();
        const sym = parts[2];
        if (!stratName || !sym) {
          console.log("❌ Usage: backtest <STRATEGY> <SYMBOL> [interval=1day] [days=365] [capital=100000]");
          console.log("   Run 'strategies' to see available strategy names.");
          break;
        }
        const strategy = STRATEGIES[stratName];
        if (!strategy) {
          console.log(`❌ Unknown strategy '${stratName}'. Run 'strategies' to see available options.`);
          break;
        }
        const interval = (parts[3] ?? "1day") as CandleInterval;
        const days = parseInt(parts[4] ?? "365", 10);
        const capital = parseFloat(parts[5] ?? "100000");

        const candles = await getCandles(sym, interval);
        if (candles.length < strategy.minBars) {
          console.log(
            `❌ Not enough data — need at least ${strategy.minBars} bars, have ${candles.length}.\n` +
            `   Run: fetch ${sym.toUpperCase()} ${interval} ${Math.max(days, strategy.minBars * 2)}`
          );
          break;
        }

        // Limit to the requested days window if we have more data
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = candles.filter((c) => new Date(c.ts) >= cutoff);
        const workingCandles = filtered.length >= strategy.minBars ? filtered : candles.slice(-Math.max(days, strategy.minBars));

        console.log(`⏳ Running backtest: ${strategy.name} on ${sym.toUpperCase()} (${workingCandles.length} bars, capital ₹${capital.toLocaleString("en-IN")})...`);
        try {
          const result = runBacktest(strategy, workingCandles, { initialCapital: capital });
          printBacktestSummary(result);
          const file = await exportBacktestJSON(result);
          console.log(`📁 Full results exported to: ${file}`);
          console.log("\n⏳ Asking AI for analysis...");
          const analysis = await analyzeBacktest(result);
          if (analysis) {
            console.log("\n🤖 AI Analysis:\n");
            console.log(analysis);
            console.log();
          }
        } catch (err) {
          console.log(`❌ Backtest failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }

      case "recommend": {
        const sym = parts[1];
        if (!sym) {
          console.log("\u274c Usage: recommend <SYMBOL> [interval=1day] [days=365]");
          break;
        }
        const interval = (parts[2] ?? "1day") as CandleInterval;
        const days = parseInt(parts[3] ?? "365", 10);

        const candles = await getCandles(sym, interval);
        if (candles.length === 0) {
          console.log(`\u274c No candles for ${sym.toUpperCase()} — run: fetch ${sym.toUpperCase()} ${interval} ${days}`);
          break;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = candles.filter((c) => new Date(c.ts) >= cutoff);

        console.log(`\u23f3 Running all strategies on ${sym.toUpperCase()} (${interval}, last ${days} days)...`);
        const results = [];
        for (const strategy of Object.values(STRATEGIES)) {
          const working = filtered.length >= strategy.minBars ? filtered : candles.slice(-strategy.minBars * 2);
          if (working.length < strategy.minBars) continue;
          try {
            results.push(runBacktest(strategy, working, { initialCapital: 100000 }));
          } catch { /* not enough data for this strategy */ }
        }

        if (results.length === 0) {
          console.log("\u274c Not enough data to run any strategy.");
          break;
        }

        const C = 14;
        console.log(`\n\ud83d\udcca Strategy Performance on ${sym.toUpperCase()} (${interval}, last ${days} days)\n`);
        console.log(["Strategy", "Return", "CAGR", "Sharpe", "MaxDD", "WinRate"].map((h) => h.padEnd(C)).join(""));
        console.log("─".repeat(C * 6));
        for (const r of results.sort((a, b) => b.sharpe - a.sharpe)) {
          console.log(
            r.strategy.padEnd(C) +
            `${r.totalReturn >= 0 ? "+" : ""}${r.totalReturn.toFixed(1)}%`.padEnd(C) +
            `${r.cagr >= 0 ? "+" : ""}${r.cagr.toFixed(1)}%`.padEnd(C) +
            r.sharpe.toFixed(2).padEnd(C) +
            `-${r.maxDrawdown.toFixed(1)}%`.padEnd(C) +
            `${r.winRate.toFixed(0)}%`
          );
        }
        console.log();
        console.log("\u23f3 Asking AI for recommendations...");
        const rec = await recommendStrategies(sym.toUpperCase(), results);
        if (rec) {
          console.log("\n\ud83e\udd16 AI Recommendation:\n");
          console.log(rec);
          console.log();
        }
        break;
      }

      case "recommend": {
        const sym = parts[1];
        if (!sym) {
          console.log("❌ Usage: recommend <SYMBOL> [interval=1day] [days=365]");
          break;
        }
        const interval = (parts[2] ?? "1day") as CandleInterval;
        const days = parseInt(parts[3] ?? "365", 10);

        const candles = await getCandles(sym, interval);
        if (candles.length === 0) {
          console.log(`❌ No candles for ${sym.toUpperCase()} — run: fetch ${sym.toUpperCase()} ${interval} ${days}`);
          break;
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = candles.filter((c) => new Date(c.ts) >= cutoff);

        console.log(`⏳ Running all strategies on ${sym.toUpperCase()} (${interval}, last ${days} days)...`);
        const recResults = [];
        for (const strategy of Object.values(STRATEGIES)) {
          const working = filtered.length >= strategy.minBars ? filtered : candles.slice(-strategy.minBars * 2);
          if (working.length < strategy.minBars) continue;
          try {
            recResults.push(runBacktest(strategy, working, { initialCapital: 100000 }));
          } catch { /* not enough data for this strategy */ }
        }

        if (recResults.length === 0) {
          console.log("❌ Not enough data to run any strategy.");
          break;
        }

        const RC = 14;
        console.log(`\n📊 Strategy Performance on ${sym.toUpperCase()} (${interval}, last ${days} days)\n`);
        console.log(["Strategy", "Return", "CAGR", "Sharpe", "MaxDD", "WinRate"].map((h) => h.padEnd(RC)).join(""));
        console.log("─".repeat(RC * 6));
        for (const r of recResults.sort((a, b) => b.sharpe - a.sharpe)) {
          console.log(
            r.strategy.padEnd(RC) +
            `${r.totalReturn >= 0 ? "+" : ""}${r.totalReturn.toFixed(1)}%`.padEnd(RC) +
            `${r.cagr >= 0 ? "+" : ""}${r.cagr.toFixed(1)}%`.padEnd(RC) +
            r.sharpe.toFixed(2).padEnd(RC) +
            `-${r.maxDrawdown.toFixed(1)}%`.padEnd(RC) +
            `${r.winRate.toFixed(0)}%`
          );
        }
        console.log();
        console.log("⏳ Asking AI for recommendations...");
        const rec = await recommendStrategies(sym.toUpperCase(), recResults);
        if (rec) {
          console.log("\n🤖 AI Recommendation:\n");
          console.log(rec);
          console.log();
        }
        break;
      }

      case "paper": {
        const stratName = parts[1]?.toLowerCase();
        const sym = parts[2];
        if (!stratName || !sym) {
          console.log("❌ Usage: paper <STRATEGY> <SYMBOL> [qty=1]");
          break;
        }
        const strategy = STRATEGIES[stratName];
        if (!strategy) {
          console.log(`❌ Unknown strategy '${stratName}'. Run 'strategies' to see available options.`);
          break;
        }
        const qty = parseInt(parts[3] ?? "1", 10);
        if (isNaN(qty) || qty <= 0) {
          console.log("❌ qty must be a positive integer");
          break;
        }
        rl.pause();
        await startPaperTrading(kite, strategy, sym, qty);
        rl.resume();
        break;
      }

      case "strategies": {
        const C = 14;
        console.log(`\n📐 Available Strategies:\n`);
        console.log(`${"Name".padEnd(C)} Min Bars  Description`);
        console.log("─".repeat(72));
        for (const [name, s] of Object.entries(STRATEGIES)) {
          console.log(`${name.padEnd(C)} ${String(s.minBars).padEnd(10)}${s.description}`);
        }
        console.log();
        break;
      }

      case "exit":
      case "quit":
        console.log("\n👋 Goodbye!\n");
        rl.close();
        process.exit(0);
        break;

      case "":
        break;

      default:
        console.log(`❓ Unknown command '${cmd}'. Type 'help' to see available commands.`);
    }

    rl.prompt();
    })().catch((err) => {
      console.error("\n❌ Unexpected error:", err instanceof Error ? err.message : String(err));
      rl.prompt();
    });
  });

  rl.on("close", () => process.exit(0));
}
