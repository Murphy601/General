import { NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/env';
import { getPlan } from '@/lib/membership';
import { stkPush } from '@/lib/mpesa';
import { normalizeKenyaPhone } from '@/lib/phone';
import { createPayment, saveStkIds } from '@/lib/payments';

export async function POST(request: Request) {
  if (!(await getDb())) return jsonError('Payments are unavailable until the site database is bound.', 503);
  let user;
  try {
    user = await requireUser();
  } catch {
    return jsonError('Sign in to pay with M-Pesa.', 401);
  }

  let body: { planId?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Send JSON with planId and phone.');
  }

  const plan = getPlan(String(body.planId || ''));
  if (!plan || plan.priceKes <= 0) return jsonError('Choose a paid plan.');
  const phone = normalizeKenyaPhone(String(body.phone || user.phone || ''));
  if (!phone) return jsonError('Enter the M-Pesa number that will receive the PIN prompt (07XX XXX XXX).');

  try {
    const payment = await createPayment({
      userId: user.id,
      planId: plan.id,
      amountKes: plan.priceKes,
      phone,
    });
    const stk = await stkPush({
      requestUrl: request.url,
      amountKes: plan.priceKes,
      phone,
      accountRef: 'HTCBC',
      description: plan.name,
    });
    await saveStkIds(payment.id, stk.merchantRequestId, stk.checkoutRequestId);
    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      checkoutRequestId: stk.checkoutRequestId,
      message: stk.customerMessage,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not start M-Pesa payment.', 502);
  }
}
