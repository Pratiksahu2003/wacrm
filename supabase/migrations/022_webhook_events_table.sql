


-- Migration: Webhook Events Tracking System
-- Creates tables for idempotency, retry tracking, DLQ, and webhook metrics

-- ============================================
-- 1. Webhook Events Table (Core)
-- ============================================
-- Tracks every webhook event received for idempotency, retry management,xxxxx
-- dead letter queue functionality, and audit trails.

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Event identification and idempotency
    event_id TEXT NOT NULL,                    -- Meta's event id (for deduplication)
    idempotency_key TEXT NOT NULL,              -- Computed hash of event content

    -- Event metadata
    event_type TEXT NOT NULL,                   -- 'message', 'status', 'template', etc.
    source TEXT NOT NULL DEFAULT 'meta',        -- 'meta', 'internal', etc.
    phone_number_id TEXT,                       -- For routing/context

    -- Processing state
    status TEXT NOT NULL DEFAULT 'pending',     -- pending, processing, completed, failed, dead_letter
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,

    -- Timing
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,

    -- Payload (truncated for storage - full in S3 if needed)
    payload JSONB,
    payload_size INTEGER,

    -- Error tracking
    last_error TEXT,
    error_details JSONB,

    -- Tenancy
    account_id UUID REFERENCES accounts(id),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency
    ON webhook_events(idempotency_key) WHERE status IN ('pending', 'processing', 'completed');

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_retry
    ON webhook_events(status, next_retry_at) WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id
    ON webhook_events(event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_phone_number_id
    ON webhook_events(phone_number_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_account_id
    ON webhook_events(account_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
    ON webhook_events(received_at DESC);

-- ============================================
-- 2. Webhook Retry Queue Table
-- ============================================
-- Separate queue for managing retries with backoff

CREATE TABLE IF NOT EXISTS webhook_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,

    -- Retry configuration
    attempt_number INTEGER NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,

    -- Result
    success BOOLEAN,
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_scheduled
    ON webhook_retry_queue(scheduled_at) WHERE executed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_event_id
    ON webhook_retry_queue(webhook_event_id);

-- ============================================
-- 3. Webhook Metrics Table (Time-Series)
-- ============================================
-- Aggregated metrics for monitoring and alerting

CREATE TABLE IF NOT EXISTS webhook_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Time bucket (hourly aggregation)
    bucket_hour TIMESTAMPTZ NOT NULL,

    -- Dimensions
    account_id UUID REFERENCES accounts(id),
    event_type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed', 'retry', 'dead_letter'

    -- Metrics
    event_count INTEGER NOT NULL DEFAULT 0,
    total_latency_ms INTEGER NOT NULL DEFAULT 0, -- Sum for averaging
    retry_count INTEGER NOT NULL DEFAULT 0,
    dead_letter_count INTEGER NOT NULL DEFAULT 0,

    -- Error breakdown (top error types)
    error_breakdown JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(bucket_hour, account_id, event_type, status)
);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_bucket
    ON webhook_metrics(bucket_hour DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_metrics_account
    ON webhook_metrics(account_id, bucket_hour DESC);

-- ============================================
-- 4. Circuit Breaker State Table
-- ============================================
-- Tracks circuit breaker state for external services

CREATE TABLE IF NOT EXISTS webhook_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Circuit identification
    circuit_key TEXT NOT NULL UNIQUE, -- e.g., 'meta_webhook', 'meta_api'
    service_name TEXT NOT NULL,

    -- State
    state TEXT NOT NULL DEFAULT 'closed', -- 'closed', 'open', 'half_open'

    -- Failure tracking
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_failure_reason TEXT,

    -- Thresholds
    failure_threshold INTEGER NOT NULL DEFAULT 5,
    recovery_timeout_ms INTEGER NOT NULL DEFAULT 30000, -- 30 seconds

    -- Timing
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. Row Level Security Policies
-- ============================================

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_circuit_breakers ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY webhook_events_service ON webhook_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY webhook_retry_queue_service ON webhook_retry_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY webhook_metrics_service ON webhook_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY webhook_circuit_breakers_service ON webhook_circuit_breakers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 6. Functions and Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

CREATE TRIGGER webhook_retry_queue_updated_at
    BEFORE UPDATE ON webhook_retry_queue
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

CREATE TRIGGER webhook_metrics_updated_at
    BEFORE UPDATE ON webhook_metrics
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

CREATE TRIGGER webhook_circuit_breakers_updated_at
    BEFORE UPDATE ON webhook_circuit_breakers
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

-- ============================================
-- 7. Metrics Aggregation Function
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_webhook_metrics(
    p_bucket_hour TIMESTAMPTZ,
    p_account_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO webhook_metrics (
        bucket_hour,
        account_id,
        event_type,
        status,
        event_count,
        total_latency_ms,
        retry_count,
        dead_letter_count
    )
    SELECT
        p_bucket_hour,
        COALESCE(e.account_id, p_account_id),
        e.event_type,
        CASE
            WHEN e.status = 'dead_letter' THEN 'dead_letter'
            WHEN e.status = 'failed' THEN 'failed'
            WHEN e.status = 'completed' THEN 'success'
            ELSE 'retry'
        END as status,
        COUNT(*),
        COALESCE(SUM(EXTRACT(EPOCH FROM (e.processed_at - e.received_at)) * 1000), 0),
        SUM(CASE WHEN e.attempt_count > 1 THEN 1 ELSE 0 END),
        SUM(CASE WHEN e.status = 'dead_letter' THEN 1 ELSE 0 END)
    FROM webhook_events e
    WHERE e.received_at >= p_bucket_hour
      AND e.received_at < p_bucket_hour + interval '1 hour'
      AND (p_account_id IS NULL OR e.account_id = p_account_id)
    GROUP BY e.account_id, e.event_type, e.status
    ON CONFLICT (bucket_hour, account_id, event_type, status)
    DO UPDATE SET
        event_count = EXCLUDED.event_count,
        total_latency_ms = EXCLUDED.total_latency_ms,
        retry_count = EXCLUDED.retry_count,
        dead_letter_count = EXCLUDED.dead_letter_count,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Cleanup Old Webhook Events Function
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(
    p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_events
    WHERE received_at < now() - (p_retention_days || ' days')::interval
      AND status IN ('completed', 'dead_letter');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Comments for Documentation
-- ============================================

COMMENT ON TABLE webhook_events IS 'Stores all webhook events for idempotency, retry management, and audit trails';
COMMENT ON TABLE webhook_retry_queue IS 'Queue for managing webhook retries with exponential backoff';
COMMENT ON TABLE webhook_metrics IS 'Aggregated metrics for webhook monitoring and alerting';
COMMENT ON TABLE webhook_circuit_breakers IS 'Circuit breaker state for external services';
