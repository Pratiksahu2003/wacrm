// ============================================================
// /join/[token] layout — public auth funnel (split layout).
// ============================================================

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicAuthShell } from '@/components/auth/public-auth-shell';
import { AuthFormHeader } from '@/components/auth/auth-form-header';
import { COMPANY_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Join Team — ${COMPANY_NAME}`,
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <PublicAuthShell>
      <AuthFormHeader
        badge="Team invitation"
        title="Accept your invite"
        description="You've been invited to join a team on VedMint CRM. Sign in or create an account to continue."
      />
      {children}
    </PublicAuthShell>
  );
}
