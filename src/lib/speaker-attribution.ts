export type SpeakerLabel = 'user' | 'contact' | 'unknown';

// Patterns indicating the speaker is the contact (first-person self-referential)
const CONTACT_PATTERNS = [
  /\bI work at\b/i,
  /\bI'm (?:a |an |the )?(?:founder|ceo|cto|developer|designer|engineer|student|investor|partner|director|manager|vp|head of)\b/i,
  /\bmy name is\b/i,
  /\bI (?:founded|started|co-founded|built|created|run|lead|manage)\b/i,
  /\bI'm (?:from|based in|working on|building|currently at)\b/i,
  /\bI've been (?:working|doing|building|running)\b/i,
  /\bI (?:studied|graduated|went to)\b/i,
  /\bmy company\b/i,
  /\bmy startup\b/i,
  /\bmy team\b/i,
  /\bwe're (?:building|working on|launching|raising|hiring)\b/i,
  /\bour product\b/i,
  /\bour company\b/i,
];

// Patterns indicating the speaker is the user (second-person directive)
const USER_PATTERNS = [
  /\byou should (?:check out|look at|try|talk to|meet|connect with)\b/i,
  /\blet me (?:send|share|introduce|connect|give)\b/i,
  /\bI'll (?:send|share|introduce|connect|forward|email)\b/i,
  /\bhave you (?:tried|heard|seen|met|checked)\b/i,
  /\byou might (?:like|want|enjoy|find)\b/i,
  /\bI can (?:introduce|connect|send|share)\b/i,
  /\bI know (?:someone|a guy|a person|somebody)\b/i,
  /\bwhat do you (?:think|do|work on)\b/i,
  /\btell me (?:about|more)\b/i,
  /\bwhat's your\b/i,
  /\bwhere are you\b/i,
  /\bnice to meet you\b/i,
];

/**
 * Attributes a transcript segment to a speaker based on text patterns.
 * - First-person self-referential → "contact" (the person being talked to)
 * - Second-person directive → "user" (the app user)
 * - Ambiguous → "unknown"
 */
export function attributeSpeaker(text: string): SpeakerLabel {
  const contactScore = CONTACT_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );

  const userScore = USER_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );

  if (contactScore > 0 && contactScore > userScore) return 'contact';
  if (userScore > 0 && userScore > contactScore) return 'user';
  return 'unknown';
}
