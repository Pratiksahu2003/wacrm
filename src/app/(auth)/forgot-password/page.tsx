"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { AuthDomainNotice } from "@/components/auth/auth-domain-notice";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthFormHeader } from "@/components/auth/auth-form-header";
import { AuthIconField } from "@/components/auth/auth-icon-field";
import { AuthStatusCard } from "@/components/auth/auth-status-card";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PublicAuthShell } from "@/components/auth/public-auth-shell";
import { authErrorBox, authLink } from "@/components/public/public-theme";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: unknown };

      if (!res.ok) {
        const errMsg =
          typeof payload.error === "object" && payload.error
            ? String((payload.error as { message?: string }).message)
            : String(payload.error || "Could not send reset email");
        setError(errMsg);
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

  if (success) {
    return (
      <PublicAuthShell>
        <AuthStatusCard
          icon={CheckCircle}
          title="Check your email"
          description={
            <>
              We&apos;ve sent a password reset link to{" "}
              <span className="font-medium text-slate-900">{email}</span>. Please
              check your inbox and spam folder.
            </>
          }
        >
          <Link href="/login">
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Back to sign in
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
        badge="Account recovery"
        title="Reset your password"
        description="Enter the email on your account and we'll send you a secure reset link."
      />

      <AuthFormCard>
        <form onSubmit={handleReset} className="flex flex-col gap-5">
          {error ? <div className={authErrorBox}>{error}</div> : null}

          <AuthIconField
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            icon={Mail}
            autoComplete="email"
          />

          <AuthSubmitButton loading={loading} loadingText="Sending…">
            Send reset link
          </AuthSubmitButton>
        </form>
      </AuthFormCard>

      <Link
        href="/login"
        className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-slate-600 transition-colors hover:text-teal-700 lg:justify-start"
      >
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>

      <AuthDomainNotice />
    </PublicAuthShell>
  );
}
