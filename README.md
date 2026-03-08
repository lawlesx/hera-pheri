# 🐍 Hera-Pheri Trade Bot

NSE Intraday trading bot for Lawless & Splinter. Built with Bun.js + TypeScript, Kite Connect, Turso SQLite, and deployed on Railway.

## Stack

| Layer      | Tech                   |
| ---------- | ---------------------- |
| Runtime    | Bun.js + TypeScript    |
| Broker API | Kite Connect (Zerodha) |
| Database   | Turso (hosted SQLite)  |
| Deployment | Railway                |

---

## First-Time Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd hera-pheri
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your Kite Connect and Turso credentials
```

### 3. Set Up Turso

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create a DB
turso db create hera-pheri

# Get URL and token
turso db show hera-pheri --url
turso db tokens create hera-pheri
```

Add URL and token to your `.env`.

### 4. Run DB Migrations

```bash
bun run migrate
```

### 5. Kite Connect Auth

Kite requires a daily OAuth login to get an `access_token`. See [Kite Connect docs](https://kite.trade/docs/connect/v3/user/) for setup. Add the token to `.env`.

---

## Running the Bot

```bash
bun run start
```

---

## CLI Commands

```
buy <SYMBOL> <QTY>     Place a market BUY order
sell <SYMBOL> <QTY>    Place a market SELL order
quote <SYMBOL>         Get current price of a stock
history                Show your last 20 trades
help                   Show command reference
exit                   Exit the bot
```

### Example Session

```
> Who are you? (lawless/splinter): lawless
> Welcome, Lawless! Market is 🟢 OPEN

[Lawless] > buy RELIANCE 10
⏳ Placing BUY order — 10 × RELIANCE...
✅ BUY 10 RELIANCE @ MARKET placed successfully
   Order ID: 112233

[Lawless] > history
📋 Last 1 trades for Lawless:
...
```

---

## Deploy on Railway

1. Push to GitHub
2. Create a new Railway project → Connect repo
3. Add all env vars from `.env` to Railway Variables
4. Deploy — Railway picks up `railway.toml` automatically

> ⚠️ Note: This is an intraday MIS bot. All positions are auto-squared off by Zerodha at market close.

---

## Project Structure

```
hera-pheri/
├── index.ts              # Entrypoint
├── src/
│   ├── env.ts            # Env loader
│   ├── types.ts          # Shared types
│   ├── kite/
│   │   ├── client.ts     # Kite Connect client + market hours
│   │   └── orders.ts     # placeOrder() — buy/sell
│   ├── db/
│   │   ├── client.ts     # Turso connection
│   │   ├── migrate.ts    # Schema + seed
│   │   └── trades.ts     # Log & fetch trades
│   └── cli/
│       └── prompt.ts     # Interactive CLI loop
├── .env.example
├── railway.toml
└── package.json
```
