"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AuthDomainNotice } from "@/components/auth/auth-domain-notice";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthFormHeader } from "@/components/auth/auth-form-header";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { PublicAuthShell } from "@/components/auth/public-auth-shell";
import { authErrorBox, authLink } from "@/components/public/public-theme";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const errorParam = searchParams.get("error");

  const [email] = useState(emailParam);
  const [error, setError] = useState<string | null>(
    errorParam === "invalid_or_expired"
      ? "This verification link is invalid or has expired. Request a new one below."
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      setError("Missing email address. Go back to sign up or sign in.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyVerified?: boolean;
      };

      if (!res.ok) {
        setError(payload.error || "Could not send verification email");
        setLoading(false);
        return;
      }

      if (payload.alreadyVerified) {
        setError(null);
        window.location.href = "/login";
        return;
      }

      setResent(true);
      setLoading(false);
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
        badge="Email verification"
        title={resent ? "Verification email sent" : "Verify your email"}
        description={
          resent ? (
            <>
              We sent another link
              {email ? (
                <>
                  {" "}
                  to <span className="font-medium text-slate-900">{email}</span>
                </>
              ) : null}
              . Check your inbox and spam folder.
            </>
          ) : (
            <>
              We sent a verification link
              {email ? (
                <>
                  {" "}
                  to <span className="font-medium text-slate-900">{email}</span>
                </>
              ) : (
                " to your email"
              )}
              . Click the link to activate your account.
            </>
          )
        }
      />

      <AuthFormCard>
        <div className="mb-5 flex justify-center lg:justify-start">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-100">
            {resent ? (
              <CheckCircle className="size-7 text-teal-600" aria-hidden />
            ) : (
              <Mail className="size-7 text-teal-600" aria-hidden />
            )}
          </div>
        </div>

        {error ? <div className={`mb-4 ${authErrorBox}`}>{error}</div> : null}

        <AuthSubmitButton
          type="button"
          loading={loading}
          loadingText="Sending…"
          disabled={!email}
          onClick={handleResend}
        >
          Resend verification email
        </AuthSubmitButton>
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
