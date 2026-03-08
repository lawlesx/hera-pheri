# 🐍 Hera-Pheri Trade Bot

NSE Intraday trading bot for two users, each with their own Zerodha account. Built with Bun.js + TypeScript, Kite Connect, Turso, and Railway.

## Stack

| Layer      | Tech                                                    |
| ---------- | ------------------------------------------------------- |
| Runtime    | Bun.js + TypeScript                                     |
| Broker API | Kite Connect (Zerodha)                                  |
| Database   | Turso (hosted SQLite) — stores daily access tokens only |
| Deployment | Railway                                                 |

---

## Architecture

- **API credentials** (`api_key`, `api_secret`) live in Railway environment variables — never in the DB
- **Access tokens** (expire daily at 6 AM) are stored per-user in Turso
- On startup, the bot checks if the token is still valid. If expired, it triggers a Kite OAuth login automatically

---

## First-Time Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd hera-pheri
bun install
```

### 2. Set Up Turso

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create the database
turso db create hera-pheri

# Get connection details
turso db show hera-pheri --url
turso db tokens create hera-pheri
```

### 3. Configure Kite Connect Apps

Each user needs their own Kite Connect app at [kite.trade](https://kite.trade/).

> ⚠️ **Important**: Set the **Redirect URL** in each Kite app to:
>
> ```
> http://127.0.0.1:3000
> ```
>
> This is required for the automatic OAuth token capture to work.

### 4. Configure Environment Variables

```bash
cp .env.example .env
# Fill in all values (see .env.example for the format)
```

**Required env vars:**

```
LAWLESS_KITE_API_KEY=...
LAWLESS_KITE_API_SECRET=...

SPLINTER_KITE_API_KEY=...
SPLINTER_KITE_API_SECRET=...

TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=...
```

### 5. Run DB Migrations

```bash
bun run migrate
```

---

## Running the Bot

```bash
bun run start
```

---

## Session Flow

```
👤 Who are you? (lawless/splinter): lawless

🔑 Checking authentication...
  ✅ Token valid.              ← if token exists and was issued today
  OR
  ⚠️  Token expired. Starting Kite login...
     → Browser opens Kite login page
     → You log in with Zerodha credentials
     → Token captured automatically
     → ✅ Authentication successful!

✅ Welcome, Lawless! Market is 🟢 OPEN
```

---

## CLI Commands

```
buy <SYMBOL> <QTY>     Place a market BUY order  (e.g. buy RELIANCE 10)
sell <SYMBOL> <QTY>    Place a market SELL order (e.g. sell TCS 5)
quote <SYMBOL>         Get current price of a stock
history                Show your last 20 trades
help                   Show command reference
exit                   Exit the bot
```

---

## Deploy on Railway

1. Push to GitHub
2. New Railway project → Connect repo
3. Add all env vars in Railway → Variables
4. Deploy — `railway.toml` handles the rest

> ⚠️ This bot places **MIS (Margin Intraday Square-off)** orders. All open positions are auto-squared off by Zerodha at market close (3:25 PM IST).

---

## Project Structure

```
hera-pheri/
├── index.ts                  # Entrypoint — runs migrations, starts CLI
├── src/
│   ├── env.ts                # Env loader
│   ├── types.ts              # Shared types (UserId, Trade, etc.)
│   ├── kite/
│   │   ├── client.ts         # Per-user Kite client factory + market hours
│   │   ├── auth.ts           # OAuth login — local server + browser open
│   │   └── orders.ts         # placeOrder() — MIS market orders
│   ├── db/
│   │   ├── client.ts         # Turso connection
│   │   ├── migrate.ts        # Schema + user seed
│   │   ├── tokens.ts         # Save/validate daily access tokens
│   │   └── trades.ts         # Log & fetch trade history
│   └── cli/
│       └── prompt.ts         # Interactive CLI loop with auth flow
├── .env.example
├── railway.toml
└── package.json
```
