import { createEmulatorClient } from './emulator'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function createClient(): Promise<SupabaseClient> {
  return createEmulatorClient() as unknown as SupabaseClient
}
