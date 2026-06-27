"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCan } from "@/hooks/use-can";
import type { MemberWhatsAppConfig } from "@/types";

const MASKED = "••••••••••••••••";

export function MemberWhatsAppConfig() {
  const canEdit = useCan("send-messages");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usePersonal, setUsePersonal] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenEdited, setTokenEdited] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/member-config");
      const payload = (await res.json()) as {
        config: MemberWhatsAppConfig | null;
        has_token?: boolean;
      };
      const c = payload.config;
      setUsePersonal(c?.use_personal ?? false);
      setPhoneNumberId(c?.phone_number_id ?? "");
      setWabaId(c?.waba_id ?? "");
      setHasToken(Boolean(payload.has_token));
      setAccessToken("");
      setTokenEdited(false);
    } catch {
      toast.error("Could not load personal WhatsApp settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/member-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_personal: usePersonal,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          ...(tokenEdited ? { access_token: accessToken } : {}),
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(payload.error || "Save failed");
        return;
      }
      toast.success("Personal WhatsApp settings saved");
      void load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/member-config", { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        toast.error(payload.error || "Could not clear");
        return;
      }
      toast.success("Personal config removed — using team WhatsApp");
      setUsePersonal(false);
      setPhoneNumberId("");
      setWabaId("");
      setAccessToken("");
      setHasToken(false);
      setTokenEdited(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <UserCircle className="size-5 text-primary" />
          My WhatsApp (optional)
        </CardTitle>
        <CardDescription className="text-slate-400">
          By default you send from the team WhatsApp number above. Save your
          own Meta credentials here if you want to send from your personal
          number instead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-white">Use my WhatsApp</p>
            <p className="text-xs text-slate-500">
              When off, outbound messages use the team configuration.
            </p>
          </div>
          <Switch
            checked={usePersonal}
            onCheckedChange={setUsePersonal}
            disabled={!canEdit}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-slate-300">Phone number ID</Label>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              disabled={!canEdit}
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">WABA ID</Label>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              disabled={!canEdit}
              className="border-slate-700 bg-slate-800 text-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Access token</Label>
          <Input
            type="password"
            placeholder={hasToken ? MASKED : "Paste Meta access token"}
            value={accessToken}
            onChange={(e) => {
              setAccessToken(e.target.value);
              setTokenEdited(true);
            }}
            disabled={!canEdit}
            className="border-slate-700 bg-slate-800 text-white"
          />
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save personal config
            </Button>
            {(hasToken || phoneNumberId) && (
              <Button
                variant="outline"
                onClick={() => void handleClear()}
                disabled={saving}
                className="border-slate-700 text-slate-300"
              >
                Remove personal config
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
