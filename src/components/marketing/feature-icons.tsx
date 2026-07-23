import {
  GitBranch,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Radio,
  Settings,
  Users,
  UsersRound,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

const FEATURE_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  inbox: MessageSquare,
  contacts: Users,
  pipelines: GitBranch,
  broadcasts: Radio,
  "email-marketing": Mail,
  automations: Zap,
  flows: Workflow,
  settings: Settings,
  team: UsersRound,
};

export function FeatureIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const Icon = FEATURE_ICONS[id] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
