import type { MarketDataAdapter, MeasureUnit } from "../src/index.js";
import { DexScreenerPairsAdapter } from "../src/providers/dex-screener.js";

const adapter: MarketDataAdapter = new DexScreenerPairsAdapter(async () =>
  new Response('{"pairs":[]}', { status: 200 })
);
const usdPerBase: MeasureUnit = "USD_PER_BASE";
void adapter;
void usdPerBase;

// @ts-expect-error The DEX Screener adapter is read-only and does not expose transaction submission.
const sendTransaction = adapter.sendTransaction;

void sendTransaction;
