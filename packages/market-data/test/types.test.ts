import type {
  CanonicalMarketSnapshot,
  DataFreshnessState,
  MarketDataAdapter,
  ProviderHealthState,
  SolanaCluster
} from "../src/index.js";

const cluster: SolanaCluster = "devnet";
const freshness: DataFreshnessState = "UNKNOWN";
const health: ProviderHealthState = "CIRCUIT_OPEN";
void cluster;
void freshness;
void health;

// Provider adapter fetches untrusted payloads and must normalize to canonical observations.
const adapterContract: Pick<MarketDataAdapter, "providerId" | "adapterVersion" | "normalize"> = {
  providerId: "fixture-provider",
  adapterVersion: "0.1.0",
  normalize: () => ({ observations: [], errors: [] })
};
void adapterContract;

// @ts-expect-error Unsupported chains must not enter the Solana-only V1 contract.
const unsupportedCluster: SolanaCluster = "ethereum";

// @ts-expect-error Freshness has explicit states; arbitrary provider labels are not valid.
const unsupportedFreshness: DataFreshnessState = "PROBABLY_FRESH";

// @ts-expect-error A provider health state is not a market data freshness state.
const mixedOperationalState: DataFreshnessState = health;

void unsupportedCluster;
void unsupportedFreshness;
void mixedOperationalState;

// @ts-expect-error Canonical decimal values must be represented by measure objects, not a JS number.
const unsafePrice: CanonicalMarketSnapshot["price"] = 0.5;

void unsafePrice;
