import * as readline from "readline";
import type { KiteInstance } from "../kite/client";
import { createKiteClient, isMarketOpen, getQuote } from "../kite/client";
import { runKiteLogin } from "../kite/auth";
import { getValidAccessToken } from "../db/tokens";
import { placeOrder } from "../kite/orders";
import { getTradeHistory } from "../db/trades";
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
  quote <SYMBOL>          Get current price of a stock
  history                 Show your last 20 trades
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${userName}] > `,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

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

      case "history": {
        console.log(`⏳ Fetching trade history for ${userName}...`);
        const trades = await getTradeHistory(userId);
        if (trades.length === 0) {
          console.log("📭 No trades found.");
        } else {
          console.log(`\n📋 Last ${trades.length} trades for ${userName}:\n`);
          console.log(
            ["#", "Action", "Symbol", "Qty", "Price", "Status", "Time"]
              .map((h) => h.padEnd(12))
              .join("")
          );
          console.log("─".repeat(84));
          trades.forEach((t, i) => {
            console.log(
              [
                String(i + 1).padEnd(12),
                String(t.action).padEnd(12),
                String(t.symbol).padEnd(12),
                String(t.quantity).padEnd(12),
                t.price ? `₹${Number(t.price).toFixed(2)}`.padEnd(12) : "N/A".padEnd(12),
                String(t.status).padEnd(12),
                new Date(String(t.executed_at)).toLocaleString("en-IN"),
              ].join("")
            );
          });
          console.log();
        }
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
  });

  rl.on("close", () => process.exit(0));
}
