# 🐍 Hera-Pheri Trade Bot

NSE Intraday trading bot for two users, each with their own Zerodha account. Built with Bun.js + TypeScript, Kite Connect, and SQLite.

## Stack

| Layer            | Tech                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Runtime          | Bun.js + TypeScript                                               |
| Broker API       | Kite Connect (Zerodha)                                            |
| Market Data      | Yahoo Finance (historical OHLCV — no API key required)            |
| Indicators       | [technicalindicators](https://github.com/anandanand84/technicalindicators) |
| Database         | SQLite — local file or hosted via [Turso](https://turso.tech/)    |
| LLM              | [Ollama](https://ollama.com) — local inference, no cloud required |
| Deployment       | Local or Railway                                                  |

---

## Architecture

- **API credentials** (`api_key`, `api_secret`) live in env variables — never in the DB
- **Access tokens** (expire daily at 6 AM) are stored per-user in the DB
- On startup, the bot checks if the token is still valid. If expired, it triggers Kite OAuth login automatically in your browser

---

## Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd hera-pheri
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your Kite Connect credentials
```

**Minimal `.env` for local use:**

```env
# Database — local SQLite file, no Turso account needed
TURSO_DATABASE_URL=file:local.db

# Your Zerodha Kite Connect app credentials
LAWLESS_KITE_API_KEY=...
LAWLESS_KITE_API_SECRET=...

SPLINTER_KITE_API_KEY=...
SPLINTER_KITE_API_SECRET=...

# Historical data via Yahoo Finance — no API key needed

# Ollama — local LLM for AI analysis (optional, gracefully skipped if offline)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=granite4:3b
```

> To enable AI features, install [Ollama](https://ollama.com) and run `ollama pull granite4:3b`. If Ollama is not running, all AI features are silently skipped — the bot works normally.

### 3. Kite Connect Setup

Each user needs their own Kite Connect app at [kite.trade](https://kite.trade/).

> ⚠️ **Important**: In each Kite app's settings, set the **Redirect URL** to:
>
> ```
> http://127.0.0.1:3000
> ```

### 4. Run DB Migrations

```bash
bun run migrate
# Creates local.db with tables + seeds both users
```

---

## Running the Bot

```bash
bun run start
```

### Session Flow

```
👤 Who are you? (lawless/splinter): lawless

🔑 Checking authentication...
  ✅ Token valid.              ← token from today exists
  OR
  ⚠️  Token expired. Starting Kite login...
     → Browser opens Kite login page
     → You log in with Zerodha credentials
     → Token captured automatically
     ✅ Authentication successful!

✅ Welcome, Lawless! Market is 🟢 OPEN
```

---

## CLI Commands

```
buy  <SYMBOL> <QTY>                        Market BUY  (e.g. buy RELIANCE 10)
buy  <SYMBOL> <QTY> limit <PRICE>          Limit BUY   (e.g. buy RELIANCE 10 limit 2500)
buy  <SYMBOL> <QTY> sl <TRIGGER>           SL-M BUY    (e.g. buy RELIANCE 10 sl 2480)
buy  <SYMBOL> <QTY> sl <TRIGGER> <PRICE>   SL BUY      (e.g. buy RELIANCE 10 sl 2480 2475)
sell <SYMBOL> <QTY>                        Market SELL (e.g. sell TCS 5)
sell <SYMBOL> <QTY> limit <PRICE>          Limit SELL  (e.g. sell INFY 5 limit 1400)
sell <SYMBOL> <QTY> sl <TRIGGER>           SL-M SELL   (e.g. sell TCS 3 sl 3800)
sell <SYMBOL> <QTY> sl <TRIGGER> <PRICE>   SL SELL     (e.g. sell TCS 3 sl 3800 3795)
gtt  <buy|sell> <SYMBOL> <QTY> <TRIGGER> <PRICE>                Single-leg GTT
gtt  oco <SYMBOL> <QTY> <SL_TRIG> <SL_PX> <TGT_TRIG> <TGT_PX> OCO GTT (two-leg)
gtts                                       List all active GTT orders
gtt  delete <ID>                           Delete a GTT by ID
watch <S1> [S2...]                         Live price feed — refreshes every 2s (press Enter to stop)
quote <SYMBOL>                             Get the current price of a stock
positions                                  Open positions with unrealised / realised P&L
orders                                     Today's order book with colour-coded status
history                                    Show your last 20 trades
funds                                      Show available cash & margin (equity segment)
usage                                      Order counts (today/week/month/all-time) + estimated brokerage
fetch <SYMBOL> [interval=1day] [days=365]  Download OHLCV candles from Yahoo Finance into DB
backtest <STRATEGY> <SYMBOL> [interval=1day] [days=365] [capital=100000]
                                           Run a backtest, export results, and get AI analysis
recommend <SYMBOL> [interval=1day] [days=365]
                                           Run all strategies on a symbol and get AI strategy recommendation
paper <STRATEGY> <SYMBOL> [qty=1]          Live paper-trading loop on a strategy (press Enter to stop)
strategies                                 List all available strategies with descriptions
help                                       Show command reference
ref                                        Glossary — order types, GTT params, MIS/CNC explained
exit                                       Exit the bot
```

> ⚠️ Regular `buy`/`sell` orders use **MIS (Margin Intraday Square-off)** — auto-closed by Zerodha at 3:25 PM IST.
> GTT orders use **CNC (Delivery)** and persist across sessions until triggered or deleted.

### Target & Stoploss on Entry

After any successful entry order (`buy` / `sell`), the bot interactively asks for optional exit orders:

```
✅ BUY 10 RELIANCE @ MARKET placed successfully
   Order ID: 10000001
🎯 Target price? (Enter to skip): 2580
🛡  Stoploss price? (Enter to skip): 2460
⏳ Placing exit orders...
✅ Target SELL 10 RELIANCE @ LIMIT ₹2580 placed successfully
   Order ID: 10000002
✅ SL SELL 10 RELIANCE SL-M trigger ₹2460 placed successfully
   Order ID: 10000003
```

- **Target** → opposite-side LIMIT order at your specified price
- **Stoploss** → opposite-side SL-M order at your trigger price
- Press Enter to skip either leg

### GTT — Good Till Triggered (`gtt`)

GTT orders persist until the price hits the trigger, or you delete them. They survive across sessions and work with CNC (delivery) holdings.

**Single-leg** — fires one order when price crosses the trigger:

```
[Lawless] > gtt buy RELIANCE 10 2400 2395
⏳ Placing single GTT BUY 10 × RELIANCE trigger ₹2400...
✅ GTT BUY 10 RELIANCE — trigger ₹2400, limit ₹2395 (ID: 123456)
```

**OCO (One Cancels Other)** — two SELL legs on a long holding; once one triggers, Kite cancels the other:

```
[Lawless] > gtt oco RELIANCE 10 2400 2390 2700 2710
⏳ Placing OCO GTT for RELIANCE...
✅ GTT OCO 10 RELIANCE — SL ₹2400→₹2390 | Target ₹2700→₹2710 (ID: 123457)
```

SL trigger must be **below** current price; target trigger **above**.

**List / Delete:**

```
[Lawless] > gtts
[Lawless] > gtt delete 123456
```

### Live Price Feed (`watch`)

```
[Lawless] > watch RELIANCE TCS INFY

👁  LIVE FEED — RELIANCE, TCS, INFY  (Press Enter to stop)

────────────────────────────────────────────────────────────────────────────────
Symbol          LTP             Change          Change%         Volume
────────────────────────────────────────────────────────────────────────────────
RELIANCE        ₹2,942.50       +12.30          +0.42%          1,234,567
TCS             ₹3,810.00       -45.20          -1.17%          567,890
INFY            ₹1,754.75       +8.90           +0.51%          890,123
────────────────────────────────────────────────────────────────────────────────
Updated: 10:32:45 AM
```

The table rewrites itself in-place using ANSI cursor controls. Green = positive, red = negative.

### Positions P&L (`positions`)

Shows all open MIS positions with avg entry, last traded price, unrealised and realised P&L, and a total footer.

### Order Book (`orders`)

Shows up to 50 of today's orders: time, symbol, BUY/SELL type, quantity, and status (COMPLETE / OPEN / REJECTED highlighted in colour).

### Usage & Brokerage Estimate (`usage`)

Shows how many orders you've placed across different time windows, a breakdown by order type, and an estimated brokerage cost:

```
[Lawless] > usage
⏳ Fetching usage stats for Lawless...

📊 Usage — Lawless

Today           This Week       This Month      All Time
────────────────────────────────────────────────────────────────
3 orders        12 orders       47 orders       214 orders
────────────────────────────────────────────────────────────────

📋 By Order Type:

  MARKET     28
  LIMIT      11
  SL-M       8

💸 Estimated Brokerage (₹20 flat/order, MIS):

  Today      ₹60.00
  This Week  ₹240.00
  This Month ₹940.00
```

> Zerodha charges min(₹20, 0.03% of turnover) per executed MIS order. GTT/CNC orders are ₹0 brokerage and are not counted here.

---

## Backtesting & Algorithmic Strategies

The bot includes a full backtesting pipeline and paper-trading loop on top of the live trading foundation.

### Workflow

```
1. fetch     — Download OHLCV candles from Yahoo Finance into the local DB
2. backtest  — Replay candles through a strategy, compute metrics, export JSON + get AI analysis
3. recommend — Run all strategies on a symbol and get an AI-powered recommendation
4. paper     — Run the strategy live on Kite quotes without placing real orders (AI explains each signal)
```

### Available Strategies

| Name        | Logic                                                             |
| ----------- | ----------------------------------------------------------------- |
| `ema_cross` | EMA(9)/EMA(21) golden/death cross                                 |
| `rsi`       | RSI(14) oversold reversal (<30 → BUY) / overbought reversal (>70 → SELL) |
| `macd`      | MACD(12,26,9) signal line crossover                               |
| `bollinger` | Bollinger Bands(20,2) lower/upper band mean-reversion             |
| `donchian`  | Donchian Channel(20) N-bar high/low breakout                      |
| `vwap`      | Rolling VWAP(20) crossover (close crosses above/below VWAP)       |

### Example Usage

```
# 1. Download 1 year of daily candles for RELIANCE
[Lawless] > fetch RELIANCE 1day 365
⏳ Fetching RELIANCE 1day candles (last 365 days) from Yahoo Finance...
✅ Stored 248 candles for RELIANCE (1day)

# 2. Run a backtest
[Lawless] > backtest ema_cross RELIANCE 1day 365 100000
⏳ Running backtest: ema_cross on RELIANCE (248 bars, capital ₹1,00,000)...

📊 Backtest Results — EMA_CROSS on RELIANCE (1day)
   Period: 2025-03-11 → 2026-03-11
────────────────────────────────────────────────────────
  Initial Capital      ₹1,00,000
  Final Capital        ₹1,18,340
  Total Return         +18.34%
  CAGR                 +18.34%
  Sharpe Ratio         0.872
  Max Drawdown         -9.12%
  Win Rate             62.5%
  Total Trades         8
────────────────────────────────────────────────────────
📁 Full results exported to: ./exports/backtest_ema_cross_RELIANCE_2026-03-11.json

⏳ Asking AI for analysis...

🤖 AI Analysis:

The EMA cross strategy made a solid +18.34% return on RELIANCE — that means your ₹1 lakh grew to ₹1.18 lakh over the year. With 8 trades and a 62.5% win rate, more than half of the trades were profitable, which is a good sign for a trend-following approach.

# 3. Get AI strategy recommendation
[Lawless] > recommend RELIANCE 1day 365
⏳ Running all strategies on RELIANCE (1day, last 365 days)...

📊 Strategy Performance on RELIANCE (1day, last 365 days)

Strategy      Return        CAGR          Sharpe        MaxDD         WinRate
──────────────────────────────────────────────────────────────────────────────────
ema_cross     +18.3%        +18.3%        0.87          -9.1%         62%
...

⏳ Asking AI for recommendations...

🤖 AI Recommendation:

✅ Best: ema_cross — the highest Sharpe ratio means the best risk-adjusted return...

# 4. Paper trade live
[Lawless] > paper rsi RELIANCE 10
📡 Paper Trading — RSI on RELIANCE × 10
   (Press Enter to stop)

[14:23:45] 📈 PAPER BUY  RELIANCE × 10 @ ₹2500.50
           Reason: RSI(14) crossed above 30 (oversold reversal: 31.4)

🤖 The RSI just bounced off the oversold zone (below 30) and crossed back above it — this means selling pressure has exhausted and buyers are stepping in. The signal is moderately strong as RSI has room to run toward 70...
```

### Backtest Design Notes

- **No look-ahead bias** — signals are generated on bar close; fills happen at the next bar's open price
- **Commission** — flat ₹20 per order leg (matches the `usage` command estimate)
- **Position sizing** — 100% of available capital by default; configurable via `positionSizePct` in the engine
- **Exported JSON** includes full trade log, equity curve, and all metrics for further analysis
- **AI analysis** — after every backtest, Ollama interprets the metrics and gives a plain-English verdict (requires Ollama running locally)

### AI Features (Ollama)

All AI output is automatic — no extra commands needed. If Ollama is offline, a `⚠️ Ollama unavailable` warning is shown and the bot continues normally.

| Trigger | AI Output |
| ------- | --------- |
| After `backtest` | Interprets metrics, explains Sharpe/drawdown, gives YES/MAYBE/NO verdict |
| After `buy` / `sell` | Assesses exposure, suggests stoploss and target levels |
| After each signal in `paper` | Explains what the indicator did and what to watch next |
| `recommend <SYMBOL>` | Ranks all strategies, labels each ✅/⚠️/❌, names the top pick |

---

## Local vs Cloud (Railway)

|              | Local                                    | Railway                             |
| ------------ | ---------------------------------------- | ----------------------------------- |
| Database     | `TURSO_DATABASE_URL=file:local.db`       | Turso hosted URL + auth token       |
| Kite OAuth   | ✅ Works — browser opens on your machine | ⚠️ Needs a separate local auth step |
| Availability | When your machine is on                  | 24/7                                |

**Start locally, deploy to Railway when you're ready to go 24/7.**

When deploying to Railway, swap the DB URL to a Turso remote URL and add `TURSO_AUTH_TOKEN` as a Railway env var.

---

## Project Structure

```
hera-pheri/
├── index.ts              # Entrypoint — runs migrations, starts CLI
├── src/
│   ├── env.ts            # Env loader
│   ├── types.ts          # Shared types (Trade, Candle, Signal w/ indicators, BacktestResult, …)
│   ├── kite/
│   │   ├── client.ts     # Per-user Kite client factory + market hours
│   │   ├── auth.ts       # OAuth login — local server + browser open
│   │   ├── orders.ts     # placeOrder() (MARKET/LIMIT/SL/SL-M) + placeExitOrders()
│   │   ├── gtt.ts        # GTT: placeSingleGTT(), placeOCOGTT(), deleteGTT(), displayGTTs()
│   │   ├── historical.ts # Yahoo Finance OHLCV fetch + DB upsert (no API key needed)
│   │   └── portfolio.ts  # displayPositions(), displayOrders(), displayHistory(), displayFunds(), displayUsage()
│   ├── db/
│   │   ├── client.ts     # SQLite/Turso connection
│   │   ├── migrate.ts    # Schema + user seed (users, trades, gtt_orders, candles, paper_trades)
│   │   ├── tokens.ts     # Save/validate daily access tokens
│   │   ├── trades.ts     # Log & fetch trade history + getUsageStats()
│   │   ├── gtt.ts        # logGTT() — local audit log for GTT placements
│   │   └── candles.ts    # upsertCandles(), getCandles(), logPaperTrade()
│   ├── indicators/
│   │   └── index.ts      # calcEMA, calcSMA, calcRSI, calcMACD, calcBollingerBands, calcDonchian, calcVWAP
│   ├── strategies/
│   │   ├── base.ts       # Strategy interface
│   │   ├── registry.ts   # STRATEGIES map — all strategies by name
│   │   ├── ema_cross.ts  # EMA(9)/EMA(21) golden/death cross
│   │   ├── rsi.ts        # RSI(14) oversold/overbought reversal
│   │   ├── macd.ts       # MACD(12,26,9) signal line crossover
│   │   ├── bollinger.ts  # Bollinger Bands(20,2) mean-reversion
│   │   ├── donchian.ts   # Donchian Channel(20) breakout
│   │   └── vwap.ts       # Rolling VWAP(20) crossover
│   ├── backtest/
│   │   ├── engine.ts     # runBacktest() — bar-by-bar simulation, fills at next-bar-open
│   │   ├── metrics.ts    # calcSharpe, calcCAGR, calcMaxDrawdown, calcWinRate
│   │   └── reporter.ts   # CLI summary table + JSON export to ./exports/
│   ├── paper/
│   │   └── trader.ts     # Live paper-trading loop — polls Kite quotes, logs to DB, explains signals
│   ├── llm/
│   │   ├── client.ts     # callOllama() — wraps Ollama /api/generate REST endpoint
│   │   ├── prompts.ts    # Prompt builders for each AI use case
│   │   └── analyst.ts    # analyzeBacktest, explainSignal, recommendStrategies, getRiskAdvice
│   └── cli/
│       └── prompt.ts     # Interactive CLI loop with auth flow + recommend command
├── exports/              # Backtest JSON exports (gitignored)
├── .github/
│   └── prompts/
│       └── update-readme.prompt.md  # Reusable prompt to keep README in sync
├── .env.example
├── railway.toml
└── package.json
```
