'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { routeUpdate, routeMerge } from '@/lib/reconciliation';

export function useReconciliation() {
  const lastCharCountRef = useRef(0);
  const lastReconcileAtRef = useRef<Date | null>(null);
  const isReconcilingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reconcile = useCallback(async () => {
    const {
      currentTranscript,
      activeCard,
      historyCards,
      sessionId,
      isListening,
      updateActiveCard,
      mergeCards,
    } = useAppStore.getState();

    if (!isListening || !sessionId || isReconcilingRef.current) return;

    // Gather all cards: active + current session + today's history (cross-session dedup)
    const today = new Date().toISOString().split('T')[0];
    const allCards = [
      ...(activeCard ? [activeCard] : []),
      ...historyCards.filter((c) => {
        if (!c.name) return false;
        // Include current session cards
        if (c.sessionId === sessionId) return true;
        // Include today's cards from other sessions for cross-session awareness
        const cardDate = c.createdAt instanceof Date
          ? c.createdAt.toISOString().split('T')[0]
          : new Date(c.createdAt).toISOString().split('T')[0];
        return cardDate === today;
      }),
    ];

    if (allCards.length === 0 || currentTranscript.trim().length < 20) return;

    isReconcilingRef.current = true;

    try {
      const cardSnapshots = allCards.map((c) => ({
        id: c.id,
        sessionId: c.sessionId,
        name: c.name,
        company: c.company,
        role: c.role,
        category: c.category,
        summary: c.summary,
        actionItems: c.actionItems.map((a) => a.text),
      }));

      const response = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: currentTranscript,
          cards: cardSnapshots,
        }),
      });

      if (!response.ok) {
        console.error('Reconciliation request failed:', response.status);
        return;
      }

      const result = await response.json();
      lastReconcileAtRef.current = new Date();
      lastCharCountRef.current = currentTranscript.length;

      // Auto-apply all updates autonomously — no user interaction needed
      for (const update of result.updates || []) {
        const routed = routeUpdate(update);

        if (routed.action === 'discard') continue;

        // Auto-apply to active card
        if (activeCard && update.cardId === activeCard.id) {
          updateActiveCard(update.changes);
        } else {
          // Auto-apply to history cards
          const { historyCards: currentHistory } = useAppStore.getState();
          const updatedHistory = currentHistory.map((card) =>
            card.id === update.cardId ? { ...card, ...update.changes } : card
          );
          useAppStore.setState({ historyCards: updatedHistory });
        }
      }

      // Auto-merge duplicate cards autonomously
      for (const merge of result.merges || []) {
        const routed = routeMerge(merge);
        if (routed.action === 'discard') continue;

        mergeCards(merge.sourceCardId, merge.targetCardId);
      }
    } catch (error) {
      console.error('Reconciliation error:', error);
    } finally {
      isReconcilingRef.current = false;
    }
  }, []);

  // Watch transcript length and trigger reconciliation at threshold
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      if (!state.isListening) return;

      const newChars = state.currentTranscript.length - lastCharCountRef.current;

      if (newChars >= 500) {
        // Clear any pending timer and reconcile now
        if (timerRef.current) clearTimeout(timerRef.current);
        reconcile();
      } else if (newChars > 0 && !timerRef.current) {
        // Set a 30-second timer as fallback
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          reconcile();
        }, 30_000);
      }
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reconcile]);

  return {
    isReconciling: isReconcilingRef.current,
    lastReconcileAt: lastReconcileAtRef.current,
  };
}
