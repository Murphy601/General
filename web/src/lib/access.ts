import type { PublicUser } from './membership';

export const DEFAULT_FREE_STUDY_PAGES = 3;

export function freeStudyPageCount(input?: { freePageCount?: number } | null, fallback = DEFAULT_FREE_STUDY_PAGES) {
  const n = input?.freePageCount;
  return typeof n === 'number' && n > 0 ? n : fallback;
}

/** Monthly and termly M-Pesa plans unlock remaining study pages. */
export function subscriberUnlocksLessons(user: PublicUser | null | undefined): boolean {
  if (!user?.planActive) return false;
  return user.plan === 'monthly' || user.plan === 'termly';
}

export function canReadStudyPage(input: {
  pageNumber: number;
  free?: boolean;
  freeCount: number;
  unlocked: boolean;
}) {
  if (input.unlocked) return true;
  if (input.free === true) return true;
  return input.pageNumber <= input.freeCount;
}
