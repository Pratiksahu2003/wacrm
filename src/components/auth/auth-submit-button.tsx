import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSubmitButton({
  children,
  loading,
  loadingText,
  className,
  type = "submit",
  ...props
}: React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <Button
      type={type}
      disabled={loading || props.disabled}
      className={cn(
        "mt-2 h-12 w-full rounded-xl border-0 bg-gradient-to-r from-teal-600 to-teal-500 text-base font-semibold text-white shadow-[0_8px_24px_rgba(13,148,136,0.35)] transition-all hover:from-teal-500 hover:to-teal-400 active:scale-[0.99] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingText ?? "Please wait…"}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}
