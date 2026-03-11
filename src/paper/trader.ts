import * as readline from "readline";
import type { KiteInstance } from "../kite/client";
import type { Strategy } from "../strategies/base";
import type { Candle } from "../types";
import { getCandles } from "../db/candles";
import { logPaperTrade } from "../db/candles";
import { explainSignal } from "../llm/analyst";

const POLL_INTERVAL_MS = 5_000; // 5-second polling interval

function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s: string): string { return `\x1b[33m${s}\x1b[0m`; }

/**
 * Run paper trading for a given strategy on a symbol.
 * Loads stored candles from DB as warm-up history, then polls Kite every
 * POLL_INTERVAL_MS seconds to append a synthetic candle from the live quote.
 * Press Enter to stop.
 */
export async function startPaperTrading(
  kite: KiteInstance,
  strategy: Strategy,
  symbol: string,
  qty: number
): Promise<void> {
  const sym = symbol.toUpperCase();

  // Load stored daily candles for warm-up (last 200 bars)
  const stored = await getCandles(sym, "1day");
  if (stored.length < strategy.minBars) {
    console.log(
      `❌ Not enough candles in DB — need at least ${strategy.minBars} bars for ${strategy.name}.\n` +
      `   Run: fetch ${sym} 1day 365  to download historical data first.`
    );
    return;
  }

  // Keep a rolling buffer of the last 200 stored bars as warm-up
  const buffer: Candle[] = stored.slice(-200);

  console.log(`\n📡 Paper Trading — ${strategy.name.toUpperCase()} on ${sym} × ${qty}`);
  console.log(`   Loaded ${stored.length} historical candles as warm-up.`);
  console.log("   Press Enter to stop.\n");

  let running = true;
  let lastSignal: string | null = null;
  let position: { action: "BUY"; price: number } | null = null;

  // Press Enter stops the loop
  const stdinRl = readline.createInterface({ input: process.stdin });
  stdinRl.once("line", () => { running = false; });

  while (running) {
    try {
      const quotes = await kite.getQuote([`NSE:${sym}`]);
      const q = quotes[`NSE:${sym}`];

      if (q) {
        const now = new Date().toISOString();

        // Build synthetic current candle from live quote
        const syntheticCandle: Candle = {
          symbol: sym,
          interval: "1day",
          ts: now,
          open: q.ohlc.open,
          high: q.ohlc.high,
          low: q.ohlc.low,
          close: q.last_price,
          volume: q.volume,
        };

        // Replace the last candle if it's from the same date, otherwise append
        const todayDate = now.split("T")[0]!;
        const lastInBuffer = buffer[buffer.length - 1];
        const workingBuffer: Candle[] =
          lastInBuffer && lastInBuffer.ts.startsWith(todayDate)
            ? [...buffer.slice(0, -1), syntheticCandle]
            : [...buffer, syntheticCandle];

        const signal = strategy.generate(workingBuffer);
        const signalKey = signal ? `${signal.action}:${signal.reason}` : null;

        // Only act on a new signal (deduplicate repeated signals)
        if (signal && signalKey !== lastSignal) {
          lastSignal = signalKey;
          const time = new Date().toLocaleTimeString("en-IN");

          if (signal.action === "BUY" && position === null) {
            position = { action: "BUY", price: q.last_price };
            await logPaperTrade(
              strategy.name, sym, "BUY", qty, q.last_price, signal.reason, now
            );
            console.log(green(`[${time}] 📈 PAPER BUY  ${sym} × ${qty} @ ₹${q.last_price.toFixed(2)}`));
            console.log(`         Reason: ${signal.reason}`);
            const buyExplanation = await explainSignal(signal, syntheticCandle);
            if (buyExplanation) console.log(`\n🤖 ${buyExplanation}\n`);
          } else if (signal.action === "SELL" && position !== null) {
            const pnl = (q.last_price - position.price) * qty;
            await logPaperTrade(
              strategy.name, sym, "SELL", qty, q.last_price, signal.reason, now
            );
            console.log(yellow(`[${time}] 📉 PAPER SELL ${sym} × ${qty} @ ₹${q.last_price.toFixed(2)}  P&L: ₹${pnl.toFixed(2)}`));
            console.log(`         Reason: ${signal.reason}`);
            const sellExplanation = await explainSignal(signal, syntheticCandle);
            if (sellExplanation) console.log(`\n🤖 ${sellExplanation}\n`);
            position = null;
          }
        } else {
          const time = new Date().toLocaleTimeString("en-IN");
          process.stdout.write(
            `\r[${time}]  ${sym} ₹${q.last_price.toFixed(2)}  ${position ? "📂 IN POSITION" : "⬜ FLAT"}  (no signal)  `
          );
        }
      }
    } catch (err) {
      // Ignore transient fetch errors silently
    }

    if (!running) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  stdinRl.close();
  process.stdout.write("\n");
  console.log("🛑 Paper trading stopped.\n");
}
