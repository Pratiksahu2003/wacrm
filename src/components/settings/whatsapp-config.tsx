'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';
import { whatsappNumberLimitMessage } from '@/lib/vedmint-subscription';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const supabase = createClient();
  const router = useRouter();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();
  const canEditTeam = useCan('edit-settings');
  const {
    withinLimit,
    remaining,
    limits,
    usage,
    loading: entitlementsLoading,
  } = useEntitlements();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [configs, setConfigs] = useState<WhatsAppConfigType[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [displayName, setDisplayName] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // True once /register has succeeded on Meta's side (timestamp set
  // in the row). When false, the saved config is metadata-only and
  // Meta will silently drop every inbound event — that's the
  // multi-number bug that prompted this work.
  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);
  const [webhookSignatureReady, setWebhookSignatureReady] = useState(true);

  const whatsappLimit = limits.max_whatsapp_numbers ?? null;
  const whatsappUsed = Math.max(
    usage.max_whatsapp_numbers ?? 0,
    configs.length,
  );
  const canAddWhatsAppNumber =
    entitlementsLoading || withinLimit('max_whatsapp_numbers', 1);
  const whatsappRemaining = remaining('max_whatsapp_numbers');
  const isAddingNewNumber = !(selectedConfigId || config?.id);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('whatsapp_config')
        .select(
          'id, user_id, account_id, phone_number_id, waba_id, access_token, verify_token, status, connected_at, registered_at, subscribed_apps_at, last_registration_error, display_name, is_default, created_at, updated_at',
        )
        .eq('account_id', acctId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load config rows:', error);
      }

      const list = (rows as WhatsAppConfigType[]) || [];
      setConfigs(list);
      const preferred =
        list.find((r) => Number(r.is_default) === 1) || list[0] || null;
      const data =
        (selectedConfigId && list.find((r) => r.id === selectedConfigId)) ||
        preferred;

      if (data) {
        setSelectedConfigId(data.id);
        setConfig(data);
        setDisplayName(data.display_name || '');
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setIsDefault(Boolean(data.is_default));
      } else {
        setSelectedConfigId(null);
        setConfig(null);
        setDisplayName('');
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setIsDefault(true);
      }
      setRegistrationProbe(null);

      try {
        const secretRes = await fetch('/api/whatsapp/config/app-secret');
        const secretPayload = await secretRes.json();
        if (secretRes.ok) {
          setWebhookSignatureReady(
            Boolean(secretPayload.configured || secretPayload.server_env_fallback),
          );
        }
      } catch (err) {
        console.error('App secret status check failed:', err);
      }

      if (data) {
        try {
          const res = await fetch(
            `/api/whatsapp/config${data.id ? `?id=${encodeURIComponent(data.id)}` : ''}`,
            { method: 'GET' },
          );
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
        }
      } else {
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (isAddingNewNumber && !canAddWhatsAppNumber) {
      toast.error(
        whatsappLimit != null
          ? whatsappNumberLimitMessage(whatsappLimit)
          : 'WhatsApp number limit reached. Upgrade your plan.',
      );
      router.push('/billing');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      // Always POST through the API — it verifies with Meta and encrypts
      // the access_token server-side with ENCRYPTION_KEY. Skipping this
      // and writing direct to Supabase stores the token in plaintext,
      // which then fails decryption on every subsequent health check.
      const payload: Record<string, unknown> = {
        id: selectedConfigId || config?.id || undefined,
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        display_name: displayName.trim() || null,
        is_default: isDefault,
        // Optional — only sent when the user filled it in. The server
        // requires it on first save or when changing numbers; for a
        // simple token rotation, leaving it blank skips re-register.
        pin: pin.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        // Existing config — reuse stored encrypted token by decrypting on the
        // server. But our POST handler requires an access_token to verify
        // with Meta. If the user didn't change the token, we need to signal
        // that. Simplest: require token re-entry if they're updating.
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      // The route now returns a structured outcome:
      //   * registered=true   → number is live, events will flow
      //   * registered=false  → credentials saved but /register
      //                         failed; UI shows the specific error
      //                         and a retry path. registration_error
      //                         is human-readable from Meta.
      if (data.registered === false && data.registration_error) {
        toast.error(
          `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          { duration: 12000 },
        );
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? `Live — ${data.phone_info.verified_name} can now receive events.`
            : 'WhatsApp connected. Events will start flowing within a minute.',
        );
        // Clear the PIN so subsequent saves don't accidentally
        // re-register (which would void the active subscription if
        // the PIN became stale).
        setPin('');
      }

      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const id = selectedConfigId || config?.id;
      const res = await fetch(
        `/api/whatsapp/config${id ? `?id=${encodeURIComponent(id)}` : ''}`,
        { method: 'GET' },
      );
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const id = selectedConfigId || config?.id;
      const res = await fetch(
        `/api/whatsapp/config/verify-registration${
          id ? `?id=${encodeURIComponent(id)}` : ''
        }`,
        { method: 'GET' },
      );
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Number is fully wired — Meta is delivering events.');
      } else {
        toast.error(
          'Number is not fully registered. See the checks below for which step failed.',
          { duration: 8000 },
        );
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Could not reach the verification endpoint.');
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleReset() {
    if (!confirm('This will delete the current WhatsApp config so you can re-enter it. Continue?')) {
      return;
    }

    try {
      setResetting(true);
      const id = selectedConfigId || config?.id;
      const res = await fetch(
        `/api/whatsapp/config${id ? `?id=${encodeURIComponent(id)}` : ''}`,
        { method: 'DELETE' },
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to reset configuration');
        return;
      }

      toast.success('Configuration cleared. You can now re-enter your credentials.');
      setSelectedConfigId(null);
      setConfig(null);
      setDisplayName('');
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      {/* Main config form */}
      <div className="space-y-6">
        {!canEditTeam && (
          <Alert className="bg-card border-border">
            <AlertTitle className="text-foreground">Account WhatsApp numbers</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              These are the WhatsApp numbers for your account. You send from the
              number assigned to you in Team settings (or the account default).
              Only owners/admins can change credentials.
            </AlertDescription>
          </Alert>
        )}

        {/* Corrupted-token reset banner */}
        {showResetBanner && canEditTeam && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">
                  Stored token can&apos;t be decrypted
                </AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-foreground"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Reset Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Connection Status */}
        <Alert
          className={
            connectionStatus === 'connected'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : connectionStatus === 'disconnected'
                ? 'border-red-500/40 bg-red-500/10'
                : 'bg-card border-border'
          }
        >
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="size-4 text-emerald-700" />
            ) : (
              <XCircle className="size-4 text-red-600" />
            )}
            <AlertTitle className="text-foreground mb-0">
              {connectionStatus === 'connected' ? 'Credentials valid' : 'Not Connected'}
            </AlertTitle>
          </div>
          <AlertDescription className="text-foreground/80">
            {connectionStatus === 'connected'
              ? 'Your access token authenticates with Meta. See registration status below for whether webhooks are wired.'
              : statusMessage ||
                'Configure your Meta API credentials below to connect your WhatsApp Business account.'}
          </AlertDescription>
        </Alert>

        {/* Registration Status — historical /register success is not the
            same as a live API session. When credentials are invalid,
            do not claim Meta is delivering events. */}
        {config && (
          <Alert
            className={
              connectionStatus !== 'connected'
                ? 'border-border bg-muted/50'
                : isRegistered
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
            }
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {connectionStatus !== 'connected' ? (
                  <AlertTriangle className="size-4 text-amber-600" />
                ) : isRegistered ? (
                  <CheckCircle2 className="size-4 text-emerald-700" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600" />
                )}
                <AlertTitle className="mb-0 text-foreground">
                  {connectionStatus !== 'connected'
                    ? isRegistered
                      ? 'Registration paused — fix credentials first'
                      : 'Not registered — Meta will not deliver events'
                    : isRegistered
                      ? 'Registered — Meta will deliver events to VedMint CRM'
                      : 'Not registered — Meta will not deliver events'}
                </AlertTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyRegistration}
                disabled={verifyingRegistration || connectionStatus !== 'connected'}
                className="border-border bg-background text-foreground hover:bg-muted h-7"
              >
                {verifyingRegistration ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                Verify with Meta
              </Button>
            </div>
            <AlertDescription className="text-foreground/75 mt-2 text-xs leading-relaxed">
              {connectionStatus !== 'connected' ? (
                <>
                  {isRegistered ? (
                    <>
                      This number was registered earlier
                      {config.registered_at
                        ? ` (${new Date(config.registered_at).toLocaleString()})`
                        : ''}
                      , but the access token is no longer valid. Paste a
                      fresh token below and save — then verify registration.
                    </>
                  ) : (
                    <>
                      Connect with a valid access token first, then enter the
                      2-step PIN and save to register the number.
                    </>
                  )}
                </>
              ) : isRegistered ? (
                <>
                  Subscribed since{' '}
                  {config.registered_at
                    ? new Date(config.registered_at).toLocaleString()
                    : 'unknown'}
                  . Click <strong>Verify with Meta</strong> if events
                  stop arriving.
                </>
              ) : lastRegistrationError ? (
                <>
                  Last attempt failed with:{' '}
                  <span className="font-medium text-red-700">
                    &quot;{lastRegistrationError}&quot;
                  </span>
                  . Enter (or correct) the 2-step PIN below and click
                  Save Configuration to retry.
                </>
              ) : (
                <>
                  This number was saved before registration tracking
                  existed, or registration was skipped. Enter the
                  2-step PIN below and click Save Configuration to
                  subscribe it.
                </>
              )}
            </AlertDescription>

            {registrationProbe && (
              <div className="mt-3 rounded border border-border bg-background px-3 py-2 space-y-1.5 text-[11px]">
                <p className="font-medium text-foreground">
                  Diagnostic — last run:{' '}
                  <span
                    className={
                      registrationProbe.live
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }
                  >
                    {registrationProbe.live ? 'live' : 'not live'}
                  </span>
                </p>
                <ul className="space-y-0.5 text-foreground/70">
                  {Object.entries(registrationProbe.checks).map(([k, v]) => (
                    <li key={k} className="flex items-center gap-1.5">
                      {v === true ? (
                        <CheckCircle2 className="size-3 text-emerald-700 shrink-0" />
                      ) : v === false ? (
                        <XCircle className="size-3 text-red-600 shrink-0" />
                      ) : (
                        <span className="size-3 rounded-full border border-border shrink-0" />
                      )}
                      <code className="text-foreground/80">{k}</code>
                    </li>
                  ))}
                </ul>
                {(registrationProbe.errors ?? []).length > 0 && (
                  <ul className="pt-1 space-y-0.5 text-red-700">
                    {registrationProbe.errors?.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Alert>
        )}

        {/* Multiple WhatsApp numbers */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-foreground">WhatsApp numbers</CardTitle>
              <CardDescription className="text-muted-foreground">
                Add numbers for this account, set a default for broadcasts, and
                assign them in Team settings.
                {whatsappLimit == null
                  ? ' Business plan: unlimited numbers.'
                  : ` Plan limit: ${whatsappUsed}/${whatsappLimit}.`}
              </CardDescription>
            </div>
            {canEditTeam ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAddWhatsAppNumber}
                title={
                  !canAddWhatsAppNumber && whatsappLimit != null
                    ? whatsappNumberLimitMessage(whatsappLimit)
                    : undefined
                }
                onClick={() => {
                  if (!canAddWhatsAppNumber) {
                    toast.error(
                      whatsappLimit != null
                        ? whatsappNumberLimitMessage(whatsappLimit)
                        : 'WhatsApp number limit reached. Upgrade your plan.',
                    );
                    router.push('/billing');
                    return;
                  }
                  setSelectedConfigId(null);
                  setConfig(null);
                  setDisplayName('');
                  setPhoneNumberId('');
                  setWabaId('');
                  setAccessToken('');
                  setVerifyToken('');
                  setPin('');
                  setTokenEdited(false);
                  setIsDefault(configs.length === 0);
                  setConnectionStatus('unknown');
                  setStatusMessage('');
                  setRegistrationProbe(null);
                }}
              >
                {!canAddWhatsAppNumber ? <Lock className="size-3.5" /> : null}
                Add number
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {!entitlementsLoading &&
            !canAddWhatsAppNumber &&
            whatsappLimit != null ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <Lock className="size-4" />
                <AlertTitle>Number limit reached</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{whatsappNumberLimitMessage(whatsappLimit)}</span>
                  <Button
                    size="sm"
                    className="shrink-0"
                    render={<Link href="/billing" />}
                  >
                    Upgrade plan
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            {whatsappLimit != null &&
            whatsappRemaining != null &&
            canAddWhatsAppNumber ? (
              <p className="text-xs text-muted-foreground">
                {whatsappRemaining} number
                {whatsappRemaining === 1 ? '' : 's'} remaining on your plan.
              </p>
            ) : null}
            {configs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No numbers yet. Fill in the credentials below to add the first
                one.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {configs.map((row) => {
                  const active = row.id === (selectedConfigId || config?.id);
                  return (
                    <li
                      key={row.id}
                      className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                        active ? 'bg-muted/40' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => {
                          setSelectedConfigId(row.id);
                          setConfig(row);
                          setDisplayName(row.display_name || '');
                          setPhoneNumberId(row.phone_number_id || '');
                          setWabaId(row.waba_id || '');
                          setAccessToken(MASKED_TOKEN);
                          setVerifyToken('');
                          setPin('');
                          setTokenEdited(false);
                          setIsDefault(Boolean(row.is_default));
                          setRegistrationProbe(null);
                        }}
                      >
                        <p className="truncate text-sm font-medium">
                          {row.display_name || row.phone_number_id}
                          {Boolean(row.is_default) ? (
                            <span className="ml-2 text-xs font-normal text-teal-700">
                              Default
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.phone_number_id}
                          {row.waba_id ? ` · WABA ${row.waba_id}` : ''}
                        </p>
                      </button>
                      <div className="flex shrink-0 gap-2">
                        {!Boolean(row.is_default) && canEditTeam ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const res = await fetch('/api/whatsapp/numbers', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: row.id,
                                  is_default: true,
                                }),
                              });
                              if (!res.ok) {
                                toast.error('Failed to set default');
                                return;
                              }
                              toast.success('Default number updated');
                              if (accountId) await fetchConfig(accountId);
                            }}
                          >
                            Set default
                          </Button>
                        ) : null}
                        {canEditTeam && configs.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  'Remove this WhatsApp number from the account?',
                                )
                              ) {
                                return;
                              }
                              const res = await fetch(
                                `/api/whatsapp/config?id=${encodeURIComponent(row.id)}`,
                                { method: 'DELETE' },
                              );
                              if (!res.ok) {
                                toast.error('Failed to remove number');
                                return;
                              }
                              toast.success('Number removed');
                              if (accountId) await fetchConfig(accountId);
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* API Credentials */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">
              {selectedConfigId || config?.id
                ? 'Edit number credentials'
                : 'Add number credentials'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter Meta WhatsApp Business API credentials for this number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground/80">Display name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sales line"
                disabled={!canEditTeam}
                className="bg-muted border-border"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={!canEditTeam}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Use as account default (broadcasts &amp; unassigned members)
            </label>
            <div className="space-y-2">
              <Label className="text-foreground/80">Phone Number ID</Label>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                readOnly={!canEditTeam}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">WhatsApp Business Account ID</Label>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                readOnly={!canEditTeam}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">Permanent Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setTokenEdited(true);
                  }}
                  onFocus={() => {
                    if (accessToken === MASKED_TOKEN) {
                      setAccessToken('');
                      setTokenEdited(true);
                    }
                  }}
                  readOnly={!canEditTeam}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                />
                {canEditTeam && (
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                )}
              </div>
              {config && !tokenEdited && (
                <p className="text-xs text-muted-foreground">
                  Token is hidden for security. Re-enter it to update configuration.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">Webhook Verify Token</Label>
              <Input
                placeholder="Create a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                readOnly={!canEditTeam}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                A custom string you create. Must match the token you set in Meta webhook settings.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/80">
                Two-step verification PIN
                {!isRegistered && (
                  <span className="ml-1 text-red-400">*</span>
                )}
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit PIN from Meta WhatsApp Manager"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                readOnly={!canEditTeam}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Required the first time you connect a number, and any
                time you swap to a different number. Set it in{' '}
                <strong className="text-foreground/80">
                  Meta Business Manager → WhatsApp Accounts → Phone
                  Numbers → Two-step verification
                </strong>
                . Without this PIN, Meta saves your credentials but
                won&apos;t actually route inbound messages to VedMint Consultancy Services —
                the symptom that hits second numbers under a shared
                WABA. Leave blank to keep an existing registration
                untouched.
              </p>
            </div>
          </CardContent>
        </Card>

        {!webhookSignatureReady && config && (
          <Alert className="bg-red-950/30 border-red-700/50">
            <AlertTriangle className="size-4 text-red-400" />
            <AlertTitle className="text-red-200">
              Webhook events will be rejected
            </AlertTitle>
            <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
              Meta signs every webhook POST with your App Secret. Without it,
              VedMint Consultancy Services returns <strong className="text-red-300">401</strong> and
              Meta&apos;s &quot;Test&quot; button fails with the error you saw.
              Add your App Secret in{' '}
              <Link
                href="/settings?tab=app-secret"
                className="text-primary hover:underline"
              >
                Settings → App Secret
              </Link>
              , or set <code className="text-foreground/80">META_APP_SECRET</code>{' '}
              on your production server.
            </AlertDescription>
          </Alert>
        )}

        {/* Webhook URL */}
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground">Webhook Configuration</CardTitle>
            <CardDescription className="text-muted-foreground">
              Use this URL as your webhook callback in the Meta App Dashboard.
              Must be a public HTTPS URL — Meta cannot reach localhost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-foreground/80">Webhook Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-muted border-border text-foreground/80 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookUrl}
                  className="shrink-0 border-border text-foreground/80 hover:text-foreground hover:bg-muted"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {canEditTeam && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          )}
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !config}
            className="border-border text-foreground/80 hover:text-foreground hover:bg-muted"
          >
            {testing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Test API Connection
              </>
            )}
          </Button>
          {config && canEditTeam && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting}
              className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reset Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card className="bg-card border-border ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Setup Instructions</CardTitle>
            <CardDescription className="text-muted-foreground">
              Follow these steps to connect your WhatsApp Business API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-border">
                <AccordionTrigger className="text-foreground/80 hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    Create a Meta App
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to <span className="text-primary">developers.facebook.com</span></li>
                    <li>Click &quot;My Apps&quot; and then &quot;Create App&quot;</li>
                    <li>Select &quot;Business&quot; as the app type</li>
                    <li>Fill in app details and create</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-foreground/80 hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    Add WhatsApp Product
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>In your app dashboard, click &quot;Add Product&quot;</li>
                    <li>Find &quot;WhatsApp&quot; and click &quot;Set Up&quot;</li>
                    <li>Follow the setup wizard to link your business</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-foreground/80 hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    Get API Credentials
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; API Setup</li>
                    <li>Copy your <strong className="text-foreground">Phone Number ID</strong></li>
                    <li>Copy your <strong className="text-foreground">WhatsApp Business Account ID</strong></li>
                    <li>Generate a <strong className="text-foreground">Permanent Access Token</strong> from Business Settings &gt; System Users</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-foreground/80 hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                    Configure Webhooks
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Go to WhatsApp &gt; Configuration</li>
                    <li>Click &quot;Edit&quot; on the Webhook section</li>
                    <li>Paste the <strong className="text-foreground">Webhook Callback URL</strong> from above</li>
                    <li>Enter the same <strong className="text-foreground">Verify Token</strong> you set here</li>
                    <li>Subscribe to &quot;messages&quot; webhook field</li>
                    <li>
                      Set the webhook API version to{' '}
                      <strong className="text-foreground">v25.0</strong> in Meta
                      (must match VedMint Consultancy Services&apos;s Graph API version)
                    </li>
                    <li>
                      Save your{' '}
                      <Link
                        href="/settings?tab=app-secret"
                        className="text-primary hover:underline"
                      >
                        Meta App Secret
                      </Link>{' '}
                      in VedMint Consultancy Services — required for webhook POSTs to be accepted
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 pt-4 border-t border-border">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                Meta WhatsApp API Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
