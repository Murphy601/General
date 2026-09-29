import { NextResponse } from 'next/server';
import { isWorkers } from '@/lib/storage';
import { generateContent } from '@/lib/generate';
import type { ContentType } from '@/lib/types';

export async function POST(request: Request) {
  if (isWorkers()) {
    return NextResponse.json({ error: 'Not available on the hosted (Cloudflare) site. Run locally.' }, { status: 501 });
  }
  try {
    const body = await request.json();
    const { type, grade, subject, strand, subStrand, term, questionCount, access, priceKes } = body;

    if (!type || !grade || !subject) {
      return NextResponse.json({ error: 'type, grade, and subject are required' }, { status: 400 });
    }

    const content = await generateContent({
      type: type as ContentType,
      grade,
      subject,
      strand,
      subStrand,
      term,
      questionCount,
      access,
      priceKes,
    });

    return NextResponse.json({
      id: content.id,
      title: content.title,
      type: content.type,
      topic: content.topic,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
