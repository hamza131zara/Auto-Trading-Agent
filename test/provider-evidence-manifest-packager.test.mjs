import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CANONICAL_PYTH_FEED_IDENTITIES,
  PROVIDER_EVIDENCE_MANIFEST_VERSION,
  validateProviderEvidenceManifest
} from "../scripts/validate-provider-evidence-manifest.mjs";
import {
  MAX_PROVIDER_EVIDENCE_ARTIFACT_BYTES,
  ProviderEvidenceManifestPackagingError,
  prepareProviderEvidenceManifest
} from "../scripts/package-provider-evidence-manifest.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function makeManifest(locator = "feeds/pyth-symbology.json", artifactOverrides = {}) {
  return {
    schemaVersion: PROVIDER_EVIDENCE_MANIFEST_VERSION,
    generatedAt: "2026-10-30T11:00:00.000Z",
    records: [{
      evidenceId: "P6E-PYTH-SYMBOLS-LOCAL-001",
      providerIds: ["pyth-pro"],
      evidenceType: "FEED_SYMBOLOGY",
      quality: "FIRST_PARTY_PUBLIC",
      issuer: "Pyth first-party documentation",
      issuedAt: "2026-10-30T10:00:00.000Z",
      artifact: {
        storage: "LOCAL_FILE",
        locator,
        fileName: "pyth-symbology.json",
        mediaType: "application/json",
        ...artifactOverrides
      },
      scope: {
        summary: "Owner-supplied Pyth SOL/USD and USDC/USD symbology artifact.",
        deliveryModels: ["DISPLAY_ONLY"],
        coveredActions: ["DISPLAY"]
      },
      review: {
        state: "RECEIVED_UNREVIEWED",
        reviewer: null,
        reviewedAt: null,
        findings: []
      },
      feedMetadata: [
        {
          feedName: "SOL/USD",
          pythLazerId: 98765,
          canonicalFeedId: CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].canonicalFeedId,
          assetMint: CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].assetMint,
          feedState: "stable",
          minPublisherCount: 3,
          minChannel: "fixed_rate@1000ms",
          marketSessions: [{ session: "regular", state: "stable", minPublisherCount: 3 }]
        },
        {
          feedName: "USDC/USD",
          pythLazerId: 98766,
          canonicalFeedId: CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].canonicalFeedId,
          assetMint: CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].assetMint,
          feedState: "stable",
          minPublisherCount: 2,
          minChannel: "fixed_rate@1000ms",
          marketSessions: []
        }
      ]
    }]
  };
}

function withPrivateArtifact(callback) {
  const root = mkdtempSync(join(tmpdir(), "ata-evidence-packager-"));
  const artifactRoot = join(root, "artifacts");
  mkdirSync(join(artifactRoot, "feeds"), { recursive: true });
  writeFileSync(join(artifactRoot, "feeds", "pyth-symbology.json"), "{\"source\":\"owner-supplied-test-fixture\"}\n");
  try {
    callback({ root, artifactRoot, bytes: readFixtureBytes() });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function readFixtureBytes() {
  return Buffer.from("{\"source\":\"owner-supplied-test-fixture\"}\n", "utf8");
}

test("packager computes local artifact digests and returns a structurally valid non-authorizing manifest", () => {
  withPrivateArtifact(({ artifactRoot, bytes }) => {
    const prepared = prepareProviderEvidenceManifest(makeManifest(), { artifactRoot });
    assert.equal(prepared.manifest.records[0].artifact.sha256, sha256(bytes));
    assert.equal(prepared.localArtifactCount, 1);
    assert.equal(prepared.localArtifactBytes, bytes.length);
    assert.equal(prepared.report.valid, true);
    assert.equal(prepared.report.status, "STRUCTURALLY_VALID_NOT_AN_APPROVAL");
    assert.equal(prepared.report.approvalMutationPerformed, false);
    assert.equal(prepared.report.tradingAuthorized, false);
    assert.equal(validateProviderEvidenceManifest(prepared.manifest, { artifactRoot }).valid, true);
    assert.equal(Object.hasOwn(prepared.manifest.records[0].artifact, "content"), false);
  });
});

test("packager rejects path traversal and symlinked evidence artifacts", () => {
  withPrivateArtifact(({ root, artifactRoot }) => {
    assert.throws(
      () => prepareProviderEvidenceManifest(makeManifest("../outside.json"), { artifactRoot }),
      ProviderEvidenceManifestPackagingError
    );
    const outside = join(root, "outside.json");
    writeFileSync(outside, "not an evidence artifact\n");
    symlinkSync(outside, join(artifactRoot, "feeds", "linked.json"));
    assert.throws(
      () => prepareProviderEvidenceManifest(makeManifest("feeds/linked.json"), { artifactRoot }),
      /symlink/i
    );
  });
});

test("packager rejects an existing digest that does not match the local bytes", () => {
  withPrivateArtifact(({ artifactRoot }) => {
    assert.throws(
      () => prepareProviderEvidenceManifest(makeManifest("feeds/pyth-symbology.json", {
        sha256: "0".repeat(64)
      }), { artifactRoot }),
      /does not match/
    );
  });
});

test("packager rejects credential-bearing metadata keys before writing a manifest", () => {
  withPrivateArtifact(({ artifactRoot }) => {
    const manifest = makeManifest();
    manifest.records[0].api_key = "must-not-be-included";
    assert.throws(
      () => prepareProviderEvidenceManifest(manifest, { artifactRoot }),
      /credential-bearing/
    );
  });
});

test("packager enforces the per-artifact size bound before reading artifact bytes", () => {
  withPrivateArtifact(({ artifactRoot }) => {
    const manifest = makeManifest();
    const oversized = join(artifactRoot, "oversized.bin");
    writeFileSync(oversized, Buffer.alloc(0));
    truncateSync(oversized, MAX_PROVIDER_EVIDENCE_ARTIFACT_BYTES + 1);
    manifest.records[0].artifact.locator = "oversized.bin";
    assert.throws(
      () => prepareProviderEvidenceManifest(manifest, { artifactRoot }),
      /50 MiB/
    );
  });
});
