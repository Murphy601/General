import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CBC Learn — Kenyan Revision & Lessons',
  description: 'AI-powered CBC learning notes, exams, quizzes, and video lessons grounded in KICD curriculum.',
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
