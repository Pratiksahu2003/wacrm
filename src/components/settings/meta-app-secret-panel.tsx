'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MASKED_SECRET = '••••••••••••••••';

export function MetaAppSecretPanel() {
  const { user, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasWhatsAppConfig, setHasWhatsAppConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [appSecret, setAppSecret] = useState('');
  const [configured, setConfigured] = useState(false);
  const [edited, setEdited] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/config/app-secret', {
        method: 'GET',
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload.error || 'Failed to load App Secret status');
        return;
      }
      setHasWhatsAppConfig(Boolean(payload.has_config));
      const isConfigured = Boolean(payload.configured);
      setConfigured(isConfigured);
      setAppSecret(isConfigured ? MASKED_SECRET : '');
      setEdited(false);
    } catch (err) {
      console.error('App secret status load failed:', err);
      toast.error('Failed to load App Secret status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadStatus();
  }, [authLoading, profileLoading, user, loadStatus]);

  async function handleSave() {
    if (!hasWhatsAppConfig) {
      toast.error('Save your WhatsApp API credentials first');
      return;
    }
    if (!edited || appSecret === MASKED_SECRET || !appSecret.trim()) {
      toast.error('Enter your Meta App Secret to save');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/whatsapp/config/app-secret', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_app_secret: appSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save App Secret');
        return;
      }
      toast.success('Meta App Secret saved');
      setAppSecret(MASKED_SECRET);
      setEdited(false);
      setConfigured(true);
    } catch (err) {
      console.error('Save app secret error:', err);
      toast.error('Failed to save App Secret');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!configured) return;

    try {
      setClearing(true);
      const res = await fetch('/api/whatsapp/config/app-secret', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to clear App Secret');
        return;
      }
      toast.success('Meta App Secret removed');
      setAppSecret('');
      setEdited(false);
      setConfigured(false);
    } catch (err) {
      console.error('Clear app secret error:', err);
      toast.error('Failed to clear App Secret');
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Meta App Secret</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify inbound webhook signatures from Meta. Each account uses its
          own App Secret from the Meta Developer dashboard.
        </p>
      </div>

      <Card className="bg-card border-border ring-0 ring-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <CardTitle className="text-foreground">App Secret</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Meta for Developers → App Settings → Basic → App Secret
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert
            className={
              configured
                ? 'bg-emerald-950/30 border-emerald-700/50'
                : 'bg-amber-950/30 border-amber-700/50'
            }
          >
            <div className="flex items-center gap-2">
              {configured ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-400" />
              )}
              <AlertTitle
                className={
                  'mb-0 text-sm ' +
                  (configured ? 'text-emerald-200' : 'text-amber-200')
                }
              >
                {configured ? 'App Secret saved' : 'App Secret not configured'}
              </AlertTitle>
            </div>
            <AlertDescription className="text-muted-foreground text-xs mt-1">
              {configured
                ? 'Inbound webhooks are verified with your stored secret.'
                : hasWhatsAppConfig
                  ? 'Without this, webhook POSTs are rejected unless META_APP_SECRET is set on the server.'
                  : (
                      <>
                        Save your{' '}
                        <Link
                          href="/settings?tab=whatsapp"
                          className="text-primary hover:underline"
                        >
                          WhatsApp API credentials
                        </Link>{' '}
                        first, then add your App Secret here.
                      </>
                    )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-foreground/80">App Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                placeholder="Paste your Meta App Secret"
                value={appSecret}
                disabled={!hasWhatsAppConfig}
                onChange={(e) => {
                  setAppSecret(e.target.value);
                  setEdited(true);
                }}
                onFocus={() => {
                  if (appSecret === MASKED_SECRET) {
                    setAppSecret('');
                    setEdited(true);
                  }
                }}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!hasWhatsAppConfig}
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {showSecret ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasWhatsAppConfig}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save App Secret'
              )}
            </Button>
            {configured && (
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={clearing}
                className="border-border text-foreground/80 hover:text-foreground hover:bg-muted"
              >
                {clearing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Clear App Secret'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
