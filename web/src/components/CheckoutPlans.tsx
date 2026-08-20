'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PublicUser } from '@/lib/membership';
import { PLANS, type MembershipPlan } from '@/lib/types';

export function CheckoutPlans({ user }: { user: PublicUser | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(user?.phone || '');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  async function pay(plan: MembershipPlan) {
    setError('');
    setMessage('');
    if (!user) {
      router.push('/account?next=/pricing');
      return;
    }
    if (plan.priceKes <= 0) return;
    setBusyPlan(plan.id);
    try {
      const res = await fetch('/api/mpesa/stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, phone }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; paymentId?: string; message?: string };
      if (!res.ok || !data.ok || !data.paymentId) {
        setError(data.error || 'Could not start M-Pesa payment.');
        return;
      }
      setMessage(data.message || 'Enter your M-Pesa PIN on your phone.');
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`/api/mpesa/status?id=${encodeURIComponent(data.paymentId)}`);
        const statusData = (await statusRes.json()) as {
          ok?: boolean;
          payment?: { status?: string; resultDesc?: string; mpesaReceipt?: string | null };
          error?: string;
        };
        const status = statusData.payment?.status;
        if (status === 'success') {
          setMessage(
            `Payment received${statusData.payment?.mpesaReceipt ? ` (${statusData.payment.mpesaReceipt})` : ''}. Your ${plan.name} plan is active.`,
          );
          router.refresh();
          return;
        }
        if (status === 'failed') {
          setError(statusData.payment?.resultDesc || 'Payment was not completed.');
          return;
        }
      }
      setError('Still waiting for M-Pesa. Open Account in a minute — we activate the plan when Safaricom confirms.');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div>
      {user ? (
        <label className="mx-auto mb-8 flex max-w-md flex-col text-sm">
          <span className="font-medium">M-Pesa number for the PIN prompt</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 rounded-xl border px-3 py-2"
            placeholder="07XX XXX XXX"
          />
        </label>
      ) : (
        <p className="mb-8 text-center text-sm text-gray-600">
          <Link href="/account?next=/pricing" className="font-semibold text-kenya-green">
            Sign in or create an account
          </Link>{' '}
          to pay with M-Pesa.
        </p>
      )}
      {message ? <p className="mb-4 text-center text-sm text-kenya-green">{message}</p> : null}
      {error ? <p className="mb-4 text-center text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = user?.planActive && user.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 ${plan.id === 'monthly' ? 'border-kenya-green ring-2 ring-kenya-green/20' : 'border-gray-200 bg-white'}`}
            >
              <h2 className="font-bold text-lg">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-kenya-black">
                {plan.priceKes === 0 ? 'Free' : `KSh ${plan.priceKes}`}
                {plan.period === 'month' && <span className="text-sm font-normal text-gray-500">/mo</span>}
                {plan.period === 'term' && <span className="text-sm font-normal text-gray-500">/term</span>}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {plan.unlocks.map((u) => (
                  <li key={u}>✓ {u.replace(/-/g, ' ')}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled={Boolean(busyPlan) || plan.priceKes === 0}
                onClick={() => pay(plan)}
                className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 ${
                  plan.id === 'monthly' ? 'bg-kenya-green text-white' : 'border border-gray-300 text-gray-700'
                }`}
              >
                {plan.priceKes === 0
                  ? current
                    ? 'Current plan'
                    : 'Included'
                  : busyPlan === plan.id
                    ? 'Waiting for PIN…'
                    : user
                      ? 'Pay with M-Pesa'
                      : 'Sign in to pay'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
