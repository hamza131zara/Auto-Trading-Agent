# Phase 6.1 — Canonical Market Observation Schema

## Purpose

Normalize observations from different providers without erasing what the provider actually supplied. This schema is an ingestion/data contract, not an authority to trade.

## Canonical fields

A market snapshot must include:
- **Schema version and observation ID:** immutable identity/version for parsing and replay.
- **Network identity:** chain is Solana; cluster is explicit (`mainnet-beta`, `devnet` or `testnet`).
- **Pair identity:** base mint (the asset being observed), quote mint, pool address, and DEX/program address where known. Token-program address is optional when the source does not provide it.
- **Price/liquidity/volume measures:** exact decimal strings plus an explicit unit and asset identifier. Price unit must be explicit. `QUOTE_PER_BASE` means quote-token units per base token and its asset ID must equal `quoteMint`; `USD_PER_BASE` means USD value per base token and uses `assetId: null`. Never use binary floating-point as canonical storage.
- **Activity counts:** buy/sell counts may be null; when present they are non-negative safe integers with a declared 24-hour window.
- **Timestamps:** provider retrieval time, source observation time when supplied, and source event time when supplied. All timestamps are ISO-8601 UTC strings ending in `Z`.
- **Slot:** optional non-negative safe integer for slot-based on-chain observations.
- **Provenance:** sanitized provider ID, adapter version, source kind, optional request/event ID, optional SHA-256 of a raw payload, and whether the record is synthetic.

## Missingness and units

- A missing measure is `null`, never `0`.
- Amounts are non-negative decimal strings without exponent notation. Unit `TOKEN` requires an asset mint; `USD` represents an absolute USD amount and uses `assetId: null`; `USD_PER_BASE` represents a USD-denominated unit price and uses `assetId: null`; `QUOTE_PER_BASE` requires the quote mint.
- The first schema does not infer USD values from token reserves or convert provider-specific units automatically.
- Keep raw provider fields outside the canonical model only when needed for diagnostics/replay, under an explicit retention/redaction policy. A payload digest may prove identity but is not a substitute for provenance or validation.

## Validation

Runtime validation rejects malformed Solana public-key encodings, non-finite/negative/non-decimal quantities, mismatched price unit/quote mint, invalid counts/slots, invalid timestamps and malformed provenance. This is syntactic validation only: it does not prove that an address exists on-chain, a pool is authentic, a price is economically correct or an observation is safe for a trade.

## Versioning

Schema changes are versioned. Breaking changes require a new schema version and fixture migration or compatibility plan; do not reinterpret a prior field in place. An adapter must declare its adapter version separately from the canonical schema version.
