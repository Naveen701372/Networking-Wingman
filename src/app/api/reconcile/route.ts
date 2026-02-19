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
}

interface ReconciliationUpdate {
  cardId: string;
  changes: Record<string, string | string[] | null>;
  confidence: number;
  reason: string;
}

interface ReconciliationMerge {
  sourceCardId: string;
  targetCardId: string;
  confidence: number;
  reason: string;
}

export interface ReconciliationResult {
  updates: ReconciliationUpdate[];
  merges: ReconciliationMerge[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.PPLX_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'PPLX_API_KEY is required for reconciliation' },
      { status: 500 }
    );
  }

  try {
    const { transcript, cards, deduplicationMode, candidatePairs } = (await request.json()) as {
      transcript: string;
      cards: CardSnapshot[];
      deduplicationMode?: boolean;
      candidatePairs?: [string, string][];
    };

    if (!cards || cards.length === 0) {
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }

    // Deduplication mode: focus on merge detection across cards
    if (deduplicationMode && candidatePairs && candidatePairs.length > 0) {
      return handleDeduplication(apiKey, cards, candidatePairs);
    }

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }

    const systemPrompt = `You are a reconciliation agent for a networking app called Recall. Your job is to review a full conversation transcript and compare it against existing contact cards to find corrections, additions, and potential merges.

For each existing card, check if the transcript reveals:
- A more accurate or complete name
- A company name that was missed or is different
- A role/title that was missed or is more specific
- A better category (founder, vc, developer, designer, student, executive, other)
- A more accurate summary of the conversation
- Additional action items that were missed
- Whether two cards might refer to the same person

Output a JSON object with:
{
  "updates": [
    {
      "cardId": "<id of the card to update>",
      "changes": { "<field>": "<new value>" },
      "confidence": <0-100>,
      "reason": "<brief explanation>"
    }
  ],
  "merges": [
    {
      "sourceCardId": "<id to merge from>",
      "targetCardId": "<id to merge into>",
      "confidence": <0-100>,
      "reason": "<brief explanation>"
    }
  ]
}

Rules:
- Only propose changes when the transcript clearly supports them
- For merges: suggest when names/context strongly indicate same person, even across different sessions on the same day
- Cards from different days with the same name might be different people at different events — be cautious
- confidence 90-100: very clear evidence in transcript
- confidence 60-89: likely but not certain
- confidence below 60: weak signal, still include but mark low
- Do NOT invent information not in the transcript
- Keep reasons concise (one sentence)
- Return empty arrays if no updates or merges are needed

Respond ONLY with valid JSON, no markdown or explanation.`;

    const userPrompt = `Full transcript:
"""
${transcript}
"""

Existing cards:
${JSON.stringify(cards, null, 2)}

Analyze and return reconciliation JSON:`;

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
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error (reconcile):', response.status, errorText);
      return NextResponse.json(
        { error: 'Reconciliation LLM call failed' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const result: ReconciliationResult = JSON.parse(jsonStr.trim());

      // Validate structure
      if (!Array.isArray(result.updates)) result.updates = [];
      if (!Array.isArray(result.merges)) result.merges = [];

      return NextResponse.json(result);
    } catch (parseError) {
      console.error('Failed to parse reconciliation response:', content);
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


async function handleDeduplication(
  apiKey: string,
  cards: CardSnapshot[],
  candidatePairs: [string, string][]
): Promise<NextResponse> {
  const pairsDescription = candidatePairs.map(([aId, bId]) => {
    const a = cards.find(c => c.id === aId);
    const b = cards.find(c => c.id === bId);
    if (!a || !b) return null;
    return { pair: [aId, bId], cardA: a, cardB: b };
  }).filter(Boolean);

  const systemPrompt = `You are a deduplication agent for a networking app. You receive pairs of contact cards that might refer to the same person. For each pair, decide if they should be merged.

Consider:
- Same or very similar names (e.g., "Elena" and "Elena Vasquez" = same person)
- Same company and similar role = likely same person
- Different companies with same name = could be different people, be cautious
- Cards from different sessions at the same event = likely same person if names match
- Cards from completely different events = could be different people with same name

Output JSON:
{
  "merges": [
    {
      "sourceCardId": "<id of card to merge FROM (less complete card)>",
      "targetCardId": "<id of card to merge INTO (more complete card)>",
      "confidence": <0-100>,
      "reason": "<brief explanation>"
    }
  ]
}

Rules:
- Only merge when you're reasonably confident (70+) they're the same person
- The targetCardId should be the more complete/detailed card
- Return empty merges array if no pairs should be merged
- Respond ONLY with valid JSON`;

  const userPrompt = `Candidate pairs to evaluate:
${JSON.stringify(pairsDescription, null, 2)}

Evaluate each pair and return merge decisions:`;

  try {
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
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
    }

    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    const result = JSON.parse(jsonStr.trim());
    return NextResponse.json({
      updates: [],
      merges: Array.isArray(result.merges) ? result.merges : [],
    } as ReconciliationResult);
  } catch (error) {
    console.error('Deduplication LLM error:', error);
    return NextResponse.json({ updates: [], merges: [] } as ReconciliationResult);
  }
}
