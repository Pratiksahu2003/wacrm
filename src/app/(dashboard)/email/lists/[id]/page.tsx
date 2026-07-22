"use client";

import { use } from "react";

import { EmailListDetail } from "@/components/email/email-list-detail";

export default function EmailListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">List</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscribers, CSV import, and public subscribe form.
        </p>
      </div>
      <EmailListDetail listId={id} />
    </div>
  );
}
