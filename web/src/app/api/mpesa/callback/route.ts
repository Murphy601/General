import { NextResponse } from 'next/server';
import { callbackMeta } from '@/lib/mpesa';
import { getPaymentByCheckout, markPayment } from '@/lib/payments';

type CallbackBody = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: string | number }> };
    };
  };
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CallbackBody;
    const cb = payload?.Body?.stkCallback;
    if (!cb?.CheckoutRequestID) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    const payment = await getPaymentByCheckout(cb.CheckoutRequestID);
    if (payment) {
      const meta = callbackMeta(cb.CallbackMetadata?.Item);
      const ok = Number(cb.ResultCode) === 0;
      await markPayment(payment, {
        status: ok ? 'success' : 'failed',
        resultCode: Number(cb.ResultCode ?? -1),
        resultDesc: cb.ResultDesc || (ok ? 'Paid' : 'Payment failed'),
        receipt: meta.receipt,
      });
    }
  } catch {
    // Safaricom retries unless we acknowledge.
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}
