export type UserId = "lawless" | "splinter";

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
