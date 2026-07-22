"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { BillingPage } from "@/components/billing/billing-page";

export default function BillingRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <BillingPage />
    </Suspense>
  );
}
