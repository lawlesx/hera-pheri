import * as readline from "readline";
import type { KiteInstance } from "../kite/client";
import { createKiteClient, isMarketOpen, getQuote } from "../kite/client";
import { runKiteLogin } from "../kite/auth";
import { getValidAccessToken } from "../db/tokens";
import { placeOrder } from "../kite/orders";
import { getTradeHistory } from "../db/trades";
import { displayPositions, displayOrders, displayHistory, displayFunds } from "../kite/portfolio";
import type { UserId } from "../types";

const VALID_USERS: UserId[] = ["lawless", "splinter"];

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════╗
║      🐍 HERA-PHERI TRADE BOT         ║
║      NSE Intraday — MIS / Market     ║
╚══════════════════════════════════════╝
`);
}

function printHelp(): void {
  console.log(`
📖 Commands:
  buy <SYMBOL> <QTY>      Place a market BUY order
  sell <SYMBOL> <QTY>     Place a market SELL order
  watch <S1> [S2...]      Live price feed (press Enter to stop)
  quote <SYMBOL>          Get current price of a stock
  positions               Open positions with P&L
  orders                  Today's order book
  history                 Show your last 20 trades
  funds                   Show available cash & margin
  help                    Show this help
  exit                    Exit the bot
`);
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
          console.log(`❌ Usage: ${cmd} <SYMBOL> <QTY>   e.g. ${cmd} RELIANCE 10`);
          break;
        }

        console.log(`⏳ Placing ${cmd.toUpperCase()} — ${qty} × ${symbol.toUpperCase()}...`);
        const result = await placeOrder(kite, cmd.toUpperCase() as "BUY" | "SELL", symbol, qty, userId);

        if (result.status === "success") {
          console.log(`✅ ${result.message}`);
          console.log(`   Order ID: ${result.order_id}`);
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
        const symbols = parts.slice(1).map((s) => s.toUpperCase());
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
            const quotes = await kite.getQuote(symbols.map((s) => `NSE:${s}`));
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

      case "help":
        printHelp();
        break;

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
