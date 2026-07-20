export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-kenya-black text-gray-300 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold text-white">CBC Learn</p>
            <p className="mt-2 text-sm text-gray-400">
              Curriculum resources powered by KICD curriculum designs. Built for learners, teachers, and parents.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Features</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-400">
              <li>Browse by grade & subject</li>
              <li>AI revision assistant</li>
              <li>Practice quizzes</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">Source</p>
            <p className="mt-2 text-sm text-gray-400">
              Curriculum content from{' '}
              <a
                href="https://kicd.ac.ke/cbc-materials/"
                className="text-kenya-gold hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                KICD CBC Materials
              </a>
            </p>
          </div>
        </div>
        <p className="mt-8 border-t border-gray-800 pt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} CBC Learn. For educational use.
        </p>
      </div>
    </footer>
  );
}
