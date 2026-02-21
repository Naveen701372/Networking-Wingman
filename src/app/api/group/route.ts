import { NextRequest, NextResponse } from 'next/server';
import { createLLMProvider } from '@/lib/llm/provider-factory';
import { logTokenUsage, parseLLMJson } from '@/lib/llm/token-logger';

interface ContactInput {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  category: string;
  summary: string | null;
  sessionId: string | null;
}

interface GroupSuggestion {
  label: string;
  type: 'company' | 'category' | 'event' | 'time' | 'topic' | 'custom';
  cardIds: string[];
  count: number;
  reason?: string;
  emoji?: string;
}

/** Deterministic groupings — no LLM needed */
function buildDeterministicGroups(contacts: ContactInput[]): GroupSuggestion[] {
  const groups: GroupSuggestion[] = [];

  // Group by company (2+ contacts sharing the same company)
  const byCompany = new Map<string, ContactInput[]>();
  for (const c of contacts) {
    if (c.company) {
      const key = c.company.toLowerCase().trim();
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(c);
    }
  }
  for (const [, members] of byCompany) {
    if (members.length >= 2) {
      groups.push({
        label: `${members[0].company}`,
        type: 'company',
        cardIds: members.map(m => m.id),
        count: members.length,
      });
    }
  }

  // Group by category (2+ contacts, skip 'other')
  const byCategory = new Map<string, ContactInput[]>();
  for (const c of contacts) {
    if (c.category && c.category !== 'other') {
      if (!byCategory.has(c.category)) byCategory.set(c.category, []);
      byCategory.get(c.category)!.push(c);
    }
  }
  const categoryLabels: Record<string, string> = {
    founder: 'Founders',
    vc: 'Investors',
    developer: 'Developers',
    designer: 'Designers',
    student: 'Students',
    executive: 'Executives',
  };
  for (const [cat, members] of byCategory) {
    if (members.length >= 2) {
      groups.push({
        label: categoryLabels[cat] || cat,
        type: 'category',
        cardIds: members.map(m => m.id),
        count: members.length,
      });
    }
  }

  return groups;
}

/** LLM-based networking insights — 1-2 analytical observations about the user's network */
async function buildInsights(contacts: ContactInput[]): Promise<GroupSuggestion[]> {
  if (contacts.length < 3) return [];

  const contactSummaries = contacts.map(c =>
    `- ${c.name || 'Unknown'} (${c.company || 'no company'}, ${c.role || 'no role'}, category: ${c.category}): ${c.summary || 'no summary'}`
  ).join('\n');

  const systemPrompt = `You are a sharp networking analyst. You spot patterns in someone's networking activity and give them one or two genuinely useful observations. Return ONLY valid JSON.`;

  const userPrompt = `Here are all the contacts from recent networking events:
${contactSummaries}

Look at the big picture. What patterns do you notice? Think about:
- Are they gravitating toward a particular industry or role type?
- Is there a theme in the conversations (AI, fundraising, hiring, etc.)?
- Any interesting trend in who they're meeting?
- Any actionable observation (e.g. "You've met 4 founders but no investors — might be time to diversify")

Give 1-2 short, punchy insights. Each insight needs:
- A catchy label (like "The AI Magnet" or "Founder Streak")
- An emoji
- A one-sentence reason that feels like a friend pointing something out

Return JSON array:
[{ "label": "Insight Title", "emoji": "📈", "reason": "You've been meeting a lot of data science folks lately — looks like you're building a solid ML network" }]

Rules:
- Max 2 insights
- Be specific, reference actual patterns from the data
- Conversational tone, not corporate
- Each insight should feel genuinely useful, not generic`;

  try {
    const llm = createLLMProvider();
    const llmResponse = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 300,
      temperature: 0.5,
    });
    logTokenUsage('group/insights', llmResponse, llm.name);

    if (!llmResponse.content) return [];

    const parsed: Array<{ label: string; emoji?: string; reason?: string }> = parseLLMJson(llmResponse.content);

    return parsed.slice(0, 2).map(insight => ({
      label: insight.label,
      type: 'custom' as const,
      cardIds: [],
      count: 0,
      reason: insight.reason || undefined,
      emoji: insight.emoji || '💡',
    }));
  } catch {
    return [];
  }
}

/** LLM-based intelligent groupings via Perplexity */
async function buildLLMGroups(contacts: ContactInput[]): Promise<GroupSuggestion[]> {
  if (contacts.length < 3) return [];

  const contactSummaries = contacts.map(c =>
    `- ${c.name || 'Unknown'} (${c.company || 'no company'}, ${c.role || 'no role'}): ${c.summary || 'no summary'}`
  ).join('\n');

  const systemPrompt = `You are an intelligent networking assistant that finds hidden connections between people. You think about WHO would benefit from knowing each other, not just surface-level attributes. Return ONLY valid JSON.`;

  const userPrompt = `Here are contacts from networking events:
${contactSummaries}

Analyze these people deeply. Think about:
1. Who would genuinely benefit from an introduction to each other? (complementary skills, shared goals)
2. Who mentioned similar topics, challenges, or interests in their conversations?
3. Who could collaborate on something together based on what they discussed?
4. Who shares a vibe or energy that would make them click?

Suggest 2-4 smart, relationship-based groups. Each group needs:
- A catchy, friendly label (like "Future Co-Founders 🚀" or "The AI Crew")
- An emoji that captures the group's energy
- A short reason explaining WHY these people should connect (1 sentence, conversational)
- The contact names

Return JSON array:
[{ "label": "Group Name", "emoji": "🎯", "reason": "They all talked about building AI products and could totally jam together", "contactNames": ["Name1", "Name2"] }]

Rules:
- Only groups with 2+ members
- Focus on NON-OBVIOUS connections — company and role groups are already handled separately
- Make labels fun and memorable, not corporate
- The reason should feel like a friend giving advice, not a report`;

  try {
    const llm = createLLMProvider();
    const llmResponse = await llm.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 600,
      temperature: 0.4,
    });
    logTokenUsage('group/llm-groups', llmResponse, llm.name);

    if (!llmResponse.content) return [];

    const parsed: Array<{ label: string; emoji?: string; reason?: string; contactNames: string[] }> = parseLLMJson(llmResponse.content);

    // Map contact names back to IDs
    const nameToId = new Map<string, string>();
    for (const c of contacts) {
      if (c.name) nameToId.set(c.name.toLowerCase().trim(), c.id);
    }

    return parsed
      .map(g => {
        const cardIds = g.contactNames
          .map(n => nameToId.get(n.toLowerCase().trim()))
          .filter((id): id is string => !!id);
        return {
          label: g.label,
          type: 'topic' as const,
          cardIds,
          count: cardIds.length,
          reason: g.reason || undefined,
          emoji: g.emoji || '💡',
        };
      })
      .filter(g => g.count >= 2);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { contacts } = await request.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length <= 5) {
      return NextResponse.json({ groups: [] });
    }

    // Build deterministic groups first (fast, no LLM)
    const deterministicGroups = buildDeterministicGroups(contacts);

    // Build LLM topic groups and insights in parallel
    const [llmGroups, insights] = await Promise.all([
      buildLLMGroups(contacts),
      buildInsights(contacts),
    ]);

    const allGroups = [...deterministicGroups, ...llmGroups, ...insights];

    return NextResponse.json({ groups: allGroups });
  } catch (error) {
    console.error('Group API error:', error);
    return NextResponse.json({ error: 'Failed to generate groups' }, { status: 500 });
  }
}
