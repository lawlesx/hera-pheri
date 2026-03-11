import { callOllama } from "./client";
import {
  buildBacktestPrompt,
  buildSignalPrompt,
  buildStrategyRecommendPrompt,
  buildRiskPrompt,
} from "./prompts";
import type { BacktestResult, Signal, Candle } from "../types";

export async function analyzeBacktest(result: BacktestResult): Promise<string> {
  return callOllama(buildBacktestPrompt(result));
}

export async function explainSignal(signal: Signal, candle: Candle): Promise<string> {
  return callOllama(buildSignalPrompt(signal, candle, signal.indicators ?? {}));
}

export async function recommendStrategies(
  symbol: string,
  results: BacktestResult[]
): Promise<string> {
  return callOllama(buildStrategyRecommendPrompt(symbol, results));
}

export async function getRiskAdvice(
  symbol: string,
  action: "BUY" | "SELL",
  qty: number,
  entryPrice: number | null
): Promise<string> {
  return callOllama(buildRiskPrompt(symbol, action, qty, entryPrice));
}
