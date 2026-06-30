/**
 * Webhook Metrics API
 *
 * Provides real-time and historical metrics for webhook monitoring:
 * - Success/failure rates
 * - Latency statistics
 * - Retry counts
 * - Dead letter queue size
 * - Circuit breaker state
 */

import { NextResponse } from 'next/server'
import { createEmulatorClient as createClient } from '@/lib/supabase/emulator-server'
import { logWebhook, maskId } from '@/lib/whatsapp/webhook-log'

export const runtime = 'nodejs'

// Lazy-initialized Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient() as unknown as any
  }
  return _adminClient
}

// GET - Retrieve webhook metrics
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || '1h' // 1h, 24h, 7d, 30d
  const accountId = searchParams.get('account_id') || null

  try {
    const admin = supabaseAdmin()
    const now = new Date()
    let startTime: Date

    // Calculate time range
    switch (range) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '1h':
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
    }

    // Get aggregated metrics from webhook_metrics table
    const { data: metrics, error: metricsError } = await admin
      .from('webhook_metrics')
      .select('*')
      .gte('bucket_hour', startTime.toISOString())
      .lte('bucket_hour', now.toISOString())

    if (metricsError) {
      logWebhook('error', 'metrics_fetch_failed', {
        error: metricsError.message,
        range,
      })
      return NextResponse.json(
        { error: 'Failed to fetch metrics' },
        { status: 500 }
      )
    }

    // Calculate aggregate statistics
    const stats = {
      total_events: 0,
      successful_events: 0,
      failed_events: 0,
      retry_count: 0,
      dead_letter_count: 0,
      avg_latency_ms: 0,
      success_rate: 0,
    }

    let totalLatency = 0
    let latencyCount = 0

    metrics?.forEach((m: {
      event_count: number
      status: string
      retry_count: number
      dead_letter_count: number
      total_latency_ms: number
    }) => {
      stats.total_events += m.event_count

      if (m.status === 'success') {
        stats.successful_events += m.event_count
      } else if (m.status === 'failed' || m.status === 'dead_letter') {
        stats.failed_events += m.event_count
      }

      stats.retry_count += m.retry_count
      stats.dead_letter_count += m.dead_letter_count

      if (m.total_latency_ms > 0) {
        totalLatency += m.total_latency_ms
        latencyCount += m.event_count
      }
    })

    if (latencyCount > 0) {
      stats.avg_latency_ms = Math.round(totalLatency / latencyCount)
    }

    if (stats.total_events > 0) {
      stats.success_rate = Math.round((stats.successful_events / stats.total_events) * 100)
    }

    // Get current circuit breaker state
    const { data: circuitBreakers, error: cbError } = await admin
      .from('webhook_circuit_breakers')
      .select('*')

    if (cbError) {
      logWebhook('error', 'circuit_breaker_fetch_failed', {
        error: cbError.message,
      })
    }

    // Get dead letter queue size
    const { count: dlqCount, error: dlqError } = await admin
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dead_letter')

    if (dlqError) {
      logWebhook('error', 'dlq_count_failed', {
        error: dlqError.message,
      })
    }

    // Get recent events (last 10)
    const { data: recentEvents, error: recentError } = await admin
      .from('webhook_events')
      .select('id, event_id, event_type, status, received_at, attempt_count')
      .order('received_at', { ascending: false })
      .limit(10)

    if (recentError) {
      logWebhook('error', 'recent_events_fetch_failed', {
        error: recentError.message,
      })
    }

    return NextResponse.json({
      range,
      start_time: startTime.toISOString(),
      end_time: now.toISOString(),
      statistics: stats,
      circuit_breakers: circuitBreakers?.map((cb: { circuit_key: string; state: string; failure_count: number }) => ({
        key: cb.circuit_key,
        state: cb.state,
        failure_count: cb.failure_count,
      })) || [],
      dead_letter_queue: {
        size: dlqCount || 0,
      },
      recent_events: recentEvents?.map((e: { id: string; event_id: string; event_type: string; status: string; received_at: string; attempt_count: number }) => ({
        id: maskId(e.id),
        event_id: maskId(e.event_id),
        event_type: e.event_type,
        status: e.status,
        received_at: e.received_at,
        attempt_count: e.attempt_count,
      })) || [],
    })
  } catch (error) {
    logWebhook('error', 'metrics_endpoint_error', {
      error: error instanceof Error ? error.message : String(error),
      range,
      account_id: accountId ? maskId(accountId) : null,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}