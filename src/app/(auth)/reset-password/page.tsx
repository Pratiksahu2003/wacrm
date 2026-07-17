"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthDomainNotice } from "@/components/auth/auth-domain-notice";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthFormHeader } from "@/components/auth/auth-form-header";
import { AuthIconField } from "@/components/auth/auth-icon-field";
import { AuthStatusCard } from "@/components/auth/auth-status-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PublicAuthShell } from "@/components/auth/public-auth-shell";
import { authErrorBox } from "@/components/public/public-theme";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setLoading(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );

  if (success) {
    return (
      <PublicAuthShell>
        <AuthStatusCard
          icon={CheckCircle}
          title="Password updated"
          description="Your password has been reset successfully. You can now sign in and access your dashboard."
        >
          <Link href="/dashboard">
            <Button className="h-11 w-full rounded-xl border-0 bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-500 hover:to-teal-400">
              Go to dashboard
            </Button>
          </Link>
        </AuthStatusCard>
        <AuthDomainNotice />
      </PublicAuthShell>
    );
  }

  return (
    <PublicAuthShell>
      <AuthFormHeader
        badge="New password"
        title="Choose a new password"
        description="Pick a strong password you haven't used elsewhere on this account."
      />

      <AuthFormCard>
        <form onSubmit={handleReset} className="flex flex-col gap-5">
          {error ? <div className={authErrorBox}>{error}</div> : null}

          <AuthIconField
            id="password"
            label="New password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            icon={Lock}
            autoComplete="new-password"
            suffix={passwordToggle}
          />

          <AuthIconField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            icon={Lock}
            autoComplete="new-password"
          />

          <AuthSubmitButton loading={loading} loadingText="Updating…">
            Update password
          </AuthSubmitButton>
        </form>
      </AuthFormCard>

      <AuthDomainNotice />
    </PublicAuthShell>
  );
}
