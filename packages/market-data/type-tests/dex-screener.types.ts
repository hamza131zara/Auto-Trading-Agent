import type { MarketDataAdapter, MeasureUnit } from "../src/index.js";
import type { DexScreenerPairsAdapter } from "../src/providers/dex-screener.js";

// Compile-time-only declarations: this file must never execute provider code.
declare const adapter: DexScreenerPairsAdapter;
const adapterContract: MarketDataAdapter = adapter;
const usdPerBase: MeasureUnit = "USD_PER_BASE";
void adapterContract;
void usdPerBase;

// @ts-expect-error The DEX Screener adapter is read-only and does not expose transaction submission.
const sendTransaction = adapter.sendTransaction;
void sendTransaction;
