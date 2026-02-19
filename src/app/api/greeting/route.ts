import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface GreetingData {
  userName: string;
  lastEventName: string | null;
  notableContact: { name: string; company: string } | null;
  pendingActionItems: string[];
  isFirstSession: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, userName: clientUserName } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const userName = clientUserName || 'there';

    // Check if greeting already shown today
    const today = new Date().toISOString().split('T')[0];
    let alreadyShown = false;
    try {
      const { data: existingGreeting } = await supabase
        .from('daily_greetings')
        .select('id')
        .eq('user_id', userId)
        .eq('greeting_date', today)
        .single();

      if (existingGreeting) {
        alreadyShown = true;
      }
    } catch {
      // daily_greetings table may not exist — continue without tracking
    }

    if (alreadyShown) {
      return NextResponse.json({ alreadyShown: true });
    }

    // Check if user has any previous sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    const isFirstSession = !sessions || sessions.length === 0;

    if (isFirstSession) {
      // Record that we showed the greeting (best-effort)
      supabase.from('daily_greetings').insert({
        user_id: userId,
        greeting_date: today,
      }).then(() => {});

      const greeting: GreetingData = {
        userName,
        lastEventName: null,
        notableContact: null,
        pendingActionItems: [],
        isFirstSession: true,
      };
      return NextResponse.json({ greeting });
    }

    // Get last session's most notable contact (most action items or longest transcript)
    const { data: lastSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', false)
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();

    let notableContact: GreetingData['notableContact'] = null;
    const lastEventName: string | null = null;

    if (lastSession) {

      // Find the contact with the most action items from the last session
      const { data: cards } = await supabase
        .from('person_cards')
        .select('name, company')
        .eq('session_id', lastSession.id)
        .not('name', 'is', null);

      if (cards && cards.length > 0) {
        // Get action item counts for each card
        const cardNames = cards.map(c => c.name).filter(Boolean);
        if (cardNames.length > 0) {
          // Pick the first named contact from the last session as notable
          const notable = cards[0];
          notableContact = {
            name: notable.name!,
            company: notable.company || '',
          };
        }
      }
    }

    // Get pending (incomplete) action items across all sessions
    const { data: pendingItems } = await supabase
      .from('action_items')
      .select('text, person_card_id, person_cards!inner(user_id)')
      .eq('person_cards.user_id', userId)
      .limit(5);

    const pendingActionItems = (pendingItems || [])
      .map(item => item.text)
      .filter(Boolean);

    // Record that we showed the greeting (best-effort)
    supabase.from('daily_greetings').insert({
      user_id: userId,
      greeting_date: today,
    }).then(() => {});

    const greeting: GreetingData = {
      userName,
      lastEventName,
      notableContact,
      pendingActionItems,
      isFirstSession: false,
    };

    return NextResponse.json({ greeting });
  } catch (error) {
    console.error('Greeting API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
