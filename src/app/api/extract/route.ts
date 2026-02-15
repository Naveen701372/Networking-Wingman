import { NextRequest, NextResponse } from 'next/server';

interface ExtractedEntities {
  name?: string;
  company?: string;
  role?: string;
  category?: 'founder' | 'vc' | 'developer' | 'designer' | 'student' | 'executive' | 'other';
  summary?: string;
  actionItems?: string[];
  isNewPerson?: boolean;
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
    const { transcript, existingData } = await request.json();

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ entities: {} });
    }

    const systemPrompt = `You are an AI assistant that extracts contact information from networking conversation transcripts.

Extract the following information about the OTHER person (not the user) from the transcript:
- name: Their full name if mentioned
- company: Their company/organization name
- role: Their job title or role
- category: One of: founder, vc, developer, designer, student, executive, other
- summary: A brief 1-2 sentence summary of who they are and what was discussed
- actionItems: Array of follow-up tasks mentioned (e.g., "send deck", "connect on LinkedIn")
- isNewPerson: true if this seems like a new conversation starting (trigger phrases like "Hi, I'm...", "Nice to meet you")

Rules:
- Only extract information that is explicitly mentioned
- For category, infer from context (e.g., "I founded..." = founder, "I invest in..." = vc)
- Keep summary concise and professional
- Action items should be from the user's perspective (what they promised to do)
- Return null for fields that cannot be determined

Respond ONLY with valid JSON, no markdown or explanation.`;

    const userPrompt = `Transcript:
"""
${transcript}
"""

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
