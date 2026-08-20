import { PlatformLayout } from '@/components/PlatformLayout';
import { CheckoutPlans } from '@/components/CheckoutPlans';
import { getCurrentUser } from '@/lib/auth';

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <PlatformLayout active="/pricing">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Simple pricing for Kenyan parents</h1>
        <p className="text-gray-600 mt-2">
          Pay with M-Pesa STK Push. Enter your PIN on your phone — we activate the plan when Safaricom confirms.
        </p>
      </div>
      <CheckoutPlans user={user} />
    </PlatformLayout>
  );
}
