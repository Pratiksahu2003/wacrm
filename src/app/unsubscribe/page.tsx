"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COMPANY_NAME } from "@/lib/brand";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing unsubscribe token.");
    }
  }, [token]);

  const confirm = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/public/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unsubscribe failed");
      setStatus("done");
      setMessage(
        `Unsubscribed${json.data?.email ? ` (${json.data.email})` : ""}${
          json.data?.list_name ? ` from ${json.data.list_name}` : ""
        }.`,
      );
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unsubscribe failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {COMPANY_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Unsubscribe
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Confirm to stop receiving marketing emails from this list.
        </p>

        {status === "done" || status === "error" ? (
          <p
            className={`mt-6 rounded-lg px-4 py-3 text-sm ${
              status === "done"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </p>
        ) : (
          <Button
            className="mt-6 w-full"
            onClick={() => void confirm()}
            disabled={!token || status === "loading"}
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Confirm unsubscribe
          </Button>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  );
}
