import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';
import { resolveBroadcastAudience } from '@/lib/broadcasts/resolve-audience';
import { INSERT_BATCH_SIZE } from '@/lib/broadcasts/processor';
import { triggerBroadcastProcessingHttp } from '@/lib/broadcasts/trigger';
import type { AudienceConfig, VariableMapping } from '@/lib/broadcasts/types';

export const runtime = 'nodejs';
/** Large audiences need time to insert recipient rows before returning. */
export const maxDuration = 300;

interface StartBroadcastBody {
  name: string;
  template_name: string;
  template_language?: string;
  variables: Record<string, VariableMapping>;
  audience: AudienceConfig;
}

/**
 * Queue a broadcast: create DB rows, return immediately, process in the
 * background. The client redirects to the detail page where live stats
 * update while sending continues server-side.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `broadcast-start:${user.id}`,
      RATE_LIMITS.broadcast,
    );
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as StartBroadcastBody;
    const { name, template_name, template_language, variables, audience } =
      body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 },
      );
    }
    if (!audience) {
      return NextResponse.json(
        { error: 'audience is required' },
        { status: 400 },
      );
    }

    const contacts = await resolveBroadcastAudience(
      supabase,
      accountId,
      user.id,
      audience,
    );

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found for this audience.' },
        { status: 400 },
      );
    }

    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .insert({
        account_id: accountId,
        user_id: user.id,
        name: name.trim(),
        template_name,
        template_language: template_language ?? 'en_US',
        template_variables: variables ?? {},
        audience_filter: {
          type: audience.type,
          tagIds: audience.tagIds,
          customField: audience.customField,
          excludeTagIds: audience.excludeTagIds,
        },
        status: 'sending',
        total_recipients: contacts.length,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        replied_count: 0,
        failed_count: 0,
      })
      .select('id')
      .single();

    if (broadcastError || !broadcast) {
      return NextResponse.json(
        {
          error:
            broadcastError?.message ?? 'Failed to create broadcast record',
        },
        { status: 500 },
      );
    }

    const recipientRows = contacts.map((contact) => ({
      broadcast_id: broadcast.id,
      contact_id: contact.id,
      status: 'pending' as const,
    }));

    for (let i = 0; i < recipientRows.length; i += INSERT_BATCH_SIZE) {
      const batch = recipientRows.slice(i, i + INSERT_BATCH_SIZE);
      const { error: recipientError } = await supabase
        .from('broadcast_recipients')
        .insert(batch);
      if (recipientError) {
        await supabase
          .from('broadcasts')
          .update({ status: 'failed', failed_count: contacts.length })
          .eq('id', broadcast.id);
        return NextResponse.json(
          { error: `Failed to queue recipients: ${recipientError.message}` },
          { status: 500 },
        );
      }
    }

    triggerBroadcastProcessingHttp(broadcast.id);

    return NextResponse.json({
      success: true,
      broadcast_id: broadcast.id,
      total_recipients: contacts.length,
      message: 'Broadcast queued — sending continues in the background.',
    });
  } catch (error) {
    console.error('[broadcasts/start] error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to queue broadcast',
      },
      { status: 500 },
    );
  }
}
