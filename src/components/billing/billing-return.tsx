"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isSubscriptionActive } from "@/lib/vedmint-subscription/plan-utils";

type Phase = "polling" | "active" | "timeout" | "error";

/** Legacy return path — prefer `/billing?checkout=success`. */
export function BillingReturn() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("polling");
  const [message, setMessage] = useState("Confirming your payment…");
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      attempts.current += 1;
      try {
        const res = await fetch("/api/billing/status", {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          data?: {
            active?: boolean;
            status?: string;
            expires_at?: string | null;
          };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error || "Status check failed");
        }

        const active = isSubscriptionActive(
          json.data?.status,
          json.data?.active,
          json.data?.expires_at,
        );
        if (active) {
          if (!cancelled) {
            setPhase("active");
            setMessage("Subscription is active. Taking you to billing…");
            timer = setTimeout(
              () => router.replace("/billing?checkout=success"),
              800,
            );
          }
          return;
        }

        if (attempts.current >= 20) {
          if (!cancelled) {
            // Still send them to billing so they can refresh there.
            setPhase("timeout");
            setMessage("Taking you to billing to finish confirming…");
            timer = setTimeout(
              () => router.replace("/billing?checkout=success"),
              1000,
            );
          }
          return;
        }

        timer = setTimeout(() => {
          void poll();
        }, 2000);
      } catch (err) {
        if (!cancelled) {
          setPhase("error");
          setMessage(
            err instanceof Error ? err.message : "Could not confirm payment",
          );
        }
      }
    };

    // Prefer landing on billing immediately; keep a short confirm pass here.
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {phase === "polling" ? (
          <Loader2 className="size-7 animate-spin" />
        ) : phase === "active" ? (
          <CheckCircle2 className="size-7 text-teal-600" />
        ) : (
          <XCircle className="size-7 text-amber-600" />
        )}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {phase === "active"
          ? "You’re all set"
          : phase === "polling"
            ? "Finalizing checkout"
            : "Almost there"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {phase === "error" ? (
        <div className="mt-6 flex gap-2">
          <Button render={<Link href="/billing?checkout=success" />}>
            Back to billing
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
