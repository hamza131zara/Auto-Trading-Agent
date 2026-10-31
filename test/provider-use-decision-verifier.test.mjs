import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  createReloadableSignedProviderUseDecisionResolver,
  createSignedProviderUseDecisionResolver,
  getProviderUseDecisionSigningPayload,
  verifySignedProviderUseDecision
} from "../packages/market-data/dist/provider-use-decision-verifier.js";

const NOW = "2026-10-31T13:30:00.000Z";
const DECISION = {
  providerId: "dex-screener",
  purpose: "DIAGNOSTIC",
  decisionId: "owner-decision-2026-10-31-01",
  owner: "repository-owner",
  outcome: "PROCEED_DIAGNOSTIC_ONLY",
  scope: "Read-only Phase 6 diagnostic retrieval for the named provider only",
  decidedAt: "2026-10-31T13:00:00.000Z",
  expiresAt: "2026-11-01T13:00:00.000Z",
  linkedEvidenceIds: ["rights-review-2026-10-31", "provider-terms-2026-10-31"],
  evidenceManifestSha256: "a".repeat(64)
};

function fixtures(overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const trustedKey = {
    keyId: "owner-ed25519-2026-01",
    owner: DECISION.owner,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    notBefore: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    revokedAt: null,
    allowedProviderIds: ["dex-screener"],
    allowedPurposes: ["DIAGNOSTIC"],
    ...overrides.trustedKey
  };
  const unsigned = {
    schemaVersion: "ata.provider-use-decision.v1",
    keyId: trustedKey.keyId,
    algorithm: "Ed25519",
    decision: structuredClone(overrides.decision ?? DECISION)
  };
  const signature = sign(
    null,
    Buffer.from(getProviderUseDecisionSigningPayload(unsigned), "utf8"),
    privateKey
  ).toString("base64url");
  const envelope = { ...unsigned, signature };
  return { publicKey, privateKey, trustedKey, unsigned, envelope };
}

test("accepts a correctly signed, scoped and time-bounded diagnostic decision", () => {
  const f = fixtures();
  const result = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [f.trustedKey],
    providerId: "dex-screener",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  assert.equal(result.authorized, true);
  assert.equal(result.decision?.decisionId, DECISION.decisionId);
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(Object.isFrozen(result.decision?.linkedEvidenceIds), true);
});

test("rejects a decision changed after it was signed", () => {
  const f = fixtures();
  const tampered = {
    ...f.envelope,
    decision: { ...f.envelope.decision, scope: "Changed scope that was never signed" }
  };
  const result = verifySignedProviderUseDecision({
    envelope: tampered,
    trustedKeys: [f.trustedKey],
    providerId: "dex-screener",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  assert.equal(result.authorized, false);
  assert.deepEqual(result.reasonCodes, ["PROVIDER_USE_DECISION_SIGNATURE_INVALID"]);
});

test("rejects a valid signature when the key is not in the external trust registry", () => {
  const f = fixtures();
  const result = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [],
    providerId: "dex-screener",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  assert.equal(result.authorized, false);
  assert.deepEqual(result.reasonCodes, ["PROVIDER_DECISION_TRUSTED_KEY_MISSING_OR_AMBIGUOUS"]);
});

test("rejects expired, not-yet-active and revoked owner signing keys", () => {
  const f = fixtures();
  for (const keyOverrides of [
    { expiresAt: "2026-10-31T13:29:59.000Z" },
    { notBefore: "2026-10-31T13:30:01.000Z" },
    { revokedAt: "2026-10-31T13:29:59.000Z" }
  ]) {
    const result = verifySignedProviderUseDecision({
      envelope: f.envelope,
      trustedKeys: [{ ...f.trustedKey, ...keyOverrides }],
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC",
      at: NOW
    });
    assert.equal(result.authorized, false);
    assert.deepEqual(result.reasonCodes, ["PROVIDER_DECISION_TRUSTED_KEY_INACTIVE"]);
  }
});

test("rejects a key outside its configured provider or purpose scope", () => {
  const f = fixtures();
  const result = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [{ ...f.trustedKey, allowedProviderIds: ["raydium-api-v3"] }],
    providerId: "dex-screener",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  assert.equal(result.authorized, false);
  assert.deepEqual(result.reasonCodes, ["PROVIDER_DECISION_TRUSTED_KEY_SCOPE_MISMATCH"]);
});

test("rejects wrong provider or purpose even when the envelope signature is valid", () => {
  const f = fixtures();
  const providerMismatch = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [f.trustedKey],
    providerId: "geckoterminal",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  const purposeMismatch = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [f.trustedKey],
    providerId: "dex-screener",
    purpose: "PRODUCTION",
    at: NOW
  });
  assert.equal(providerMismatch.authorized, false);
  assert.equal(purposeMismatch.authorized, false);
});

test("requires a finite decision expiry and rejects expired decisions", () => {
  const f = fixtures();
  const noExpiryDecision = { ...DECISION, expiresAt: null };
  const noExpiry = fixtures({ decision: noExpiryDecision });
  const expiredDecision = { ...DECISION, expiresAt: "2026-10-31T13:29:59.000Z" };
  const expired = fixtures({ decision: expiredDecision });
  assert.deepEqual(
    verifySignedProviderUseDecision({
      envelope: noExpiry.envelope,
      trustedKeys: [noExpiry.trustedKey],
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC",
      at: NOW
    }).reasonCodes,
    ["PROVIDER_USE_DECISION_INVALID"]
  );
  assert.deepEqual(
    verifySignedProviderUseDecision({
      envelope: expired.envelope,
      trustedKeys: [expired.trustedKey],
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC",
      at: NOW
    }).reasonCodes,
    ["PROVIDER_USE_DECISION_EXPIRED"]
  );
});

test("production decisions require production-scope outcome and key permission", () => {
  const productionDecision = {
    ...DECISION,
    purpose: "PRODUCTION",
    outcome: "PROCEED_PRODUCTION_SCOPE"
  };
  const f = fixtures({
    decision: productionDecision,
    trustedKey: { allowedPurposes: ["DIAGNOSTIC", "PRODUCTION"] }
  });
  const result = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [f.trustedKey],
    providerId: "dex-screener",
    purpose: "PRODUCTION",
    at: NOW
  });
  assert.equal(result.authorized, true);
});

test("resolver rejects duplicate matching records instead of choosing one", () => {
  const f = fixtures();
  const resolver = createSignedProviderUseDecisionResolver({
    envelopes: [f.envelope, f.envelope],
    trustedKeys: [f.trustedKey]
  });
  assert.equal(resolver("dex-screener", "DIAGNOSTIC", NOW), undefined);
});

test("resolver returns only a cryptographically verified frozen decision", () => {
  const f = fixtures();
  const resolver = createSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    trustedKeys: [f.trustedKey]
  });
  const result = resolver("dex-screener", "DIAGNOSTIC", NOW);
  assert.equal(result?.decisionId, DECISION.decisionId);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result?.linkedEvidenceIds), true);
  assert.equal(resolver("dex-screener", "PRODUCTION", NOW), undefined);
});

test("rejects unsupported envelope fields and malformed signatures", () => {
  const f = fixtures();
  const withExtraField = { ...f.envelope, note: "not covered by signed payload" };
  const malformedSignature = { ...f.envelope, signature: "not-a-signature" };
  for (const envelope of [withExtraField, malformedSignature]) {
    const result = verifySignedProviderUseDecision({
      envelope,
      trustedKeys: [f.trustedKey],
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC",
      at: NOW
    });
    assert.equal(result.authorized, false);
  }
});

test("rejects ambiguous trusted key identifiers", () => {
  const f = fixtures();
  const result = verifySignedProviderUseDecision({
    envelope: f.envelope,
    trustedKeys: [f.trustedKey, f.trustedKey],
    providerId: "dex-screener",
    purpose: "DIAGNOSTIC",
    at: NOW
  });
  assert.deepEqual(result.reasonCodes, ["PROVIDER_DECISION_TRUSTED_KEY_MISSING_OR_AMBIGUOUS"]);
});


test("reloadable resolver observes trusted-key revocation without a process restart", () => {
  const f = fixtures();
  const state = {
    loadedAt: NOW,
    keys: [structuredClone(f.trustedKey)]
  };
  let loadCount = 0;
  const resolver = createReloadableSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    loadTrustedKeySnapshot: () => {
      loadCount += 1;
      return state;
    },
    maxSnapshotAgeMs: 60_000
  });

  assert.equal(resolver("dex-screener", "DIAGNOSTIC", NOW)?.decisionId, DECISION.decisionId);
  state.loadedAt = "2026-10-31T13:30:01.000Z";
  state.keys[0].revokedAt = "2026-10-31T13:30:01.000Z";
  assert.equal(resolver("dex-screener", "DIAGNOSTIC", "2026-10-31T13:30:02.000Z"), undefined);
  assert.equal(loadCount, 2);
});

test("reloadable resolver denies stale, future-dated and unavailable key snapshots", () => {
  const f = fixtures();
  const state = {
    loadedAt: "2026-10-31T13:20:00.000Z",
    keys: [f.trustedKey]
  };
  const resolver = createReloadableSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    loadTrustedKeySnapshot: () => state,
    maxSnapshotAgeMs: 60_000
  });
  assert.equal(resolver("dex-screener", "DIAGNOSTIC", NOW), undefined);

  state.loadedAt = "2026-10-31T13:31:00.000Z";
  assert.equal(resolver("dex-screener", "DIAGNOSTIC", NOW), undefined);

  state.loadedAt = NOW;
  const unavailable = createReloadableSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    loadTrustedKeySnapshot: () => { throw new Error("revocation store unavailable"); },
    maxSnapshotAgeMs: 60_000
  });
  assert.equal(unavailable("dex-screener", "DIAGNOSTIC", NOW), undefined);
});

test("reloadable resolver rejects malformed key snapshots and excessive freshness bounds", () => {
  const f = fixtures();
  const malformed = createReloadableSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    loadTrustedKeySnapshot: () => ({ loadedAt: NOW, keys: [f.trustedKey], extra: true }),
    maxSnapshotAgeMs: 60_000
  });
  const excessiveAge = createReloadableSignedProviderUseDecisionResolver({
    envelopes: [f.envelope],
    loadTrustedKeySnapshot: () => ({ loadedAt: NOW, keys: [f.trustedKey] }),
    maxSnapshotAgeMs: 300_001
  });
  assert.equal(malformed("dex-screener", "DIAGNOSTIC", NOW), undefined);
  assert.equal(excessiveAge("dex-screener", "DIAGNOSTIC", NOW), undefined);
});
