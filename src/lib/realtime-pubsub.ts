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

// In-memory pub-sub singleton attached to global to persist across Next.js hot reloads
const globalPubSub = (global as any).realtimePubSub || new RealtimePubSub();
if (process.env.NODE_ENV !== 'production') {
  (global as any).realtimePubSub = globalPubSub;
}

export const realtimePubSub = globalPubSub;
