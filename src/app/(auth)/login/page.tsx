"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
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
        router.push(`/join/${encodeURIComponent(inviteToken)}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center bg-slate-950 px-4 overflow-hidden py-12">
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] bg-[radial-gradient(circle,rgba(168,85,247,0.05)_0%,transparent_60%)] rounded-full blur-[120px] pointer-events-none" />

      <Card className="relative w-full max-w-md border-slate-800/80 bg-slate-900/50 backdrop-blur-xl shadow-2xl transition-all duration-300">
        <CardHeader className="items-center text-center pb-4">
          <Logo variant="auth" className="mb-6 mx-auto" />
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {inviteToken ? "Sign in to accept" : "Welcome back"}
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1">
            {inviteToken
              ? "Sign in and we'll take you to the invitation."
              : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 border-0"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-600 select-none">
        © 2026 Vedmint Consultancy Services. All Rights Reserved.
      </p>
    </div>
  );
}
