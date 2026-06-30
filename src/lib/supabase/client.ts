import { createEmulatorClient } from './emulator'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: any = null

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient
  browserClient = createEmulatorClient() as unknown as SupabaseClient
  return browserClient
}
