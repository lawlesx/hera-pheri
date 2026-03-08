export type UserId = "lawless" | "splinter";

export interface Trade {
  id?: number;
  user_id: UserId;
  action: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number | null;
  order_id: string | null;
  status: string;
  executed_at: string;
}

export interface OrderResult {
  order_id: string;
  status: "success" | "error";
  message: string;
}
