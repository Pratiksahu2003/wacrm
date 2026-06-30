"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
import { COMPANY_NAME, COPYRIGHT_NOTICE } from "@/lib/brand";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → redirect
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            invite_token: inviteToken
          }
        }
      });

      const { error } = result;
      const needsVerification = Boolean(
        (result.data as { needsVerification?: boolean } | null)?.needsVerification,
      );

      if (error) {
        if (needsVerification) {
          router.push(
            `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`,
          );
          return;
        }

        setError(error.message);
        setLoading(false);
        return;
      }

      if (needsVerification) {
        router.push(
          `/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`,
        );
        return;
      }

      // Successful signup redirects to dashboard/invite accept page immediately
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
            {inviteToken ? "Join your team" : "Create account"}
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1">
            {inviteToken
              ? "Accept your invitation and get started."
              : `Get started with ${COMPANY_NAME}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors"
              />
            </div>

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
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 border-0"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
              className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-600 select-none">
        {COPYRIGHT_NOTICE}
      </p>
    </div>
  );
}
