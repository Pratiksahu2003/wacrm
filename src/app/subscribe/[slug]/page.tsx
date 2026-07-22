"use client";

import { use, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMPANY_NAME } from "@/lib/brand";

export default function PublicSubscribePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, name: name || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Subscribe failed");
      setDone(json.data?.message || "You are subscribed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribe failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {COMPANY_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Subscribe
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Join this email list. You can unsubscribe anytime.
        </p>

        {done ? (
          <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {done}
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Subscribe
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
