"use client";

import { CompliancePanel } from "@/components/settings/compliance-panel";

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opt-out keywords, broadcast exclusion, and the DND audit trail for
          your WhatsApp messaging.
        </p>
      </div>
      <CompliancePanel />
    </div>
  );
}
