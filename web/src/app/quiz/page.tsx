import { QuizPanel } from '@/components/QuizPanel';

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-kenya-black">Practice Quiz</h1>
      <p className="mt-2 text-gray-600">
        Generate multiple-choice questions from curriculum content to test your understanding.
      </p>
      <div className="mt-8">
        <QuizPanel />
      </div>
    </div>
  );
}
