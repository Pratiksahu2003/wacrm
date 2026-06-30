"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { COPYRIGHT_NOTICE } from "@/lib/brand";
import { CheckCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
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
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
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
              Password reset successful
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Your password has been successfully updated. You can now access your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link href="/dashboard">
              <Button
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all border-0 h-11"
              >
                Go to Dashboard
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
            Choose a strong new password for your account
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
              <Label htmlFor="password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-600 focus-visible:border-violet-500 focus-visible:ring-violet-500/20 h-10 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your new password"
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
              {loading ? "Updating password..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-center text-xs text-slate-600 select-none">
        {COPYRIGHT_NOTICE}
      </p>
    </div>
  );
}
