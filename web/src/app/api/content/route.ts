import { NextResponse } from 'next/server';
import { listContent, seedSamplesIfEmpty } from '@/lib/content-store';

export async function GET(request: Request) {
  seedSamplesIfEmpty();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const grade = searchParams.get('grade') || undefined;
  const subject = searchParams.get('subject') || undefined;

  const items = listContent({ type: type as never, grade, subject });
  return NextResponse.json({ items });
}
