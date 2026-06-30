import { COMPANY_NAME, OFFICIAL_APP_URL, PRODUCT_NAME } from "@/lib/brand";
import { ShieldCheck } from "lucide-react";

export function AuthTrustNotice() {
  return (
    <div className="mb-6 flex max-w-md items-start gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-left">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
      <p className="text-xs leading-relaxed text-slate-300">
        <span className="font-medium text-white">{COMPANY_NAME}</span> — official{" "}
        {PRODUCT_NAME} sign-in. Verify the address bar shows{" "}
        <span className="font-mono text-emerald-300">{OFFICIAL_APP_URL.replace("https://", "")}</span>{" "}
        before entering your credentials.
      </p>
    </div>
  );
}
