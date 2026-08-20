import { NextResponse } from 'next/server';
import { getSessionUser, jsonError } from '@/lib/auth';
import { getDb } from '@/lib/env';
import { stkQuery } from '@/lib/mpesa';
import { getPaymentById, markPayment } from '@/lib/payments';

const STILL_WAITING = new Set([4999]);
const USER_ABANDONED = new Set([1032, 1037]);

export async function GET(request: Request) {
  if (!(await getDb())) return jsonError('Payments are unavailable until the site database is bound.', 503);
  const user = await getSessionUser();
  if (!user) return jsonError('Sign in to check payment status.', 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return jsonError('Missing payment id.');
  const payment = await getPaymentById(id);
  if (!payment || payment.user_id !== user.id) return jsonError('Payment not found.', 404);

  if (payment.status === 'pending' && payment.checkout_request_id) {
    try {
      const query = await stkQuery(request.url, payment.checkout_request_id);
      if (query.resultCode === 0) {
        await markPayment(payment, {
          status: 'success',
          resultCode: 0,
          resultDesc: query.resultDesc || 'Paid',
        });
      } else if (STILL_WAITING.has(query.resultCode) || /processing|in progress|wait/i.test(query.resultDesc)) {
        // Safaricom has not finished; callback remains source of truth.
      } else if (USER_ABANDONED.has(query.resultCode) || query.resultCode !== 0) {
        await markPayment(payment, {
          status: 'failed',
          resultCode: query.resultCode,
          resultDesc: query.resultDesc || 'Payment was not completed.',
        });
      }
    } catch {
      // Callback may still arrive.
    }
  }

  const latest = (await getPaymentById(id)) ?? payment;
  return NextResponse.json({
    ok: true,
    payment: {
      id: latest.id,
      planId: latest.plan_id,
      amountKes: latest.amount_kes,
      status: latest.status,
      resultDesc: latest.result_desc,
      mpesaReceipt: latest.mpesa_receipt,
    },
  });
}
