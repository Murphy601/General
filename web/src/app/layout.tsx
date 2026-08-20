import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HighTech CBC Learners — Kenyan Revision & Lessons',
  description: 'HighTech CBC Learners: Kenyan CBC lessons, quizzes, and exams by grade, subject, and topic.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f9f7] text-kenya-black antialiased">
        {children}
      </body>
    </html>
  );
}
