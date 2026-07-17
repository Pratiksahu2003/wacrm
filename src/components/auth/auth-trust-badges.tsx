import { CheckCircle2 } from "lucide-react";

const DEFAULT_BADGES = [
  "Free to start",
  "No credit card",
  "Setup in minutes",
] as const;

export function AuthTrustBadges({
  items = DEFAULT_BADGES,
}: {
  items?: readonly string[];
}) {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600"
        >
          <CheckCircle2 className="size-3.5 shrink-0 text-teal-600" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}
