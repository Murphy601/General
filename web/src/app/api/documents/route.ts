import { NextResponse } from 'next/server';
import { getDocument, getDocumentText, getChunksForDocument } from '@/lib/catalog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 });
  }

  const doc = getDocument(fileId);
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const text = getDocumentText(fileId);
  const chunks = getChunksForDocument(fileId);

  return NextResponse.json({ document: doc, text, chunks });
}
