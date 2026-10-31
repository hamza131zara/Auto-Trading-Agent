-- Phase 6.46 durable provider trust-registry anti-rollback state.
-- This migration only defines persistent state; it does not provision runtime
-- roles, connect to a database, load trust roots, authorize providers or trade.

CREATE TABLE IF NOT EXISTS public.provider_trust_registry_high_water_marks (
  registry_id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version > 0 AND version <= 9007199254740991),
  canonical_payload_sha256 varchar(64) NOT NULL CHECK (
    canonical_payload_sha256 ~ '^[a-f0-9]{64}$'
  ),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT provider_trust_registry_high_water_mark_id_format CHECK (
    registry_id ~ '^[a-z0-9][a-z0-9._-]{0,62}$'
  )
);

COMMENT ON TABLE public.provider_trust_registry_high_water_marks IS
  'Phase 6.46 monotonic provider trust-registry version and canonical digest; updated only by compare-and-swap.';

COMMENT ON COLUMN public.provider_trust_registry_high_water_marks.version IS
  'Highest accepted signed registry snapshot version; bounded to JavaScript safe integers.';

COMMENT ON COLUMN public.provider_trust_registry_high_water_marks.canonical_payload_sha256 IS
  'Lowercase SHA-256 of the exact canonical unsigned registry signing payload.';
