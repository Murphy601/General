import { PLANS, type MembershipPlan } from './types';

const PLAN_RANK: Record<string, number> = {
  free: 0,
  single: 1,
  monthly: 2,
  termly: 3,
};

export function getPlan(planId: string): MembershipPlan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function planDurationMs(planId: string): number | null {
  if (planId === 'monthly') return 30 * 24 * 60 * 60 * 1000;
  if (planId === 'termly') return 90 * 24 * 60 * 60 * 1000;
  if (planId === 'single') return 7 * 24 * 60 * 60 * 1000;
  return null;
}

export function nextExpiry(planId: string, currentExpiresAt: number | null, from = Date.now()): number | null {
  const duration = planDurationMs(planId);
  if (!duration) return null;
  const start = Math.max(from, currentExpiresAt && currentExpiresAt > from ? currentExpiresAt : 0);
  return start + duration;
}

export function isPlanActive(plan: string, planExpiresAt: number | null, now = Date.now()): boolean {
  if (!plan || plan === 'free') return false;
  if (planExpiresAt == null) return plan !== 'free';
  return planExpiresAt > now;
}

export function shouldReplacePlan(currentPlan: string, currentExpiresAt: number | null, nextPlan: string, now = Date.now()): boolean {
  if (!isPlanActive(currentPlan, currentExpiresAt, now)) return true;
  return (PLAN_RANK[nextPlan] ?? 0) >= (PLAN_RANK[currentPlan] ?? 0);
}

export function publicUser(row: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  plan: string;
  plan_expires_at: number | null;
}) {
  const active = isPlanActive(row.plan, row.plan_expires_at);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    plan: active ? row.plan : 'free',
    planExpiresAt: row.plan_expires_at,
    planActive: active,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
