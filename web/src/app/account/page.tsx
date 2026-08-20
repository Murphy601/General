import { Suspense } from 'react';
import { PlatformLayout } from '@/components/PlatformLayout';
import { AccountAuthForms } from '@/components/AccountAuthForms';
import { AccountPanel } from '@/components/AccountPanel';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/env';

export default async function AccountPage() {
  const db = await getDb();
  const user = await getCurrentUser();

  return (
    <PlatformLayout active="/account">
      {!db ? (
        <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="mt-2 text-gray-600">
            Sign-in needs the Cloudflare D1 database. On the live Worker this is already bound. Locally run the site
            through Wrangler / OpenNext preview after applying D1 migrations.
          </p>
        </div>
      ) : user ? (
        <AccountPanel user={user} />
      ) : (
        <>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Sign in to HighTech CBC Learners</h1>
            <p className="text-gray-600 mt-2">Create an account, then pay with M-Pesa from Pricing.</p>
          </div>
          <Suspense>
            <AccountAuthForms />
          </Suspense>
        </>
      )}
    </PlatformLayout>
  );
}
