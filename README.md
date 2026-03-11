# 🐍 Hera-Pheri Trade Bot

NSE Intraday trading bot for two users, each with their own Zerodha account. Built with Bun.js + TypeScript, Kite Connect, and SQLite.

## Stack

| Layer      | Tech                                                           |
| ---------- | -------------------------------------------------------------- |
| Runtime    | Bun.js + TypeScript                                            |
| Broker API | Kite Connect (Zerodha)                                         |
| Database   | SQLite — local file or hosted via [Turso](https://turso.tech/) |
| Deployment | Local or Railway                                               |

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
```

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
help                                       Show command reference
ref                                        Glossary — order types, GTT params, MIS/CNC explained  usage                                      Order counts (today/week/month/all-time) + estimated brokerageexit                                       Exit the bot
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
│   ├── types.ts          # Shared types
│   ├── kite/
│   │   ├── client.ts     # Per-user Kite client factory + market hours
│   │   ├── auth.ts       # OAuth login — local server + browser open
│   │   ├── orders.ts     # placeOrder() (MARKET/LIMIT/SL/SL-M) + placeExitOrders()
│   │   ├── gtt.ts        # GTT: placeSingleGTT(), placeOCOGTT(), deleteGTT(), displayGTTs()
│   │   └── portfolio.ts  # displayPositions(), displayOrders(), displayHistory(), displayFunds(), displayUsage()
│   ├── db/
│   │   ├── client.ts     # SQLite/Turso connection
│   │   ├── migrate.ts    # Schema + user seed
│   │   ├── tokens.ts     # Save/validate daily access tokens
│   │   ├── trades.ts     # Log & fetch trade history + getUsageStats()
│   │   └── gtt.ts        # logGTT() — local audit log for GTT placements
│   └── cli/
│       └── prompt.ts     # Interactive CLI loop with auth flow
├── .github/
│   └── prompts/
│       └── update-readme.prompt.md  # Reusable prompt to keep README in sync
├── .env.example
├── railway.toml
└── package.json
```
