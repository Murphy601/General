import { RevisionChat } from '@/components/RevisionChat';

export default function RevisionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-kenya-black">Revision Assistant</h1>
      <p className="mt-2 text-gray-600">
        Ask questions about CBC strands, learning outcomes, and curriculum content. Answers are grounded in official KICD
        curriculum designs.
      </p>
      <div className="mt-6">
        <RevisionChat />
      </div>
    </div>
  );
}
