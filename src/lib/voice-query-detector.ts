/**
 * Voice Query Detection & Resolution for Recall.
 * 
 * The user's main goal: "Help me recall someone I met."
 * They describe the person using whatever they remember — company, role, 
 * something they discussed, their name, etc. We progressively narrow down
 * the matches as more context arrives.
 */

import { PersonCard } from '@/store/useAppStore';

// --- Trigger Detection ---

const TRIGGER_PATTERNS: RegExp[] = [
  /recall[,.]?\s+who\s+was/i,
  /recall[,.]?\s+find/i,
  /recall[,.]?\s+search/i,
  /recall[,.]?\s+show\s+me/i,
  /recall[,.]?\s+what\s+did/i,
  /recall[,.]?\s+where\s+does/i,
  /i\s+can'?t\s+remember/i,
  /i\s+can'?t\s+recall/i,
  /who\s+was\s+that\s+person/i,
  /who\s+was\s+the\s+(guy|person|woman|man|lady|girl|dude)/i,
  /do\s+you\s+remember/i,
  /which\s+(company|person|name)/i,
  /trying\s+to\s+(recall|remember|find|think)/i,
  /what\s+was\s+(his|her|their)\s+name/i,
];

// Phrases that indicate the user is STILL describing (continuation of a query)
const CONTINUATION_PATTERNS: RegExp[] = [
  /^(and|also|or|but|who|the one|that|they|he|she|with|at|from|works?|worked)/i,
  /^(something|someone|somebody|like|maybe|i think|probably|possibly)/i,
  /^(no not|not that|the other|different|another)/i,
  /company|role|job|title|position|team|department/i,
  /design|engineer|develop|found|invest|build|manage|lead|direct/i,
  /microsoft|google|apple|meta|amazon|stripe|figma|openai|anthropic/i,
];

export interface VoiceQueryResult {
  isQuery: boolean;
  queryText: string;
}

export function detectVoiceQuery(text: string): VoiceQueryResult {
  const trimmed = text.trim();
  if (!trimmed) return { isQuery: false, queryText: '' };

  for (const pattern of TRIGGER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const afterTrigger = trimmed.slice(match.index! + match[0].length).trim();
      const queryText = afterTrigger.replace(/[?.!]+$/, '').trim();
      return { isQuery: true, queryText: queryText || trimmed };
    }
  }

  return { isQuery: false, queryText: '' };
}

/**
 * Check if a piece of speech is a continuation of an active voice query.
 * This catches follow-up descriptions that don't repeat the trigger phrase.
 */
export function isQueryContinuation(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed.length < 3) return false;
  return CONTINUATION_PATTERNS.some(p => p.test(trimmed));
}

// --- Smart Contact Matching ---

const STOP_WORDS = new Set([
  'the', 'that', 'this', 'from', 'who', 'was', 'were', 'with', 'about',
  'person', 'guy', 'woman', 'man', 'lady', 'one', 'they', 'their', 'them',
  'does', 'did', 'had', 'has', 'have', 'been', 'being',
  'works', 'working', 'worked', 'like', 'said', 'told', 'met',
  'talked', 'spoke', 'know', 'think', 'remember', 'recall',
  'somebody', 'someone', 'something', 'some', 'any',
  'and', 'but', 'also', 'not', 'what', 'which', 'where', 'when',
  'can', 'could', 'would', 'should', 'will', 'shall',
  'his', 'her', 'its', 'our', 'your', 'name', 'company',
]);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  founder: ['founder', 'founded', 'started', 'startup', 'ceo', 'entrepreneur', 'cofounder'],
  vc: ['investor', 'vc', 'venture', 'fund', 'capital', 'angel', 'invest', 'investing', 'partner'],
  developer: ['developer', 'engineer', 'programmer', 'coder', 'tech', 'software', 'backend', 'frontend', 'fullstack'],
  designer: ['designer', 'design', 'creative', 'ux', 'ui', 'figma', 'visual', 'graphic'],
  student: ['student', 'intern', 'university', 'college', 'school', 'grad', 'phd', 'masters'],
  executive: ['executive', 'director', 'vp', 'chief', 'head', 'president', 'officer', 'cto', 'cfo', 'coo'],
};

function extractMeaningfulWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export interface ScoredMatch {
  card: PersonCard;
  score: number;
  matchReasons: string[];
}

/**
 * Score all cards against the accumulated voice query description.
 * Returns all cards with score > 0, sorted by score descending.
 * 
 * The scoring is additive — each clue the user provides adds points.
 * Multiple clues matching the same card compound, making it rise to the top.
 */
export function scoreCardsAgainstQuery(
  fullDescription: string,
  cards: PersonCard[]
): ScoredMatch[] {
  if (!fullDescription || cards.length === 0) return [];

  const desc = fullDescription.toLowerCase().trim();
  const words = extractMeaningfulWords(fullDescription);
  if (words.length === 0 && desc.length < 4) return [];

  const results: ScoredMatch[] = [];

  for (const card of cards) {
    if (!card.name) continue;

    let score = 0;
    const reasons: string[] = [];

    const cardName = (card.name || '').toLowerCase();
    const cardCompany = (card.company || '').toLowerCase();
    const cardRole = (card.role || '').toLowerCase();
    const cardSummary = (card.summary || '').toLowerCase();

    // 1. FULL NAME match — strongest signal (100 pts)
    if (cardName && desc.includes(cardName)) {
      score += 100;
      reasons.push('full name');
    } else if (cardName) {
      // Individual name parts (first/last name)
      const nameParts = cardName.split(/\s+/).filter(p => p.length > 2);
      for (const part of nameParts) {
        if (words.includes(part)) {
          score += 50;
          reasons.push(`name part "${part}"`);
        }
      }
    }

    // 2. COMPANY match — very strong signal (40 pts)
    if (cardCompany) {
      // Full company name in description
      if (desc.includes(cardCompany)) {
        score += 40;
        reasons.push(`company "${card.company}"`);
      } else {
        // Partial company word match (e.g. "micro" matching "Microsoft")
        const companyWords = cardCompany.split(/\s+/).filter(w => w.length > 3);
        for (const cw of companyWords) {
          for (const w of words) {
            if (cw.startsWith(w) || w.startsWith(cw)) {
              score += 25;
              reasons.push(`company partial "${w}"`);
              break;
            }
          }
        }
      }
    }

    // 3. ROLE match — strong signal (30 pts)
    if (cardRole) {
      if (desc.includes(cardRole)) {
        score += 30;
        reasons.push(`role "${card.role}"`);
      } else {
        const roleWords = cardRole.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (const rw of roleWords) {
          for (const w of words) {
            if (rw.includes(w) || w.includes(rw)) {
              score += 20;
              reasons.push(`role keyword "${w}"`);
              break;
            }
          }
        }
      }
    }

    // 4. CATEGORY keyword match (15 pts)
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (card.category === cat) {
        for (const w of words) {
          if (keywords.includes(w)) {
            score += 15;
            reasons.push(`category "${cat}"`);
            break;
          }
        }
      }
    }

    // 5. SUMMARY keyword match — weaker but cumulative (5 pts each, max 25)
    if (cardSummary) {
      let summaryScore = 0;
      for (const w of words) {
        if (w.length > 3 && cardSummary.includes(w)) {
          summaryScore += 5;
          if (summaryScore >= 25) break;
        }
      }
      if (summaryScore > 0) {
        score += summaryScore;
        reasons.push('summary keywords');
      }
    }

    // 6. ACTION ITEMS keyword match (8 pts each, max 16)
    if (card.actionItems && card.actionItems.length > 0) {
      const allActions = card.actionItems
        .map(a => (a.text || '').toLowerCase())
        .join(' ');
      let actionScore = 0;
      for (const w of words) {
        if (w.length > 3 && allActions.includes(w)) {
          actionScore += 8;
          if (actionScore >= 16) break;
        }
      }
      if (actionScore > 0) {
        score += actionScore;
        reasons.push('action items');
      }
    }

    if (score > 0) {
      results.push({ card, score, matchReasons: reasons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Given the full accumulated voice query description, resolve to the best
 * matching contact name. Returns null if no confident match.
 * 
 * When multiple cards match with similar scores, we return the top one
 * but the caller can use scoreCardsAgainstQuery for the full ranked list.
 */
export function resolveVoiceQueryToName(
  fullDescription: string,
  cards: PersonCard[],
  previousMatchName?: string | null
): string | null {
  const scored = scoreCardsAgainstQuery(fullDescription, cards);
  if (scored.length === 0) return null;

  const best = scored[0];

  // If the best score is very low, don't commit to a name yet
  if (best.score < 15) return null;

  // Stability: if we already had a match, don't flip to a different person
  // unless the new best is significantly better (>30% higher score).
  // This prevents the search bar from jumping between names as the user talks.
  if (previousMatchName && best.card.name !== previousMatchName) {
    const previousEntry = scored.find(s => s.card.name === previousMatchName);
    if (previousEntry) {
      const switchThreshold = previousEntry.score * 1.3;
      if (best.score < switchThreshold) {
        // Previous match is still competitive — stick with it
        return previousMatchName;
      }
    }
    // Also: if top two are very close and previous is one of them, prefer stability
    if (scored.length > 1) {
      const gap = best.score - scored[1].score;
      const relativeGap = gap / best.score;
      if (relativeGap < 0.15 && scored[1].card.name === previousMatchName) {
        return previousMatchName;
      }
    }
  }

  console.log(
    `[VoiceQuery] Best match: "${best.card.name}" (score: ${best.score}, reasons: ${best.matchReasons.join(', ')})` +
    (scored.length > 1 ? ` | Runner-up: "${scored[1].card.name}" (score: ${scored[1].score})` : '')
  );

  return best.card.name;
}
