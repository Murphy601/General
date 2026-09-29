import { NextResponse } from 'next/server';
import { isWorkers } from '@/lib/storage';
import { queryRag } from '@/lib/rag';

export async function POST(request: Request) {
  if (isWorkers()) {
    return NextResponse.json({ error: 'Not available on the hosted (Cloudflare) site. Run locally.' }, { status: 501 });
  }
  try {
    const body = await request.json();
    const { query, grade, subject, generateAnswer = true, topK } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const result = await queryRag(query, { grade, subject, generateAnswer, topK });

    return NextResponse.json({
      query,
      answer: result.answer,
      sources: result.sources,
      ragAvailable: result.ragAvailable,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
