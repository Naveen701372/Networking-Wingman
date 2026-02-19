import { NextRequest, NextResponse } from 'next/server';

interface ExtractedEntities {
  name?: string;
  company?: string;
  role?: string;
  category?: 'founder' | 'vc' | 'developer' | 'designer' | 'student' | 'executive' | 'other';
  summary?: string;
  actionItems?: string[];
  isNewPerson?: boolean;
  detectedEvent?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.PPLX_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Perplexity API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { transcript, existingData, eventContext } = await request.json();

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ entities: {} });
    }

    const systemPrompt = `You are an AI assistant that extracts contact information from networking conversation transcripts.

CRITICAL: The USER is the person wearing the device. They introduce themselves as "I'm Navi" or "Hi, I'm Navi". You must NEVER extract Navi's information. Navi is NOT a contact — they are the user. Only extract information about the OTHER person Navi is talking to.

Extract the following about the OTHER person (NOT Navi):
- name: Their full name. NEVER return "Navi" or any variation.
- company: Their company/organization
- role: Their job title or role
- category: One of: founder, vc, developer, designer, student, executive, other
- summary: Brief 1-2 sentence summary of who they are and what was discussed
- actionItems: Array of specific follow-up tasks. Each must be a clear, non-empty string describing what Navi promised to do. Consolidate similar items (e.g., "send pitch deck" and "send deck tonight" should be ONE item like "Send pitch deck tonight").
- isNewPerson: true ONLY if a NEW person introduces themselves with a DIFFERENT name than the current person
- detectedEvent: If the conversation mentions a specific event, conference, meetup, or occasion (e.g., "TechSummit", "the fintech mixer", "YC Demo Day"), extract the event name. Return null if no event is mentioned or unclear.

CONTEXT AWARENESS RULES:

1. PRESERVE EXISTING DATA. If "Previously extracted data" is provided, treat those fields as established facts.
   Only overwrite an existing field if the new transcript contains a DIRECT, EXPLICIT statement from the contact themselves.
   Example: If existing company is "Apple" and the new transcript doesn't mention a company, keep "Apple". Do NOT clear it.

2. REQUIRE DIRECT SPEECH for field updates. Only update name/company/role if the contact DIRECTLY states it:
   - "I work at Google" → update company to Google
   - "I'm a product manager" → update role to product manager
   - Someone ELSE saying "she works at Google" → do NOT update (this is hearsay, not direct)
   If the new info is inferred or ambiguous, return null for that field and let the existing data stand.

3. ATTRIBUTE CAREFULLY in multi-person conversations. When multiple people are mentioned:
   - Only extract details for the person Navi is CURRENTLY talking to
   - If person A mentions person B's company/role, that info belongs to person B, NOT person A
   - Do NOT mix up attributes between people mentioned in the same conversation

4. NEVER DOWNGRADE SPECIFICITY. If existing data has a specific role like "Senior Designer" and new transcript
   just says "designer", keep "Senior Designer". Only update if the new info is MORE specific.

5. UNCERTAIN = NULL. When in doubt about any field, return null. It is always better to leave a field empty
   than to fill it with a wrong guess. Incomplete cards are fine — they can be enriched later.

GENERAL RULES:
- NEVER create entries for Navi/the user
- Only extract explicitly mentioned information
- For category: "I founded..." = founder, "I invest..." or "partner at a fund" = vc, "I'm an engineer/researcher" = developer
- Action items must be from Navi's perspective (what Navi committed to do)
- CONSOLIDATE similar action items into one. Maximum 3 action items per person.
- Every actionItem MUST have actual text, never empty strings
- Return null for undetermined fields

Respond ONLY with valid JSON.`;

    const userPrompt = `Transcript:
"""
${transcript}
"""

${eventContext ? `Event context: This conversation is happening at "${eventContext}".` : ''}
${existingData ? `Previously extracted data (update if new info found):
${JSON.stringify(existingData, null, 2)}` : ''}

Extract entities as JSON:`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to extract entities' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ entities: {} });
    }

    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      
      const entities: ExtractedEntities = JSON.parse(jsonStr.trim());
      
      // Filter out the user's own name — the system should never create a card for "Navi"
      if (entities.name && entities.name.toLowerCase().trim() === 'navi') {
        entities.name = undefined;
      }
      
      // Filter out empty/whitespace-only action items
      if (entities.actionItems) {
        entities.actionItems = entities.actionItems.filter(
          (item) => typeof item === 'string' && item.trim().length > 0
        );
      }
      
      return NextResponse.json({ entities });
    } catch (parseError) {
      console.error('Failed to parse LLM response:', content);
      return NextResponse.json({ entities: {} });
    }

  } catch (error) {
    console.error('Entity extraction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
