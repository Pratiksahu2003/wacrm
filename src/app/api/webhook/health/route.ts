/**
 * Webhook Health Check API
 *
 * Provides health status for the webhook system including:
 * - Circuit breaker state
 * - Recent error rates
 * - Queue depth
 * - Database connectivity
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logWebhook, maskId } from '@/lib/whatsapp/webhook-log'

export const runtime = 'nodejs'

// Lazy-initialized Supabase client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: {
      status: 'pass' | 'fail'
      latency_ms: number
      message?: string
    }
    circuit_breaker: {
      status: 'pass' | 'warn' | 'fail'
      state: string
      failure_count: number
      message?: string
    }
    queue_depth: {
      status: 'pass' | 'warn' | 'fail'
      pending_count: number
      failed_count: number
      dead_letter_count: number
      message?: string
    }
    error_rate: {
      status: 'pass' | 'warn' | 'fail'
      error_rate_5m: number
      total_events_5m: number
      message?: string
    }
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get('detailed') === 'true'

  try {
    const admin = supabaseAdmin()
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: {
          status: 'pass',
          latency_ms: 0,
        },
        circuit_breaker: {
          status: 'pass',
          state: 'unknown',
          failure_count: 0,
        },
        queue_depth: {
          status: 'pass',
          pending_count: 0,
          failed_count: 0,
          dead_letter_count: 0,
        },
        error_rate: {
          status: 'pass',
          error_rate_5m: 0,
          total_events_5m: 0,
        },
      },
    }

    // Check database connectivity
    const dbStart = Date.now()
    try {
      const { error: dbError } = await admin
        .from('webhook_events')
        .select('id')
        .limit(1)

      if (dbError) {
        throw dbError
      }

      health.checks.database.latency_ms = Date.now() - dbStart
    } catch (error) {
      health.checks.database.status = 'fail'
      health.checks.database.latency_ms = Date.now() - dbStart
      health.checks.database.message = error instanceof Error ? error.message : 'Database connection failed'
      health.status = 'unhealthy'
    }

    // Check circuit breaker state
    try {
      const { data: circuitBreakers, error: cbError } = await admin
        .from('webhook_circuit_breakers')
        .select('*')

      if (!cbError && circuitBreakers && circuitBreakers.length > 0) {
        const cb = circuitBreakers[0]
        health.checks.circuit_breaker.state = cb.state
        health.checks.circuit_breaker.failure_count = cb.failure_count

        if (cb.state === 'open') {
          health.checks.circuit_breaker.status = 'fail'
          health.checks.circuit_breaker.message = 'Circuit breaker is open'
          health.status = 'degraded'
        } else if (cb.state === 'half_open') {
          health.checks.circuit_breaker.status = 'warn'
          health.checks.circuit_breaker.message = 'Circuit breaker is half-open'
          if (health.status === 'healthy') {
            health.status = 'degraded'
          }
        }
      }
    } catch (error) {
      health.checks.circuit_breaker.message = 'Failed to fetch circuit breaker state'
    }

    // Check queue depth and error rate
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      // Get queue depths
      const { count: pendingCount } = await admin
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: failedCount } = await admin
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')

      const { count: dlqCount } = await admin
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dead_letter')

      health.checks.queue_depth.pending_count = pendingCount || 0
      health.checks.queue_depth.failed_count = failedCount || 0
      health.checks.queue_depth.dead_letter_count = dlqCount || 0

      const totalPending = (pendingCount || 0) + (failedCount || 0)

      if (totalPending > 1000) {
        health.checks.queue_depth.status = 'fail'
        health.checks.queue_depth.message = `High queue depth: ${totalPending} pending events`
        if (health.status !== 'unhealthy') {
          health.status = 'degraded'
        }
      } else if (totalPending > 100) {
        health.checks.queue_depth.status = 'warn'
        health.checks.queue_depth.message = `Elevated queue depth: ${totalPending} pending events`
        if (health.status === 'healthy') {
          health.status = 'degraded'
        }
      }

      // Calculate error rate
      const { count: totalEvents5m } = await admin
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', fiveMinutesAgo)

      const { count: failedEvents5m } = await admin
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', fiveMinutesAgo)
        .in('status', ['failed', 'dead_letter'])

      if (totalEvents5m && totalEvents5m > 0) {
        health.checks.error_rate.total_events_5m = totalEvents5m
        health.checks.error_rate.error_rate_5m = Math.round(((failedEvents5m || 0) / totalEvents5m) * 100)

        if (health.checks.error_rate.error_rate_5m > 50) {
          health.checks.error_rate.status = 'fail'
          health.checks.error_rate.message = `High error rate: ${health.checks.error_rate.error_rate_5m}%`
          if (health.status !== 'unhealthy') {
            health.status = 'degraded'
          }
        } else if (health.checks.error_rate.error_rate_5m > 20) {
          health.checks.error_rate.status = 'warn'
          health.checks.error_rate.message = `Elevated error rate: ${health.checks.error_rate.error_rate_5m}%`
          if (health.status === 'healthy') {
            health.status = 'degraded'
          }
        }
      }
    } catch (error) {
      // Queue depth check failed but don't fail the whole health check
    }

    // Log health check result
    logWebhook('info', 'health_check_completed', {
      status: health.status,
      duration_ms: Date.now() - startedAt,
      checks_summary: {
        database: health.checks.database.status,
        circuit_breaker: health.checks.circuit_breaker.status,
        queue_depth: health.checks.queue_depth.status,
        error_rate: health.checks.error_rate.status,
      },
    })

    // Return appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

    // Remove detailed checks if not requested
    if (!detailed) {
      return NextResponse.json({
        status: health.status,
        timestamp: health.timestamp,
        version: health.version,
      }, { status: statusCode })
    }

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    logWebhook('error', 'health_check_failed', {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - startedAt,
    })

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    )
  }
}