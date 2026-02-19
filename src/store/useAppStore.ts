import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { markCardDeleted } from '@/lib/deleted-cards';

export interface ActionItem {
  id: string;
  text: string;
  createdAt: Date;
}

// Person category determines the accent color on their card
export type PersonCategory = 
  | 'founder'    // Red - Entrepreneurs, startup founders
  | 'vc'         // Purple - VCs, investors, angels
  | 'developer'  // Blue - Engineers, developers
  | 'designer'   // Pink - Designers, creatives
  | 'student'    // Green - Students, interns
  | 'executive'  // Gold - C-suite, directors
  | 'other';     // Gray - Default/unknown

export const CATEGORY_COLORS: Record<PersonCategory, string> = {
  founder: '#FCA5A5',    // Pastel Red
  vc: '#C4B5FD',         // Pastel Purple
  developer: '#93C5FD',  // Pastel Blue
  designer: '#F9A8D4',   // Pastel Pink
  student: '#86EFAC',    // Pastel Green
  executive: '#FCD34D',  // Pastel Gold/Amber
  other: '#D1D5DB',      // Pastel Gray
};

export const CATEGORY_TEXT_COLORS: Record<PersonCategory, string> = {
  founder: '#991B1B',    // Dark Red
  vc: '#5B21B6',         // Dark Purple
  developer: '#1E40AF',  // Dark Blue
  designer: '#9D174D',   // Dark Pink
  student: '#166534',    // Dark Green
  executive: '#92400E',  // Dark Amber
  other: '#374151',      // Dark Gray
};

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  founder: 'Founder',
  vc: 'Investor',
  developer: 'Developer',
  designer: 'Designer',
  student: 'Student',
  executive: 'Executive',
  other: 'Other',
};

export interface PersonCard {
  id: string;
  sessionId: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  category: PersonCategory;
  summary: string | null;
  linkedInUrl: string | null;
  actionItems: ActionItem[];
  transcriptSnippet: string;
  createdAt: Date;
  isActive: boolean;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  personCardId: string | null;
  speakerLabel: 'user' | 'contact' | 'unknown';
  text: string;
  timestamp: Date;
}

interface AppState {
  // Session state
  isListening: boolean;
  sessionId: string | null;
  userId: string | null;
  
  // Cards
  activeCard: PersonCard | null;
  historyCards: PersonCard[];
  
  // Real-time
  currentTranscript: string;
  currentCardStartIndex: number; // Track where current person's transcript starts
  
  // Transcript segments
  transcriptSegments: TranscriptSegment[];

  // Event context
  currentEvent: string | null;
  setCurrentEvent: (event: string | null) => void;

  // Greeting
  greetingDismissed: boolean;
  dismissGreeting: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isVoiceSearching: boolean;
  setVoiceSearching: (active: boolean) => void;
  
  // Actions
  setUserId: (userId: string | null) => void;
  startSession: () => Promise<void>;
  endSession: () => void;
  createNewCard: () => void;
  updateActiveCard: (updates: Partial<PersonCard>) => void;
  moveActiveToHistory: () => void;
  setTranscript: (text: string) => void;
  addActionItem: (text: string) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  mergeCards: (sourceCardId: string, targetCardId: string) => void;
  loadFromDatabase: () => Promise<void>;
  setHistoryCards: (cards: PersonCard[]) => void;
}

// Helper to generate LinkedIn search URL
const generateLinkedInUrl = (name: string, company?: string | null): string => {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const params = new URLSearchParams();
  params.set('keywords', name);
  params.set('origin', 'FACETED_SEARCH');
  if (company) {
    params.set('company', `"${company}"`);
  }
  return `${baseUrl}?${params.toString()}`;
};

export const useAppStore = create<AppState>((set, get) => ({
  isListening: false,
  sessionId: null,
  userId: null,
  activeCard: null,
  historyCards: [],
  currentTranscript: '',
  currentCardStartIndex: 0,
  transcriptSegments: [],
  currentEvent: null,
  greetingDismissed: false,
  searchQuery: '',
  isVoiceSearching: false,

  setUserId: (userId) => {
    set({ userId });
  },

  setCurrentEvent: (event) => {
    set({ currentEvent: event });
  },

  dismissGreeting: () => {
    set({ greetingDismissed: true });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setVoiceSearching: (active) => {
    set({ isVoiceSearching: active });
  },

  startSession: async () => {
    const { userId } = get();
    
    set({ isListening: true });

    const { data, error } = await supabase
      .from('sessions')
      .insert({ is_active: true, user_id: userId })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating session:', error);
      // Fallback to local UUID if DB fails
      set({ sessionId: crypto.randomUUID() });
    } else if (data) {
      set({ sessionId: data.id });
    }
  },

  endSession: () => {
    const { activeCard, historyCards, sessionId, currentEvent } = get();

    // End session in database
    if (sessionId) {
      const updateData: Record<string, unknown> = {
        is_active: false,
        ended_at: new Date().toISOString(),
      };
      // Only include event_name if detected — will gracefully retry without it
      // if the column doesn't exist yet (user needs to run migration)
      if (currentEvent) {
        updateData.event_name = currentEvent;
      }

      supabase
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId)
        .then(({ error }) => {
          if (error) {
            // Likely event_name column doesn't exist — retry without it
            supabase
              .from('sessions')
              .update({ is_active: false, ended_at: new Date().toISOString() })
              .eq('id', sessionId)
              .then(({ error: retryError }) => {
                if (retryError) console.error('[Session] Error ending session:', retryError);
              });
          }
        });
    }

    // Auto-persist hook will handle saving the active card via the store change
    set({
      isListening: false,
      activeCard: null,
      historyCards: activeCard 
        ? [{ ...activeCard, isActive: false }, ...historyCards]
        : historyCards,
      currentTranscript: '',
      currentCardStartIndex: 0,
      transcriptSegments: [],
      currentEvent: null,
    });
  },

  createNewCard: () => {
    const { activeCard, historyCards, currentTranscript, sessionId } = get();
    const newCard: PersonCard = {
      id: crypto.randomUUID(),
      sessionId,
      name: null,
      company: null,
      role: null,
      category: 'other',
      summary: null,
      linkedInUrl: null,
      actionItems: [],
      transcriptSnippet: '',
      createdAt: new Date(),
      isActive: true,
    };
    
    set({
      activeCard: newCard,
      historyCards: activeCard 
        ? [{ ...activeCard, isActive: false }, ...historyCards]
        : historyCards,
      // Don't clear transcript, but mark where new person's context starts
      currentCardStartIndex: currentTranscript.length,
    });
  },

  updateActiveCard: (updates) => {
    const { activeCard } = get();
    if (!activeCard) return;
    
    // Never allow actionItems to be overwritten via updateActiveCard
    // Action items should only be added via addActionItem to prevent wipes
    const { actionItems: _ignored, ...safeUpdates } = updates;
    
    const updatedCard = { ...activeCard, ...safeUpdates };
    
    // Auto-generate LinkedIn URL when name is set
    if (updates.name && !updatedCard.linkedInUrl) {
      updatedCard.linkedInUrl = generateLinkedInUrl(updates.name, updatedCard.company);
    }
    // Update LinkedIn URL if company changes and we have a name
    if (updates.company && updatedCard.name) {
      updatedCard.linkedInUrl = generateLinkedInUrl(updatedCard.name, updates.company);
    }
    
    set({ activeCard: updatedCard });
  },

  moveActiveToHistory: () => {
    const { activeCard, historyCards } = get();
    if (!activeCard) return;
    
    set({
      activeCard: null,
      historyCards: [{ ...activeCard, isActive: false }, ...historyCards],
    });
  },

  setTranscript: (text) => {
    const { activeCard } = get();
    set({ 
      currentTranscript: text,
      activeCard: activeCard 
        ? { ...activeCard, transcriptSnippet: text.slice(-200) }
        : null,
    });
  },

  addActionItem: (text) => {
    const { activeCard } = get();
    if (!activeCard) return;
    if (!text || typeof text !== 'string' || text.trim().length === 0) return;
    
    const newItem: ActionItem = {
      id: crypto.randomUUID(),
      text: text.trim(),
      createdAt: new Date(),
    };
    
    set({
      activeCard: {
        ...activeCard,
        actionItems: [...activeCard.actionItems, newItem],
      },
    });
  },

  addTranscriptSegment: (segment) => {
    set((state) => ({
      transcriptSegments: [...state.transcriptSegments, segment],
    }));
  },

  mergeCards: (sourceCardId, targetCardId) => {
    const { activeCard, historyCards } = get();
    
    // Find source and target cards
    const allCards = [...(activeCard ? [activeCard] : []), ...historyCards];
    const sourceCard = allCards.find(c => c.id === sourceCardId);
    const targetCard = allCards.find(c => c.id === targetCardId);
    
    if (!sourceCard || !targetCard) return;

    // Mark source as deleted IMMEDIATELY so autoPersist never re-creates it
    markCardDeleted(sourceCardId);
    
    // Merge: keep the more complete data from either card
    // For name: keep the longer one (e.g. "Kwame Asante" over "Kwame")
    const mergedName = (targetCard.name || '').length >= (sourceCard.name || '').length
      ? targetCard.name || sourceCard.name
      : sourceCard.name || targetCard.name;
    const merged: PersonCard = {
      ...targetCard,
      name: mergedName,
      company: targetCard.company || sourceCard.company,
      role: targetCard.role || sourceCard.role,
      category: targetCard.category !== 'other' ? targetCard.category : sourceCard.category,
      summary: targetCard.summary && sourceCard.summary
        ? `${targetCard.summary}. ${sourceCard.summary}`
        : targetCard.summary || sourceCard.summary,
      linkedInUrl: targetCard.linkedInUrl || sourceCard.linkedInUrl,
      actionItems: [
        ...targetCard.actionItems.filter(ti => ti && ti.id && ti.text),
        ...sourceCard.actionItems.filter(
          si => si && si.id && si.text && !targetCard.actionItems.some(ti => ti && ti.text && ti.text.toLowerCase() === si.text.toLowerCase())
        ),
      ],
      transcriptSnippet: targetCard.transcriptSnippet || sourceCard.transcriptSnippet,
    };
    
    // Regenerate LinkedIn URL with merged data
    if (merged.name) {
      merged.linkedInUrl = generateLinkedInUrl(merged.name, merged.company);
    }
    
    // Remove source card, update target card in Zustand
    if (activeCard?.id === targetCardId) {
      set({
        activeCard: merged,
        historyCards: historyCards.filter(c => c.id !== sourceCardId),
      });
    } else if (activeCard?.id === sourceCardId) {
      set({
        activeCard: null,
        historyCards: historyCards.map(c => c.id === targetCardId ? merged : c).filter(c => c.id !== sourceCardId),
      });
    } else {
      set({
        historyCards: historyCards.map(c => c.id === targetCardId ? merged : c).filter(c => c.id !== sourceCardId),
      });
    }

    // Persist merge via server-side API to bypass RLS that may silently block DELETE
    (async () => {
      try {
        const res = await fetch('/api/merge-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceCardId,
            targetCard: {
              id: targetCardId,
              name: merged.name,
              company: merged.company,
              role: merged.role,
              category: merged.category,
              summary: merged.summary,
              linkedInUrl: merged.linkedInUrl,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('[Merge] Server merge failed:', err);
        } else {
          console.log(`[Merge] Server merge complete: deleted ${sourceCardId}, updated ${targetCardId}`);
        }
      } catch (err) {
        console.error('[Merge] DB persistence error:', err);
      }
    })();
  },

  setHistoryCards: (cards) => {
    set({ historyCards: cards });
  },

  loadFromDatabase: async () => {
    try {
      const { userId } = get();
      
      // Load person cards from Supabase (only named cards, filtered by user)
      let query = supabase
        .from('person_cards')
        .select('*')
        .not('name', 'is', null)
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data: cards, error: cardsError } = await query;

      if (cardsError) {
        console.error('Error loading person cards:', cardsError);
        return;
      }

      if (!cards || cards.length === 0) {
        set({ historyCards: [] });
        return;
      }

      // Load action items for all cards
      const cardIds = cards.map(c => c.id);
      const { data: actionItems, error: actionsError } = await supabase
        .from('action_items')
        .select('*')
        .in('person_card_id', cardIds);

      if (actionsError) {
        console.error('Error loading action items:', actionsError);
      }

      // Map to PersonCard format
      const rawCards: PersonCard[] = cards.map(card => ({
        id: card.id,
        sessionId: card.session_id || null,
        name: card.name,
        company: card.company,
        role: card.role,
        category: (card.category || 'other') as PersonCategory,
        summary: card.summary,
        linkedInUrl: card.linkedin_url,
        actionItems: (actionItems || [])
          .filter(a => a.person_card_id === card.id)
          .map(a => ({
            id: a.id,
            text: a.text,
            createdAt: new Date(a.created_at),
          })),
        transcriptSnippet: card.transcript?.slice(-200) || '',
        createdAt: new Date(card.created_at),
        isActive: false,
      }));

      // Client-side dedup: merge cards that are clearly the same person.
      // Two strategies:
      // 1. Exact name match (case-insensitive) AND same or compatible company — merge
      //    "Priya Sharma" at Apple + "Priya Sharma" at Apple = same person
      //    "Priya Sharma" at Apple + "Priya Sharma" at Google = DIFFERENT people, skip
      // 2. First name is prefix of full name + same company — safe to merge
      //    (e.g. "Kwame" at Stripe + "Kwame Asante" at Stripe = same person)
      // All other fuzzy cases are left to the AI dedup agent.
      const deduped: PersonCard[] = [];
      const seenByName = new Map<string, number[]>(); // normalized name -> array of indices

      // Helper: check if cardA is a partial-name duplicate of cardB
      const isPartialNameMatch = (a: PersonCard, b: PersonCard): boolean => {
        const nameA = (a.name || '').toLowerCase().trim();
        const nameB = (b.name || '').toLowerCase().trim();
        if (!nameA || !nameB || nameA === nameB) return false;
        // One must be a prefix of the other (first name vs full name)
        const shorter = nameA.length < nameB.length ? nameA : nameB;
        const longer = nameA.length < nameB.length ? nameB : nameA;
        if (!longer.startsWith(shorter + ' ')) return false;
        // Require same company to confirm identity
        const compA = (a.company || '').toLowerCase().trim();
        const compB = (b.company || '').toLowerCase().trim();
        if (compA && compB && compA === compB) return true;
        // Or same role
        const roleA = (a.role || '').toLowerCase().trim();
        const roleB = (b.role || '').toLowerCase().trim();
        if (roleA && roleB && roleA === roleB) return true;
        return false;
      };

      // Collect DB cleanup operations to await them
      const dbCleanupOps: Promise<void>[] = [];

      for (const card of rawCards) {
        const key = (card.name || '').toLowerCase().trim();
        if (!key) {
          deduped.push(card);
          continue;
        }

        // Check for exact name match — but only merge if companies AND roles are compatible.
        // "Priya Sharma" at Apple ≠ "Priya Sharma" at Google.
        // "Priya Sharma" (designer) at Microsoft ≠ "Priya Sharma" (developer) at Microsoft.
        let matchIdx: number | undefined;
        const exactIndices = seenByName.get(key) || [];
        for (const idx of exactIndices) {
          const existing = deduped[idx];
          const compA = (card.company || '').toLowerCase().trim();
          const compB = (existing.company || '').toLowerCase().trim();
          // Block if different companies
          if (compA && compB && compA !== compB) continue;
          // Block if different roles (same name + same company + different role = different people)
          const roleA = (card.role || '').toLowerCase().trim();
          const roleB = (existing.role || '').toLowerCase().trim();
          if (roleA && roleB && roleA !== roleB) continue;
          matchIdx = idx;
          break;
        }

        // If no exact match, check for partial name match against all deduped cards
        if (matchIdx === undefined) {
          for (let i = 0; i < deduped.length; i++) {
            if (isPartialNameMatch(card, deduped[i])) {
              matchIdx = i;
              break;
            }
          }
        }

        if (matchIdx !== undefined) {
          // Merge into the existing card, keeping the longer name
          const existing = deduped[matchIdx];
          const keepName = (existing.name || '').length >= (card.name || '').length
            ? existing.name : card.name;
          deduped[matchIdx] = {
            ...existing,
            name: keepName,
            company: existing.company || card.company,
            role: existing.role || card.role,
            category: existing.category !== 'other' ? existing.category : card.category,
            summary: existing.summary && card.summary
              ? `${existing.summary}. ${card.summary}`
              : existing.summary || card.summary,
            linkedInUrl: existing.linkedInUrl || card.linkedInUrl,
            actionItems: [
              ...existing.actionItems,
              ...card.actionItems.filter(
                ai => ai.text && !existing.actionItems.some(
                  eai => eai.text && eai.text.toLowerCase() === ai.text.toLowerCase()
                )
              ),
            ],
            transcriptSnippet: existing.transcriptSnippet || card.transcriptSnippet,
          };
          // Regenerate LinkedIn URL with the better name
          if (deduped[matchIdx].name) {
            deduped[matchIdx].linkedInUrl = generateLinkedInUrl(
              deduped[matchIdx].name!, deduped[matchIdx].company
            );
          }

          // Queue DB cleanup via server-side API to bypass RLS
          markCardDeleted(card.id);
          const mergedCard = deduped[matchIdx];
          const dupId = card.id;
          const dupName = card.name;
          dbCleanupOps.push((async () => {
            try {
              const res = await fetch('/api/merge-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceCardId: dupId,
                  targetCard: {
                    id: mergedCard.id,
                    name: mergedCard.name,
                    company: mergedCard.company,
                    role: mergedCard.role,
                    category: mergedCard.category,
                    summary: mergedCard.summary,
                    linkedInUrl: mergedCard.linkedInUrl,
                  },
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error(`[Load Dedup] Server merge failed for ${dupName}:`, err);
              } else {
                console.log(`[Load Dedup] Cleaned up duplicate ${dupId} (${dupName})`);
              }
            } catch (err) {
              console.error('[Load Dedup] Merge API error:', err);
            }
          })());

          // Also register the name key so future cards match
          const existing2 = seenByName.get(key) || [];
          if (!existing2.includes(matchIdx)) {
            seenByName.set(key, [...existing2, matchIdx]);
          }
        } else {
          seenByName.set(key, [...(seenByName.get(key) || []), deduped.length]);
          deduped.push(card);
        }
      }

      // Set state immediately so UI shows deduped cards
      set({ historyCards: deduped });

      // Await all DB cleanup operations so they persist before any reload
      if (dbCleanupOps.length > 0) {
        await Promise.all(dbCleanupOps);
        console.log(`[Load Dedup] All ${dbCleanupOps.length} DB cleanup operations complete`);
      }
    } catch (error) {
      console.error('Error loading from database:', error);
    }
  },
}));
