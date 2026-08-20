import { getDb } from './env';
import { nextExpiry, shouldReplacePlan } from './membership';

type UserPlanRow = {
  id: string;
  plan: string;
  plan_expires_at: number | null;
};

export type PaymentRow = {
  id: string;
  user_id: string;
  plan_id: string;
  amount_kes: number;
  phone: string;
  merchant_request_id: string | null;
  checkout_request_id: string | null;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  result_code: number | null;
  result_desc: string | null;
  created_at: number;
  updated_at: number;
};

export async function createPayment(input: {
  userId: string;
  planId: string;
  amountKes: number;
  phone: string;
}): Promise<PaymentRow> {
  const db = await getDb();
  if (!db) throw new Error('Payments are unavailable (database not bound).');
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO payments (id, user_id, plan_id, amount_kes, phone, merchant_request_id, checkout_request_id, status, mpesa_receipt, result_code, result_desc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, 'pending', NULL, NULL, NULL, ?, ?)`,
    )
    .bind(id, input.userId, input.planId, input.amountKes, input.phone, now, now)
    .run();
  const row = await db.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<PaymentRow>();
  if (!row) throw new Error('Could not create payment.');
  return row;
}

export async function saveStkIds(paymentId: string, merchantRequestId: string, checkoutRequestId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .prepare(
      'UPDATE payments SET merchant_request_id = ?, checkout_request_id = ?, updated_at = ? WHERE id = ?',
    )
    .bind(merchantRequestId, checkoutRequestId, Date.now(), paymentId)
    .run();
}

export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  const db = await getDb();
  if (!db) return null;
  return db.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<PaymentRow>();
}

export async function getPaymentByCheckout(checkoutRequestId: string): Promise<PaymentRow | null> {
  const db = await getDb();
  if (!db) return null;
  return db
    .prepare('SELECT * FROM payments WHERE checkout_request_id = ?')
    .bind(checkoutRequestId)
    .first<PaymentRow>();
}

export async function markPayment(
  payment: PaymentRow,
  input: { status: 'success' | 'failed'; resultCode: number; resultDesc: string; receipt?: string },
) {
  const db = await getDb();
  if (!db) return payment;
  if (payment.status === 'success') return payment;
  const now = Date.now();
  await db
    .prepare(
      'UPDATE payments SET status = ?, result_code = ?, result_desc = ?, mpesa_receipt = ?, updated_at = ? WHERE id = ?',
    )
    .bind(input.status, input.resultCode, input.resultDesc, input.receipt ?? payment.mpesa_receipt, now, payment.id)
    .run();

  if (input.status === 'success') {
    const user = await db
      .prepare('SELECT id, plan, plan_expires_at FROM users WHERE id = ?')
      .bind(payment.user_id)
      .first<UserPlanRow>();
    if (user && shouldReplacePlan(user.plan, user.plan_expires_at, payment.plan_id)) {
      const expires = nextExpiry(payment.plan_id, user.plan_expires_at, now);
      await db
        .prepare('UPDATE users SET plan = ?, plan_expires_at = ?, phone = COALESCE(phone, ?) WHERE id = ?')
        .bind(payment.plan_id, expires, payment.phone, user.id)
        .run();
    }
  }

  return (await getPaymentById(payment.id)) ?? payment;
}
