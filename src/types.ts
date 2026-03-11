export type UserId = "lawless" | "splinter";

export type CandleInterval = "1min" | "5min" | "15min" | "1h" | "1day";

export interface UserSession {
  userId: UserId;
  apiKey: string;
  apiSecret: string;
  accessToken: string | null;
}

export interface Trade {
  id?: number;
  user_id: UserId;
  action: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number | null;
  order_id: string | null;
  order_type: "MARKET" | "LIMIT" | "SL" | "SL-M";
  status: string;
  executed_at: string;
}

export interface OrderResult {
  order_id: string;
  status: "success" | "error";
  message: string;
}

export interface Candle {
  symbol: string;
  interval: CandleInterval;
  ts: string;       // ISO datetime string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  action: "BUY" | "SELL";
  reason: string;
  price: number;   // signal bar's close price
  indicators?: Record<string, number>;  // indicator values at signal bar (for LLM explanation)
}

export interface BacktestTrade {
  entryTs: string;
  exitTs: string | null;
  action: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number | null;
  qty: number;
  pnl: number | null;
  commission: number;
  reason: string;
}

export interface BacktestResult {
  strategy: string;
  symbol: string;
  interval: CandleInterval;
  from: string;
  to: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;     // percent
  cagr: number;            // percent
  sharpe: number;
  maxDrawdown: number;     // percent
  winRate: number;         // percent
  totalTrades: number;
  trades: BacktestTrade[];
  equityCurve: { ts: string; equity: number }[];
}

export interface PaperTrade {
  id?: number;
  strategy: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  signal_reason: string;
  simulated_at: string;
}
