import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessFreshness,
  initialProviderHealth,
  isSolanaPublicKey,
  recordProviderResult,
  replayMarketDataCases,
  validateCanonicalMarketSnapshot
} from "../packages/market-data/dist/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);

function casesForReplay() {
  return fixture.cases.map(({ caseId, snapshot, nowAt, maxAgeMs, maxFutureSkewMs }) => ({
    caseId,
    snapshot,
    nowAt,
    maxAgeMs,
    ...(maxFutureSkewMs === undefined ? {} : { maxFutureSkewMs })
  }));
}

test("Solana public-key validation checks base58 alphabet and decoded length", () => {
  assert.equal(isSolanaPublicKey("So11111111111111111111111111111111111111112"), true);
  assert.equal(isSolanaPublicKey("11111111111111111111111111111111"), true);
  assert.equal(isSolanaPublicKey("0OIl-not-base58"), false);
  assert.equal(isSolanaPublicKey("too-short"), false);
});

test("synthetic fixture records are structurally valid but explicitly synthetic", () => {
  const fresh = fixture.cases.find((item) => item.caseId === "fresh-source");
  assert.ok(fresh);
  assert.equal(validateCanonicalMarketSnapshot(fresh.snapshot).valid, true);
  assert.equal(fresh.snapshot.provenance.synthetic, true);
  assert.equal(fresh.snapshot.provenance.sourceKind, "REPLAY_FIXTURE");
});

test("replay deterministically reports the expected freshness states", () => {
  const first = replayMarketDataCases(casesForReplay());
  const second = replayMarketDataCases(casesForReplay());
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((item) => [item.caseId, item.validation.valid, item.freshness.state]),
    fixture.cases.map((item) => [item.caseId, item.expectedValid, item.expectedFreshness])
  );
});

test("missing measures/counts remain null rather than being coerced to zero", () => {
  const item = fixture.cases.find((candidate) => candidate.caseId === "unknown-source-time");
  assert.ok(item);
  const validation = validateCanonicalMarketSnapshot(item.snapshot);
  assert.equal(validation.valid, true);
  assert.equal(item.snapshot.price, null);
  assert.equal(item.snapshot.buys24h, null);
  assert.equal(item.snapshot.sells24h, null);
});

test("rejects exponent notation, negative amounts and JS numbers as canonical measures", () => {
  const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
  assert.ok(original);

  for (const value of ["1e-8", "-1", "NaN", "Infinity", "01.2"]) {
    const altered = structuredClone(original);
    altered.price.value = value;
    assert.equal(validateCanonicalMarketSnapshot(altered).valid, false, value);
  }

  const numeric = structuredClone(original);
  numeric.price.value = 0.0123;
  assert.equal(validateCanonicalMarketSnapshot(numeric).valid, false);
});

test("rejects price measure if its asset ID differs from quote mint", () => {
  const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
  const altered = structuredClone(original);
  altered.price.assetId = altered.baseMint;
  assert.ok(validateCanonicalMarketSnapshot(altered).errors.some((error) => error.includes("price.assetId")));
});

test("rejects invalid public keys, negative counts and malformed timestamps", () => {
  const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;

  const invalidKey = structuredClone(original);
  invalidKey.baseMint = "0OIl-invalid";
  assert.ok(validateCanonicalMarketSnapshot(invalidKey).errors.some((error) => error.includes("baseMint")));

  const invalidCount = structuredClone(original);
  invalidCount.buys24h = -1;
  assert.ok(validateCanonicalMarketSnapshot(invalidCount).errors.some((error) => error.includes("buys24h")));

  const invalidTime = structuredClone(original);
  invalidTime.retrievedAt = "2026-10-29 00:00:00";
  assert.ok(validateCanonicalMarketSnapshot(invalidTime).errors.some((error) => error.includes("retrievedAt")));
});

test("retrieval age and source-event age are checked independently", () => {
  const input = {
    retrievedAt: "2026-10-29T00:01:58.000Z",
    observedAt: "2026-10-29T00:00:00.000Z",
    sourceEventAt: "2026-10-29T00:00:00.000Z",
    nowAt: "2026-10-29T00:02:00.000Z",
    maxAgeMs: 60000
  };
  assert.deepEqual(assessFreshness(input), {
    state: "STALE",
    ageMs: 120000,
    maxAgeMs: 60000,
    reasonCodes: ["SOURCE_EXCEEDS_MAX_AGE"]
  });
});

test("a new retrieval with no source time is UNKNOWN, not FRESH", () => {
  const result = assessFreshness({
    retrievedAt: "2026-10-29T00:00:55.000Z",
    observedAt: null,
    sourceEventAt: null,
    nowAt: "2026-10-29T00:01:00.000Z",
    maxAgeMs: 60000
  });
  assert.equal(result.state, "UNKNOWN");
  assert.deepEqual(result.reasonCodes, ["SOURCE_TIMESTAMP_MISSING"]);
});

test("malformed and future timestamps fail as INVALID", () => {
  assert.equal(assessFreshness({
    retrievedAt: "not-a-time",
    observedAt: null,
    sourceEventAt: null,
    nowAt: "2026-10-29T00:01:00.000Z",
    maxAgeMs: 60000
  }).state, "INVALID");

  assert.equal(assessFreshness({
    retrievedAt: "2026-10-29T00:00:59.000Z",
    observedAt: "2026-10-29T00:03:00.000Z",
    sourceEventAt: "2026-10-29T00:03:00.000Z",
    nowAt: "2026-10-29T00:01:00.000Z",
    maxAgeMs: 60000,
    maxFutureSkewMs: 1000
  }).state, "INVALID");
});

test("an invalid freshness policy returns INVALID rather than throwing", () => {
  assert.equal(assessFreshness({
    retrievedAt: "2026-10-29T00:00:00.000Z",
    observedAt: "2026-10-29T00:00:00.000Z",
    sourceEventAt: "2026-10-29T00:00:00.000Z",
    nowAt: "2026-10-29T00:01:00.000Z",
    maxAgeMs: -1
  }).state, "INVALID");
});

test("provider health begins UNKNOWN and a retryable failure degrades it", () => {
  const initial = initialProviderHealth("example-rpc");
  assert.equal(initial.state, "UNKNOWN");

  const degraded = recordProviderResult(initial, {
    kind: "FAILURE",
    at: "2026-10-29T00:00:01.000Z",
    errorClass: "TIMEOUT",
    retryable: true,
    latencyMs: 500
  }, { failureThreshold: 2, cooldownMs: 30000 });
  assert.equal(degraded.state, "DEGRADED");
  assert.equal(degraded.consecutiveFailures, 1);
});

test("repeated retryable failures open the circuit and set a deterministic cooldown", () => {
  const policy = { failureThreshold: 2, cooldownMs: 30000 };
  const first = recordProviderResult(initialProviderHealth("example-rpc"), {
    kind: "FAILURE",
    at: "2026-10-29T00:00:01.000Z",
    errorClass: "NETWORK",
    retryable: true,
    latencyMs: null
  }, policy);
  const open = recordProviderResult(first, {
    kind: "FAILURE",
    at: "2026-10-29T00:00:02.000Z",
    errorClass: "TIMEOUT",
    retryable: true,
    latencyMs: null
  }, policy);

  assert.equal(open.state, "CIRCUIT_OPEN");
  assert.equal(open.consecutiveFailures, 2);
  assert.equal(open.circuitOpenUntil, "2026-10-29T00:00:32.000Z");
});

test("success resets failures and a non-retryable auth failure marks unavailable", () => {
  const failed = recordProviderResult(initialProviderHealth("example-rpc"), {
    kind: "FAILURE",
    at: "2026-10-29T00:00:01.000Z",
    errorClass: "TIMEOUT",
    retryable: true,
    latencyMs: 100
  }, { failureThreshold: 3, cooldownMs: 30000 });

  const healthy = recordProviderResult(failed, {
    kind: "SUCCESS",
    at: "2026-10-29T00:00:02.000Z",
    latencyMs: 25
  }, { failureThreshold: 3, cooldownMs: 30000 });
  assert.equal(healthy.state, "HEALTHY");
  assert.equal(healthy.consecutiveFailures, 0);
  assert.equal(healthy.circuitOpenUntil, null);

  const unavailable = recordProviderResult(initialProviderHealth("example-rpc"), {
    kind: "FAILURE",
    at: "2026-10-29T00:00:03.000Z",
    errorClass: "AUTH",
    retryable: false,
    latencyMs: 20
  }, { failureThreshold: 2, cooldownMs: 30000 });
  assert.equal(unavailable.state, "UNAVAILABLE");
});

test("invalid provider-health policy is rejected", () => {
  assert.throws(() => recordProviderResult(initialProviderHealth("example-rpc"), {
    kind: "SUCCESS",
    at: "2026-10-29T00:00:00.000Z",
    latencyMs: 1
  }, { failureThreshold: 0, cooldownMs: 1000 }), /failureThreshold/);
});
