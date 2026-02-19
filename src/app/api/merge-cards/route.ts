import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side merge endpoint: deletes source card and updates target card.
 * Uses service role key (if available) to bypass RLS policies that may
 * silently block client-side DELETE operations.
 */
export async function POST(request: NextRequest) {
  try {
    const { sourceCardId, targetCard } = await request.json();

    if (!sourceCardId || !targetCard?.id) {
      return NextResponse.json({ error: 'Missing sourceCardId or targetCard' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Delete source card (cascade removes its action_items)
    const { error: deleteError } = await supabase
      .from('person_cards')
      .delete()
      .eq('id', sourceCardId);

    if (deleteError) {
      console.error('[Merge API] Delete error:', deleteError);
    }

    // Verify deletion by trying to select the card
    const { data: checkData } = await supabase
      .from('person_cards')
      .select('id')
      .eq('id', sourceCardId)
      .maybeSingle();

    if (checkData) {
      // Card still exists — try a harder delete
      console.warn('[Merge API] Card still exists after delete, retrying...');
      const { error: retryErr } = await supabase
        .from('person_cards')
        .delete()
        .eq('id', sourceCardId);
      if (retryErr) {
        console.error('[Merge API] Retry delete failed:', retryErr);
        return NextResponse.json({ 
          error: 'Failed to delete source card — RLS may be blocking. Check Supabase policies.',
          deleteError: retryErr.message 
        }, { status: 403 });
      }
    }

    // 2. Update target card with merged data
    const { error: updateError } = await supabase
      .from('person_cards')
      .update({
        name: targetCard.name,
        company: targetCard.company,
        role: targetCard.role,
        category: targetCard.category,
        summary: targetCard.summary,
        linkedin_url: targetCard.linkedInUrl,
      })
      .eq('id', targetCard.id);

    if (updateError) {
      console.error('[Merge API] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[Merge API] Merged: deleted ${sourceCardId}, updated ${targetCard.id}`);
    return NextResponse.json({ ok: true, deleted: sourceCardId, updated: targetCard.id });
  } catch (err) {
    console.error('[Merge API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
