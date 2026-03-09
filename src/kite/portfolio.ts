import type { KiteInstance } from "./client";

function col(text: string, width: number): string {
  return String(text).padEnd(width);
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

function pnlCol(value: number, width: number): string {
  const sign = value >= 0 ? "+" : "";
  const plain = `${sign}₹${Math.abs(value).toFixed(2)}`.padEnd(width);
  return value >= 0 ? green(plain) : red(plain);
}

export async function displayPositions(kite: KiteInstance): Promise<void> {
  const { net } = await kite.getPositions();
  const active = net.filter((p) => p.quantity !== 0 || p.pnl !== 0);

  if (active.length === 0) {
    console.log("📭 No open positions.");
    return;
  }

  const C = 14;
  const SEP = "─".repeat(C * 6);
  console.log("\n📊 Positions:\n");
  console.log(SEP);
  console.log(
    ["Symbol", "Qty", "Avg Price", "LTP", "Unrealised", "Realised"]
      .map((h) => col(h, C))
      .join("")
  );
  console.log(SEP);

  let totalPnl = 0;
  for (const p of active) {
    console.log(
      col(p.tradingsymbol, C) +
        col(String(p.quantity), C) +
        col(`₹${p.average_price.toFixed(2)}`, C) +
        col(`₹${p.last_price.toFixed(2)}`, C) +
        pnlCol(p.unrealised, C) +
        pnlCol(p.realised, C)
    );
    totalPnl += p.pnl;
  }

  console.log(SEP);
  console.log(`${"TOTAL P&L:".padStart(C * 5)}  ${pnlCol(totalPnl, 0)}`);
  console.log();
}

export async function displayOrders(kite: KiteInstance): Promise<void> {
  const orders = await kite.getOrders();

  if (orders.length === 0) {
    console.log("📭 No orders today.");
    return;
  }

  const C = 13;
  const SEP = "─".repeat(C * 6 + 4);
  console.log(`\n📋 Order Book (${orders.length} orders):\n`);
  console.log(SEP);
  console.log(
    ["#", "Time", "Symbol", "Type", "Qty", "Status"].map((h) => col(h, C)).join("")
  );
  console.log(SEP);

  for (let i = 0; i < Math.min(orders.length, 50); i++) {
    const o = orders[i]!;
    const ts = new Date(o.order_timestamp as unknown as string).toLocaleTimeString("en-IN");

    const typeColored = (o.transaction_type === "BUY" ? green : red)(
      col(o.transaction_type, C)
    );
    const statusColored =
      o.status === "COMPLETE"
        ? green(col(o.status, C))
        : o.status === "REJECTED" || o.status === "CANCELLED"
          ? red(col(o.status, C))
          : yellow(col(o.status, C));

    console.log(
      col(String(i + 1), C) +
        col(ts, C) +
        col(o.tradingsymbol, C) +
        typeColored +
        col(String(o.quantity), C) +
        statusColored
    );
  }

  console.log(SEP);
  console.log();
}
