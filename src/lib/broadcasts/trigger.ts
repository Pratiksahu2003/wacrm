/**
 * Internal URL for server-to-server calls (broadcast processor, etc.).
 * Falls back to localhost in dev when no public URL is configured.
 */
export function getInternalAppOrigin(): string {
  if (process.env.INTERNAL_APP_URL) {
    return process.env.INTERNAL_APP_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? '3000';
  return `http://127.0.0.1:${port}`;
}

/**
 * Shared secret for internal broadcast process / cron routes.
 * Reuses automation cron secret when set; otherwise ENCRYPTION_KEY
 * (always required in this app) so broadcasts auto-start with zero
 * extra operator setup.
 */
export function getBroadcastInternalSecret(): string | undefined {
  return (
    process.env.BROADCAST_CRON_SECRET ??
    process.env.AUTOMATION_CRON_SECRET ??
    process.env.ENCRYPTION_KEY
  );
}

/**
 * Kick off background sending in a *separate* HTTP request so work
 * survives the /api/broadcasts/start response being returned.
 * Called automatically when a broadcast is queued — no manual cron.
 */
export function triggerBroadcastProcessingHttp(broadcastId: string): void {
  const secret = getBroadcastInternalSecret();
  if (!secret) {
    console.error(
      '[broadcast] cannot auto-start processor — set ENCRYPTION_KEY or BROADCAST_CRON_SECRET',
    );
    return;
  }

  const url = `${getInternalAppOrigin()}/api/broadcasts/process`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({ broadcast_id: broadcastId }),
  }).catch((err) => {
    console.error(
      `[broadcast] auto process request failed for ${broadcastId}:`,
      err,
    );
  });
}
