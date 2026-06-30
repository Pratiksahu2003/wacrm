import { realtimePubSub } from '@/lib/realtime-pubsub';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Keep connection alive with periodic heartbeat comments
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 25000);

      // Subscribe to database changes
      const unsubscribe = realtimePubSub.subscribe('db_changes', (payload: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          unsubscribe();
          clearInterval(keepAliveInterval);
        }
      });

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(keepAliveInterval);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
