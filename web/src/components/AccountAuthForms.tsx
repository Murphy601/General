'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { PublicUser } from '@/lib/membership';

type Mode = 'login' | 'signup';

export function AccountAuthForms({ defaultMode = 'login' }: { defaultMode?: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/account';
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get('email') || ''),
      password: String(form.get('password') || ''),
    };
    if (mode === 'signup') {
      payload.name = String(form.get('name') || '');
      payload.phone = String(form.get('phone') || '');
    }
    try {
      const res = await fetch(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; user?: PublicUser };
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not continue.');
        return;
      }
      router.push(next.startsWith('/') ? next : '/account');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white shadow text-kenya-green' : 'text-gray-600'}`}
          onClick={() => setMode('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-white shadow text-kenya-green' : 'text-gray-600'}`}
          onClick={() => setMode('signup')}
        >
          Create account
        </button>
      </div>
      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6 space-y-4">
        {mode === 'signup' ? (
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="Parent or learner name"
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border px-3 py-2"
            placeholder="you@example.com"
          />
        </label>
        {mode === 'signup' ? (
          <label className="block text-sm">
            <span className="font-medium">M-Pesa phone (optional)</span>
            <input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="07XX XXX XXX" />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            className="mt-1 w-full rounded-xl border px-3 py-2"
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-kenya-green py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
