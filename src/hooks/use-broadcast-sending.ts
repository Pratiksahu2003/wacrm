'use client';

import { useState } from 'react';
import type { MessageTemplate } from '@/types';
import type {
  AudienceConfig,
  VariableMapping,
} from '@/lib/broadcasts/types';

export type {
  CustomFieldOperator,
  CustomFieldFilter,
  AudienceConfig,
  VariableMapping,
} from '@/lib/broadcasts/types';

export { resolveVariables } from '@/lib/broadcasts/resolve-variables';

interface BroadcastPayload {
  name: string;
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
}

interface UseBroadcastSendingReturn {
  /** Queue a broadcast; returns as soon as the server accepts the job. */
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
}

/**
 * Queues a broadcast on the server and returns immediately. Sending
 * continues in the background — track progress on the broadcast detail
 * page.
 */
export function useBroadcastSending(): UseBroadcastSendingReturn {
  const [isProcessing, setIsProcessing] = useState(false);

  async function createAndSendBroadcast(
    payload: BroadcastPayload,
  ): Promise<string> {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/broadcasts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          template_name: payload.template.name,
          template_language: payload.template.language ?? 'en_US',
          variables: payload.variables,
          audience: payload.audience,
        }),
      });

      const data = (await res.json()) as {
        broadcast_id?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to queue broadcast');
      }

      if (!data.broadcast_id) {
        throw new Error('Server did not return a broadcast id');
      }

      return data.broadcast_id;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing };
}
