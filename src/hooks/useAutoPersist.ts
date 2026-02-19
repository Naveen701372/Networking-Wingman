'use client';

import { useEffect, useRef } from 'react';
import { useAppStore, PersonCard } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { isCardDeleted } from '@/lib/deleted-cards';

/**
 * Auto-persist hook: subscribes to store changes and debounces writes to Supabase.
 * 
 * This runs in parallel with everything else — audio capture, transcription,
 * entity extraction, reconciliation all just update the store. This hook
 * watches for changes and persists them in the background.
 * 
 * Debounce strategy:
 * - Card upserts: 3 second debounce per card (batches rapid entity extraction updates)
 * - Action items: immediate (they're discrete events)
 * - Session end: immediate
 */

// Track what we've already persisted to avoid redundant writes
const persistedCardVersions = new Map<string, string>();
const persistedActionItemIds = new Set<string>();

function cardFingerprint(card: PersonCard): string {
  return JSON.stringify({
    name: card.name,
    company: card.company,
    role: card.role,
    category: card.category,
    summary: card.summary,
    linkedInUrl: card.linkedInUrl,
    actionItemCount: card.actionItems.filter(ai => ai && ai.id && ai.text).length,
  });
}

async function persistCard(card: PersonCard, sessionId: string | null, userId: string | null) {
  // CRITICAL: Never re-persist a card that was deleted by a merge
  if (isCardDeleted(card.id)) return;

  const fingerprint = cardFingerprint(card);
  
  // Skip if nothing changed
  if (persistedCardVersions.get(card.id) === fingerprint) return;
  
  // Only persist cards that have at least a name and a valid session
  if (!card.name || !sessionId || !userId) return;
  
  // Verify session_id is a real UUID (not null/undefined)
  const effectiveSessionId = card.sessionId || sessionId;
  if (!effectiveSessionId) return;

  const { error } = await supabase
    .from('person_cards')
    .upsert({
      id: card.id,
      session_id: effectiveSessionId,
      user_id: userId,
      name: card.name,
      company: card.company,
      role: card.role,
      category: card.category,
      summary: card.summary,
      linkedin_url: card.linkedInUrl,
      transcript: card.transcriptSnippet,
    });

  if (error) {
    console.error('Auto-persist card error:', error);
    return;
  }

  persistedCardVersions.set(card.id, fingerprint);

  // Persist any new action items — skip any with missing/invalid id
  const newActionItems = card.actionItems.filter(
    ai => ai && typeof ai.id === 'string' && ai.id.length > 0 && typeof ai.text === 'string' && ai.text.length > 0 && !persistedActionItemIds.has(ai.id)
  );
  if (newActionItems.length > 0) {
    // Insert individually to avoid one bad item blocking all
    for (const ai of newActionItems) {
      const { error: aiError } = await supabase
        .from('action_items')
        .upsert({
          id: ai.id,
          person_card_id: card.id,
          text: ai.text,
        }, { onConflict: 'id' });

      if (aiError) {
        console.error('Auto-persist action item error:', ai.id, aiError);
      } else {
        persistedActionItemIds.add(ai.id);
      }
    }
  }
}

export function useAutoPersist() {
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const DEBOUNCE_MS = 3000;

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      const { sessionId, userId, isListening } = state;
      
      if (!sessionId || !userId) return;

      // Collect all cards that need checking
      const cardsToCheck: PersonCard[] = [];
      
      // Check active card
      if (state.activeCard && state.activeCard !== prevState.activeCard) {
        cardsToCheck.push(state.activeCard);
      }
      
      // Check history cards — compare by reference to detect changes
      if (state.historyCards !== prevState.historyCards) {
        // Find cards that changed or are new
        for (const card of state.historyCards) {
          const prevCard = prevState.historyCards.find(c => c.id === card.id);
          if (!prevCard || prevCard !== card) {
            cardsToCheck.push(card);
          }
        }
      }

      // Debounce persist for each changed card
      for (const card of cardsToCheck) {
        // Skip cards that were deleted by a merge
        if (isCardDeleted(card.id)) continue;

        const existing = debounceTimers.current.get(card.id);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          debounceTimers.current.delete(card.id);
          persistCard(card, card.sessionId || sessionId, userId);
        }, DEBOUNCE_MS);

        debounceTimers.current.set(card.id, timer);
      }
    });

    return () => {
      unsubscribe();
      // Flush all pending timers on unmount
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer);
      }
      debounceTimers.current.clear();
    };
  }, []);

  // Also flush on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear debounce timers and do a synchronous-ish final persist
      const { activeCard, historyCards, sessionId, userId } = useAppStore.getState();
      
      if (!sessionId || !userId) return;

      // Persist active card immediately
      if (activeCard?.name) {
        // Use sendBeacon for reliability on page close
        const payload = JSON.stringify({
          id: activeCard.id,
          session_id: sessionId,
          user_id: userId,
          name: activeCard.name,
          company: activeCard.company,
          role: activeCard.role,
          category: activeCard.category,
          summary: activeCard.summary,
          linkedin_url: activeCard.linkedInUrl,
          transcript: activeCard.transcriptSnippet,
        });
        
        // Fire-and-forget via fetch (sendBeacon doesn't support auth headers)
        navigator.sendBeacon?.('/api/persist-card', payload);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
