import { EventEmitter } from 'events';

class RealtimePubSub extends EventEmitter {
  publish(event: string, data: any) {
    this.emit(event, data);
  }

  subscribe(event: string, listener: (data: any) => void) {
    this.on(event, listener);
    return () => {
      this.off(event, listener);
    };
  }
}

// In-memory pub-sub singleton attached to global to persist across module
// re-evaluations (Next.js hot reloads in dev) AND across route handler
// invocations in production — without this the webhook module and the SSE
// /api/realtime module each get their own EventEmitter instance, so
// publish() calls never reach subscribe() listeners.
if (!(global as any).__realtimePubSub) {
  (global as any).__realtimePubSub = new RealtimePubSub();
}
const globalPubSub: RealtimePubSub = (global as any).__realtimePubSub;

export const realtimePubSub = globalPubSub;
