"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { COPYRIGHT_NOTICE } from "@/lib/brand";
import { CheckCircle, ArrowLeft } from "lucide-react";

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

      const payload = (await res.json().catch(() => ({}))) as { error?: any };

      if (!res.ok) {
        const errMsg = typeof payload.error === 'object' && payload.error ? payload.error.message : (payload.error || "Could not send reset email");
        setError(errMsg);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative flex flex-col min-h-screen items-center justify-center bg-slate-950 px-4 overflow-hidden py-12">
        {/* Ambient background glows */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(168,85,247,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />

        <Card className="relative w-full max-w-md border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl transition-all duration-300">
          <CardHeader className="items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
              <CheckCircle className="h-6 w-6 text-violet-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              Check your email
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              We&apos;ve sent a password reset link to{" "}
              <span className="text-white font-medium">{email}</span>. Please check your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
              >
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-600 select-none">
          {COPYRIGHT_NOTICE}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center bg-slate-950 px-4 overflow-hidden py-12">
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(168,85,247,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />

      <Card className="relative w-full max-w-md border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl transition-all duration-300">
        <CardHeader className="items-center text-center pb-4">
          <Logo variant="auth" className="mb-6 mx-auto" />
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Reset password</CardTitle>
          <CardDescription className="text-slate-400 mt-1">
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 border-0"
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-600 select-none">
        {COPYRIGHT_NOTICE}
      </p>
    </div>
  );
}
