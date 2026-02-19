import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.id || !body.user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from('person_cards')
      .upsert({
        id: body.id,
        session_id: body.session_id,
        user_id: body.user_id,
        name: body.name,
        company: body.company,
        role: body.role,
        category: body.category || 'other',
        summary: body.summary,
        linkedin_url: body.linkedin_url,
        transcript: body.transcript || '',
      });

    if (error) {
      console.error('Persist card error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Persist card route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
