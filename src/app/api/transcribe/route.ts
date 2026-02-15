import { NextRequest, NextResponse } from 'next/server';

// This endpoint returns a temporary Deepgram API key for client-side streaming
// In production, you'd want proper auth here
export async function GET(request: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Deepgram API key not configured' },
      { status: 500 }
    );
  }

  // Return the key for client-side WebSocket connection
  // In production, use Deepgram's temporary key API instead
  return NextResponse.json({ apiKey });
}
