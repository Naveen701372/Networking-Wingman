import { NextRequest, NextResponse } from 'next/server';
import { createLLMProvider } from '@/lib/llm/provider-factory';
import { logTokenUsage, parseLLMJson } from '@/lib/llm/token-logger';

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
  try {
    const { cards } = (await request.json()) as { cards: CardSnapshot[] };

    if (!cards || cards.length < 2) {
      return NextResponse.json({ merges: [] } as DeduplicationResult);
    }

    const systemPrompt = `You are a deduplication agent for a networking app called Recall. You receive a list of contact cards that may contain duplicates — the same person appearing as multiple cards across different listening sessions.

Your job is to identify cards that likely refer to the SAME real person and should be merged.

CRITICAL RULES — NEVER VIOLATE:

1. TRUST EACH CARD'S OWN FIELDS. A card's name, company, and role are its ground truth.
   Do NOT use mentions of a person in another card's summary to override that person's own card fields.
   Example: If "Suki Tanaka" has company="Apple" on her own card, she works at Apple — even if
   another card's summary mentions "Suki Tanaka at Figma". The summary is about a conversation,
   not a correction of Suki's card.

2. Different companies = DIFFERENT people. No exceptions.
   "Suki Tanaka" at Apple ≠ "Suki Tanaka" at Figma.
   "Priya Sharma" at Apple ≠ "Priya Sharma" at Google.

3. Different last names = DIFFERENT people. No exceptions.
   "Priya Sharma" ≠ "Priya Chakraborty".

4. Same name + same company + different roles = DIFFERENT people. Do NOT merge.
   "Priya Sharma" (designer) at Microsoft ≠ "Priya Sharma" (developer) at Microsoft.
   Different roles at the same company means they are different people.

5. Never merge based on one card mentioning another person in its summary.
   Summaries describe conversations — they may reference other people by name.
   That does NOT mean those people should be merged.

MERGE only when:
- Exact same name AND same company AND same role (or one card missing role)
- First-name-only card + full-name card with matching company
- Same name, one card missing company — cautious merge OK if roles align

DO NOT MERGE when:
- Different companies on their own cards
- Different last names
- Different roles at the same company
- A person is only mentioned in another card's summary (not their own card)
- Different contexts/events with no shared company

Output JSON:
{
  "merges": [
    {
      "sourceCardId": "<less complete card>",
      "targetCardId": "<more complete card>",
      "confidence": <0-100>,
      "reason": "<brief explanation>"
    }
  ]
}

Rules:
- Only propose merges with confidence 80+
- Return empty merges array if no duplicates
- Do NOT chain merges
- When in doubt, do NOT merge

Respond ONLY with valid JSON.`;

    const userPrompt = `Contact cards to check for duplicates:
${JSON.stringify(cards, null, 2)}

Analyze and return deduplication JSON:`;

    const llm = createLLMProvider();
    const llmResponse = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 800,
      temperature: 0.1,
    });
    logTokenUsage('dedup', llmResponse, llm.name);

    const content = llmResponse.content;

    if (!content) {
      return NextResponse.json({ merges: [] } as DeduplicationResult);
    }

    try {
      const result: DeduplicationResult = parseLLMJson(content);
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
