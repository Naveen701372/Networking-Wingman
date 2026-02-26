import { NextResponse, NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const scriptName = request.nextUrl.searchParams.get('script') || 'networking-event-demo';
    const safeName = scriptName.replace(/[^a-zA-Z0-9_-]/g, '');
    const scriptPath = join(process.cwd(), 'test-scripts', `${safeName}.txt`);
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
