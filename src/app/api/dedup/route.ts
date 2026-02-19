import { NextRequest, NextResponse } from 'next/server';

interface CardSnapshot {
  id: string;
  sessionId: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  category: string;
  summary: string | null;
  actionItems: string[];
  createdAt: string;
}

interface DeduplicationMerge {
  sourceCardId: string;
  targetCardId: string;
  confidence: number;
  reason: string;
}

export interface DeduplicationResult {
  merges: DeduplicationMerge[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.PPLX_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'PPLX_API_KEY is required for deduplication' },
      { status: 500 }
    );
  }

  try {
    const { cards } = (await request.json()) as { cards: CardSnapshot[] };

    if (!cards || cards.length < 2) {
      return NextResponse.json({ merges: [] } as DeduplicationResult);
    }

    const systemPrompt = `You are a deduplication agent for a networking app called Recall. You receive a list of contact cards that may contain duplicates — the same person appearing as multiple cards across different listening sessions.

Your job is to identify cards that likely refer to the SAME real person and should be merged.

CRITICAL RULES FOR IDENTITY:
- "Priya Sharma" and "Priya Chakraborty" are DIFFERENT people — different last names means different people, always.
- "David Chen" and "David Park" are DIFFERENT people — different last names means different people, always.
- Only consider merging when: same full name, OR first-name-only card matches a full-name card with the SAME company/role/context.
- Two cards with just a shared first name but different last names are NEVER the same person.

Signals that two cards are the SAME person (merge):
- Exact same full name AND same company (e.g., "Kwame Asante" at Figma and "Kwame Asante" at Figma)
- First-name-only card + full-name card with matching company AND role (e.g., "Kwame" at Figma + "Kwame Asante" at Figma)
- Same name, same company, overlapping summaries, created same day
- Same name with one card missing company info — cautious merge OK if roles/summaries align

Signals that two cards are DIFFERENT people (do NOT merge):
- Different last names — ALWAYS different people, no exceptions
- Same full name but DIFFERENT companies — ALWAYS different people (e.g., "Priya Sharma" at Apple ≠ "Priya Sharma" at Google)
- Same first name but different companies or roles
- Same name but clearly different contexts/summaries from different events
- Cards created weeks apart with no shared company/role details

Output a JSON object:
{
  "merges": [
    {
      "sourceCardId": "<id of the card to merge FROM (less complete)>",
      "targetCardId": "<id of the card to merge INTO (more complete)>",
      "confidence": <0-100>,
      "reason": "<brief explanation>"
    }
  ]
}

Rules:
- Only propose merges with confidence 80+
- The targetCardId should be the more complete card
- Return empty merges array if no duplicates found
- Do NOT chain merges (if A→B, don't also merge C→A)
- When in doubt, do NOT merge — it's better to have two cards for the same person than to wrongly merge two different people

Respond ONLY with valid JSON.`;

    const userPrompt = `Contact cards to check for duplicates:
${JSON.stringify(cards, null, 2)}

Analyze and return deduplication JSON:`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error (dedup):', response.status, errorText);
      return NextResponse.json({ error: 'Dedup LLM call failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ merges: [] } as DeduplicationResult);
    }

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const result: DeduplicationResult = JSON.parse(jsonStr.trim());
      if (!Array.isArray(result.merges)) result.merges = [];

      return NextResponse.json(result);
    } catch (parseError) {
      console.error('Failed to parse dedup response:', content);
      return NextResponse.json({ merges: [] } as DeduplicationResult);
    }
  } catch (error) {
    console.error('Dedup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
