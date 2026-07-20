import { PlatformLayout } from '@/components/PlatformLayout';
import { PLANS } from '@/lib/types';

export default function PricingPage() {
  return (
    <PlatformLayout active="/pricing">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Simple pricing for Kenyan parents</h1>
        <p className="text-gray-600 mt-2">Pay with M-Pesa — instant access. Integration coming in Phase 2.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
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
              className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold ${
                plan.id === 'monthly' ? 'bg-kenya-green text-white' : 'border border-gray-300 text-gray-700'
              }`}
            >
              {plan.priceKes === 0 ? 'Current plan' : 'Coming soon'}
            </button>
          </div>
        ))}
      </div>
    </PlatformLayout>
  );
}
