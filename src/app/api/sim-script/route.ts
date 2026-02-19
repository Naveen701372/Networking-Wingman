import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const scriptPath = join(process.cwd(), 'test-scripts', 'networking-event-demo.txt');
    const content = await readFile(scriptPath, 'utf-8');
    return NextResponse.json({ script: content });
  } catch (err) {
    console.error('Failed to read simulation script:', err);
    return NextResponse.json(
      { error: 'Failed to load simulation script' },
      { status: 500 }
    );
  }
}
