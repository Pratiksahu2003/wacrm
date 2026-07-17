"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthDomainNotice } from "@/components/auth/auth-domain-notice";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthFormHeader } from "@/components/auth/auth-form-header";
import { AuthIconField } from "@/components/auth/auth-icon-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PublicAuthShell } from "@/components/auth/public-auth-shell";
import { authErrorBox, authLink } from "@/components/public/public-theme";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: string }).code)
            : "";
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message?: string }).message)
            : "Sign in failed";

        if (code === "EMAIL_NOT_VERIFIED") {
          router.push(
            `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`,
          );
          return;
        }

        setError(message);
        setLoading(false);
        return;
      }

      if (inviteToken) {
        window.location.assign(`/join/${encodeURIComponent(inviteToken)}`);
      } else {
        window.location.assign("/dashboard");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <PublicAuthShell>
      <AuthFormHeader
        badge="Secure sign in"
        title={inviteToken ? "Sign in to accept" : "Welcome back"}
        description={
          inviteToken
            ? "Sign in to your account and we'll take you to the team invitation."
            : "Sign in to manage WhatsApp conversations, contacts, and your team."
        }
      />

      <AuthFormCard>
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <Link href="/forgot-password" className={`text-xs ${authLink}`}>
                Forgot password?
              </Link>
            </div>
            <AuthIconField
              id="password"
              label=""
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              icon={Lock}
              autoComplete="current-password"
            />
          </div>

          <AuthSubmitButton loading={loading} loadingText="Signing in…">
            Sign in
          </AuthSubmitButton>
        </form>
      </AuthFormCard>

      <p className="mt-6 text-center text-sm text-slate-600 lg:text-left">
        Don&apos;t have an account?{" "}
        <Link
          href={
            inviteToken
              ? `/signup?invite=${encodeURIComponent(inviteToken)}`
              : "/signup"
          }
          className={authLink}
        >
          Create account
        </Link>
      </p>

      <AuthDomainNotice />
    </PublicAuthShell>
  );
}
