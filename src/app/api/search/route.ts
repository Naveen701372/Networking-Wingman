import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Deep transcript search using Supabase full-text search on transcript_segments.
 * Returns matching person_card IDs ranked by relevance.
 */
export async function POST(request: NextRequest) {
  try {
    const { query, userId } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ cardIds: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert query to tsquery format for full-text search
    // Split words and join with & for AND matching
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    const tsQuery = words.map(w => `${w}:*`).join(' & ');

    // Search transcript_segments using full-text search
    const { data: segments, error: searchError } = await supabase
      .from('transcript_segments')
      .select('person_card_id')
      .not('person_card_id', 'is', null)
      .textSearch('text', tsQuery, { type: 'websearch', config: 'english' });

    if (searchError) {
      // If full-text search fails (e.g. table doesn't exist or no GIN index),
      // fall back to ILIKE pattern matching
      console.warn('[Search] Full-text search failed, falling back to ILIKE:', searchError.message);

      const { data: fallbackSegments, error: fallbackError } = await supabase
        .from('transcript_segments')
        .select('person_card_id')
        .not('person_card_id', 'is', null)
        .ilike('text', `%${query.trim()}%`);

      if (fallbackError) {
        console.error('[Search] Fallback search also failed:', fallbackError);
        return NextResponse.json({ cardIds: [] });
      }

      const cardIds = [...new Set((fallbackSegments || []).map(s => s.person_card_id).filter(Boolean))];
      return NextResponse.json({ cardIds });
    }

    // Deduplicate and rank by frequency (more matching segments = higher relevance)
    const cardCounts = new Map<string, number>();
    for (const seg of segments || []) {
      if (seg.person_card_id) {
        cardCounts.set(seg.person_card_id, (cardCounts.get(seg.person_card_id) || 0) + 1);
      }
    }

    // Sort by relevance (most matches first)
    const cardIds = [...cardCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return NextResponse.json({ cardIds });
  } catch (err) {
    console.error('[Search] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
