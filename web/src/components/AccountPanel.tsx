'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicUser } from '@/lib/membership';
import { PLANS } from '@/lib/types';

export function AccountPanel({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const plan = PLANS.find((p) => p.id === user.plan) ?? PLANS[0];
  const expiry = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  async function logout() {
    setError('');
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) {
      setError('Could not sign out.');
      return;
    }
    router.push('/account');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-bold">Your account</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">M-Pesa phone</dt>
          <dd className="font-medium">{user.phone || 'Not set'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Plan</dt>
          <dd className="font-medium">
            {plan.name}
            {user.planActive && expiry ? <span className="text-gray-500"> · until {expiry}</span> : null}
          </dd>
        </div>
      </dl>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/pricing" className="rounded-xl bg-kenya-green px-4 py-2 text-sm font-semibold text-white">
          {user.planActive ? 'Change plan' : 'Pay with M-Pesa'}
        </a>
        <button type="button" onClick={logout} className="rounded-xl border px-4 py-2 text-sm font-semibold">
          Sign out
        </button>
      </div>
    </div>
  );
}
