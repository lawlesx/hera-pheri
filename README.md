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
buy <SYMBOL> <QTY>          Place a market BUY order   (e.g. buy RELIANCE 10)
sell <SYMBOL> <QTY>         Place a market SELL order  (e.g. sell TCS 5)
watch <S1> [S2...]          Live price feed — refreshes every 2s (press Enter to stop)
quote <SYMBOL>              Get the current price of a stock
positions                   Open positions with unrealised / realised P&L
orders                      Today's order book with colour-coded status
history                     Show your last 20 trades
help                        Show command reference
exit                        Exit the bot
```

> ⚠️ All orders use **MIS (Margin Intraday Square-off)**. Open positions are auto-closed by Zerodha at 3:25 PM IST.

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
│   │   ├── orders.ts     # placeOrder() — MIS market orders
│   │   └── portfolio.ts  # displayPositions() + displayOrders() — P&L & order book
│   ├── db/
│   │   ├── client.ts     # SQLite/Turso connection
│   │   ├── migrate.ts    # Schema + user seed
│   │   ├── tokens.ts     # Save/validate daily access tokens
│   │   └── trades.ts     # Log & fetch trade history
│   └── cli/
│       └── prompt.ts     # Interactive CLI loop with auth flow
├── .github/
│   └── prompts/
│       └── update-readme.prompt.md  # Reusable prompt to keep README in sync
├── .env.example
├── railway.toml
└── package.json
```
