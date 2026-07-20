import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { grade, types = ['notes', 'quiz'] } = body;

    if (!grade) {
      return NextResponse.json({ error: 'grade is required' }, { status: 400 });
    }

    const script = join(process.cwd(), '..', 'scripts', 'batch-generate-revision.mjs');
    const child = spawn(
      process.execPath,
      [script, '--grade', grade, '--types', types.join(',')],
      {
        detached: true,
        stdio: 'ignore',
        cwd: join(process.cwd(), '..'),
        env: process.env,
      },
    );
    child.unref();

    return NextResponse.json({
      message: `Batch generation started for ${grade}. Check Learning Docs and Revision Hub in a few minutes. Run in terminal to watch progress: npm run content:generate -- --grade ${grade}`,
      pid: child.pid,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
