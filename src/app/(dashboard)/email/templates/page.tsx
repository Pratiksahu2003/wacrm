"use client";

import { EmailTemplatesPanel } from "@/components/email/email-templates-panel";

export default function EmailTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable HTML with merge tags for personalized sends.
        </p>
      </div>
      <EmailTemplatesPanel />
    </div>
  );
}
