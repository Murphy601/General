import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDocument, getDocumentText, getChunksForDocument } from '@/lib/catalog';

export default async function DocumentPage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const doc = getDocument(fileId);
  if (!doc) notFound();

  const fullText = getDocumentText(fileId);
  const chunks = getChunksForDocument(fileId);
  const displayText = fullText || chunks.map((c: { text: string }) => c.text).join('\n\n') || doc.excerpt;

  const sections = splitIntoSections(displayText);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/study/${encodeURIComponent(doc.gradeSlug)}/${doc.subjectSlug}`}
        className="text-sm text-kenya-green hover:underline"
      >
        ← {doc.subject}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{doc.gradeLabel}</p>
          <h1 className="font-display text-3xl font-bold text-kenya-black">{doc.title}</h1>
        </div>
        <a
          href={doc.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:border-kenya-green/40"
        >
          Open in Drive ↗
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-gray-100 px-3 py-1">{doc.pageCount} pages</span>
        <span className="rounded-full bg-gray-100 px-3 py-1">{(doc.charCount / 1000).toFixed(0)}k chars</span>
        {chunks.length > 0 && (
          <span className="rounded-full bg-gray-100 px-3 py-1">{chunks.length} indexed chunks</span>
        )}
      </div>

      <article className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        {sections.length > 1 ? (
          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={i}>
                {section.heading && (
                  <h2 className="font-display text-xl font-semibold text-kenya-green mb-3">{section.heading}</h2>
                )}
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">{displayText}</div>
        )}
      </article>

      <div className="mt-6 rounded-xl bg-kenya-green/5 border border-kenya-green/20 p-4 flex flex-wrap gap-4 justify-between items-center">
        <p className="text-sm text-gray-700">Revise this topic or test yourself</p>
        <div className="flex gap-2">
          <Link
            href={`/revision?grade=${encodeURIComponent(doc.grade)}&subject=${encodeURIComponent(doc.subject)}`}
            className="rounded-lg bg-kenya-green px-4 py-2 text-sm font-medium text-white"
          >
            Revision Assistant
          </Link>
          <Link
            href={`/quiz?grade=${encodeURIComponent(doc.grade)}&subject=${encodeURIComponent(doc.subject)}`}
            className="rounded-lg border border-kenya-green px-4 py-2 text-sm font-medium text-kenya-green"
          >
            Practice Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}

function splitIntoSections(text: string): { heading: string; body: string }[] {
  const headings = [
    'FOREWORD',
    'PREFACE',
    'GENERAL LEARNING OUTCOMES',
    'STRANDS AND SUB STRANDS',
    'STRANDS AND SUB-STRANDS',
    'ESSENCE STATEMENT',
    'INTRODUCTION',
    'ASSESSMENT',
  ];
  const sections: { heading: string; body: string }[] = [];
  let remaining = text;

  for (const heading of headings) {
    const idx = remaining.toUpperCase().indexOf(heading);
    if (idx !== -1) {
      if (idx > 100) {
        sections.push({ heading: '', body: remaining.slice(0, idx).trim() });
      }
      const nextHeadingIdx = headings
        .map((h) => remaining.toUpperCase().indexOf(h, idx + heading.length))
        .filter((i) => i > idx)
        .sort((a, b) => a - b)[0];
      const body = remaining.slice(
        idx + heading.length,
        nextHeadingIdx && nextHeadingIdx > idx ? nextHeadingIdx : undefined,
      );
      sections.push({ heading, body: body.trim() });
      remaining = nextHeadingIdx ? remaining.slice(nextHeadingIdx) : '';
    }
  }

  if (remaining.trim()) {
    sections.push({ heading: '', body: remaining.trim() });
  }

  return sections.filter((s) => s.body.length > 50);
}
