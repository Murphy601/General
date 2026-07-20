import { NextResponse } from 'next/server';
import { getCatalog, getGradeGroups, searchCatalog } from '@/lib/catalog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (q) {
    return NextResponse.json({ results: searchCatalog(q) });
  }

  return NextResponse.json({
    catalog: {
      totalDocuments: getCatalog().totalDocuments,
      generatedAt: getCatalog().generatedAt,
      grades: getGradeGroups(),
      subjects: getCatalog().bySubject,
    },
  });
}
