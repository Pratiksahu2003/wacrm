import { ShieldCheck } from "lucide-react";
import { OFFICIAL_APP_URL, PRODUCT_NAME } from "@/lib/brand";

export function AuthDomainNotice() {
  return (
    <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-slate-500 lg:justify-start lg:text-left">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-teal-600" aria-hidden />
      <span>
        Official {PRODUCT_NAME} — verify the address bar shows{" "}
        <span className="font-mono text-slate-600">
          {OFFICIAL_APP_URL.replace("https://", "")}
        </span>{" "}
        before signing in.
      </span>
    </p>
  );
}
