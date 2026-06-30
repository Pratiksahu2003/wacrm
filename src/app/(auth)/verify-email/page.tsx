"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CheckCircle, Mail, ArrowLeft } from "lucide-react";

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
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center bg-slate-950 px-4 overflow-hidden py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(168,85,247,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />

      <Card className="relative w-full max-w-md border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl transition-all duration-300">
        <CardHeader className="items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
            {resent ? (
              <CheckCircle className="h-6 w-6 text-violet-400" />
            ) : (
              <Mail className="h-6 w-6 text-violet-400" />
            )}
          </div>
          <Logo variant="auth" className="mb-4 mx-auto" />
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {resent ? "Verification email sent" : "Verify your email"}
          </CardTitle>
          <CardDescription className="text-slate-400 mt-2">
            {resent ? (
              <>We sent another verification link{email ? <> to <span className="text-white font-medium">{email}</span></> : ""}. Check your inbox and spam folder.</>
            ) : (
              <>
                We sent a verification link
                {email ? (
                  <>
                    {" "}
                    to <span className="text-white font-medium">{email}</span>
                  </>
                ) : (
                  " to your email"
                )}
                . Click the link to activate your account and access the dashboard.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button
            type="button"
            disabled={loading || !email}
            onClick={handleResend}
            className="h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all border-0"
          >
            {loading ? "Sending..." : "Resend verification email"}
          </Button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-600 select-none">
        © 2026 Vedmint Consultancy Services. All Rights Reserved.
      </p>
    </div>
  );
}
