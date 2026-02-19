'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/**
 * Cross-session deduplication hook.
 * Runs when history cards are loaded (app start) and when a session ends.
 * Sends all named cards to the dedup agent to find and merge duplicates.
 */
export function useDeduplication() {
  const isDedupingRef = useRef(false);
  const lastDedupCountRef = useRef(0);

  const runDedup = useCallback(async () => {
    const { historyCards, mergeCards } = useAppStore.getState();

    // Only run if we have 2+ named cards and aren't already deduping
    const namedCards = historyCards.filter(c => c.name);
    if (namedCards.length < 2 || isDedupingRef.current) return;

    // Skip if card count hasn't changed since last dedup
    if (namedCards.length === lastDedupCountRef.current) return;

    isDedupingRef.current = true;

    try {
      const cardSnapshots = namedCards.map(c => ({
        id: c.id,
        sessionId: c.sessionId,
        name: c.name,
        company: c.company,
        role: c.role,
        category: c.category,
        summary: c.summary,
        actionItems: c.actionItems.map(a => a.text),
        createdAt: c.createdAt.toISOString(),
      }));

      const response = await fetch('/api/dedup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: cardSnapshots }),
      });

      if (!response.ok) {
        console.error('Dedup request failed:', response.status);
        return;
      }

      const result = await response.json();
      lastDedupCountRef.current = namedCards.length;

      // Track which cards have been involved in a merge this batch
      // to prevent chain merges (A→B then C→A where A is already gone)
      const mergedCardIds = new Set<string>();

      for (const merge of result.merges || []) {
        // Only auto-merge high confidence (>90). Lower confidence merges
        // might be different people with similar names at different events.
        if (merge.confidence <= 90) {
          console.log(`[Dedup] Skipping low-confidence merge: "${merge.reason}" (confidence: ${merge.confidence})`);
          continue;
        }

        // Skip if either card was already involved in a merge this batch
        if (mergedCardIds.has(merge.sourceCardId) || mergedCardIds.has(merge.targetCardId)) {
          console.log(`[Dedup] Skipping — card already merged this batch`);
          continue;
        }

        // Verify both cards still exist before merging
        const { historyCards: current } = useAppStore.getState();
        const sourceExists = current.some(c => c.id === merge.sourceCardId);
        const targetExists = current.some(c => c.id === merge.targetCardId);

        if (sourceExists && targetExists) {
          console.log(`[Dedup] Merging "${merge.reason}" (confidence: ${merge.confidence})`);
          mergedCardIds.add(merge.sourceCardId);
          mergedCardIds.add(merge.targetCardId);
          mergeCards(merge.sourceCardId, merge.targetCardId);
          // Small delay between merges to let DB operations settle
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (error) {
      console.error('Dedup error:', error);
    } finally {
      isDedupingRef.current = false;
    }
  }, []);

  // Run dedup when history cards change (after load or session end)
  const prevListeningRef = useRef(false);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      // Trigger dedup when session ends (isListening goes from true to false)
      if (prevListeningRef.current && !state.isListening) {
        // Small delay to let the session-end card move to history
        setTimeout(runDedup, 2000);
      }
      prevListeningRef.current = state.isListening;
    });

    return () => unsubscribe();
  }, [runDedup]);

  // Also run dedup once after initial history load
  const hasRunInitialRef = useRef(false);
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!hasRunInitialRef.current && state.historyCards.length >= 2) {
        hasRunInitialRef.current = true;
        // Delay to avoid running during initial render
        setTimeout(runDedup, 3000);
      }
    });

    return () => unsubscribe();
  }, [runDedup]);

  return { runDedup };
}
