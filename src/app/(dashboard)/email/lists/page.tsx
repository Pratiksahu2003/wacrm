"use client";

import { EmailListsPanel } from "@/components/email/email-lists-panel";

export default function EmailListsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage subscribers separately from CRM contacts.
        </p>
      </div>
      <EmailListsPanel />
    </div>
  );
}
