'use client';

import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { attributeSpeaker, type SpeakerLabel } from '@/lib/speaker-attribution';
import { useAppStore } from '@/store/useAppStore';

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  personCardId: string | null;
  speakerLabel: SpeakerLabel;
  text: string;
  timestamp: Date;
}

/**
 * Hook that stores final transcript segments to Supabase with speaker attribution.
 * Call `storeSegment` on each final transcript segment from Deepgram.
 */
export function useTranscriptStorage() {
  const lastStoredTextRef = useRef('');
  const pendingRef = useRef(false);
  const addTranscriptSegment = useAppStore((s) => s.addTranscriptSegment);

  const storeSegment = useCallback(
    async (fullTranscript: string, sessionId: string | null, personCardId: string | null) => {
      if (!sessionId) return;
      if (pendingRef.current) return;

      // Extract only the new text since last storage
      const newText = fullTranscript.slice(lastStoredTextRef.current.length).trim();
      if (!newText) return;

      pendingRef.current = true;
      lastStoredTextRef.current = fullTranscript;

      const speakerLabel = attributeSpeaker(newText);
      const segment: TranscriptSegment = {
        id: crypto.randomUUID(),
        sessionId,
        personCardId,
        speakerLabel,
        text: newText,
        timestamp: new Date(),
      };

      // Store in Zustand (always works)
      addTranscriptSegment(segment);

      // Persist to Supabase — don't send person_card_id if the card
      // hasn't been saved to the DB yet (foreign key constraint).
      // Cards are only persisted when the session ends, so during a live
      // session the person_card_id won't exist in the person_cards table.
      const { error } = await supabase.from('transcript_segments').insert({
        id: segment.id,
        session_id: segment.sessionId,
        person_card_id: null, // Link later via reconciliation or session end
        speaker_label: segment.speakerLabel,
        text: segment.text,
        timestamp: segment.timestamp.toISOString(),
      });

      if (error) {
        console.error('Error storing transcript segment:', error);
      }

      pendingRef.current = false;
    },
    [addTranscriptSegment]
  );

  const reset = useCallback(() => {
    lastStoredTextRef.current = '';
    pendingRef.current = false;
  }, []);

  return { storeSegment, reset };
}
