import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { grade, subject } = body;

    if (!grade) {
      return NextResponse.json({ error: 'grade is required' }, { status: 400 });
    }

    const script = join(process.cwd(), '..', 'scripts', 'batch-generate-lessons.mjs');
    const args = [script, '--grade', grade, '--no-llm'];
    if (subject) args.push('--subject', subject);
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      cwd: join(process.cwd(), '..'),
      env: process.env,
    });
    child.unref();

    return NextResponse.json({
      message: `Batch generation started for ${grade}. Check Learning Docs and Revision Hub in a few minutes. Run in terminal to watch progress: npm run content:generate -- --grade ${grade}`,
      pid: child.pid,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
