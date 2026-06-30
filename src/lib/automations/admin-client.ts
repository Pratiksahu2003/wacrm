import { createEmulatorClient } from '@/lib/supabase/emulator-server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createEmulatorClient() as unknown as SupabaseClient
  }
  return _adminClient
}
