-- Phase 6 shared provider-health state and distributed recovery-probe lease.
-- Apply through the normal migration runner; this file does not connect to a database.

CREATE TABLE IF NOT EXISTS public.provider_health (
  provider_id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'CIRCUIT_OPEN')),
  consecutive_failures integer NOT NULL CHECK (consecutive_failures >= 0),
  last_success_at timestamptz NULL,
  last_failure_at timestamptz NULL,
  last_request_at timestamptz NULL,
  last_latency_ms double precision NULL CHECK (last_latency_ms IS NULL OR last_latency_ms >= 0),
  circuit_open_until timestamptz NULL,
  last_error_class text NULL CHECK (
    last_error_class IS NULL OR
    last_error_class IN ('TIMEOUT', 'RATE_LIMIT', 'NETWORK', 'HTTP', 'PARSE', 'AUTH', 'UNKNOWN')
  ),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT provider_health_id_format CHECK (provider_id ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
  CONSTRAINT provider_health_last_request_order CHECK (
    last_success_at IS NULL OR last_failure_at IS NULL OR last_success_at <= last_failure_at
    OR state = 'HEALTHY'
  ),
  CONSTRAINT provider_health_circuit_state CHECK (
    (state = 'CIRCUIT_OPEN' AND circuit_open_until IS NOT NULL)
    OR (state <> 'CIRCUIT_OPEN' AND circuit_open_until IS NULL)
  ),
  CONSTRAINT provider_health_healthy_state CHECK (
    state <> 'HEALTHY'
    OR (consecutive_failures = 0 AND last_success_at IS NOT NULL
        AND last_request_at = last_success_at AND last_error_class IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS provider_health_state_updated_idx
  ON public.provider_health (state, updated_at DESC);

-- One row per provider is intentionally retained after release/expiry so the
-- fencing token remains monotonically increasing across all future claimants.
CREATE TABLE IF NOT EXISTS public.provider_recovery_probe_leases (
  provider_id text PRIMARY KEY
    REFERENCES public.provider_health(provider_id) ON DELETE CASCADE,
  owner_id text NULL,
  lease_token_hash char(64) NULL,
  acquired_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  released_at timestamptz NULL,
  CONSTRAINT provider_recovery_lease_owner_pair CHECK (
    (owner_id IS NULL AND lease_token_hash IS NULL)
    OR (owner_id IS NOT NULL AND lease_token_hash IS NOT NULL)
  ),
  CONSTRAINT provider_recovery_lease_hash_format CHECK (
    lease_token_hash IS NULL OR lease_token_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT provider_recovery_lease_owner_format CHECK (
    owner_id IS NULL OR owner_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
  )
);

CREATE INDEX IF NOT EXISTS provider_recovery_probe_expiry_idx
  ON public.provider_recovery_probe_leases (expires_at)
  WHERE owner_id IS NOT NULL;
