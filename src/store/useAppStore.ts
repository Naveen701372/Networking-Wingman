import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
  
  // Actions
  setUserId: (userId: string | null) => void;
  startSession: () => void;
  endSession: () => void;
  createNewCard: () => void;
  updateActiveCard: (updates: Partial<PersonCard>) => void;
  moveActiveToHistory: () => void;
  setTranscript: (text: string) => void;
  addActionItem: (text: string) => void;
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

  setUserId: (userId) => {
    set({ userId });
  },

  startSession: () => {
    const { userId } = get();
    
    // Create session in database
    supabase
      .from('sessions')
      .insert({ is_active: true, user_id: userId })
      .select('id')
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error creating session:', error);
        } else if (data) {
          set({ sessionId: data.id });
        }
      });

    set({
      isListening: true,
      sessionId: crypto.randomUUID(), // Temporary ID until DB returns
    });
  },

  endSession: () => {
    const { activeCard, historyCards, sessionId, userId, currentTranscript, currentCardStartIndex } = get();
    
    // Save active card to database before ending
    if (activeCard && activeCard.name) {
      const cardTranscript = currentTranscript.slice(currentCardStartIndex);
      supabase
        .from('person_cards')
        .upsert({
          id: activeCard.id,
          session_id: sessionId,
          user_id: userId,
          name: activeCard.name,
          company: activeCard.company,
          role: activeCard.role,
          category: activeCard.category,
          summary: activeCard.summary,
          linkedin_url: activeCard.linkedInUrl,
          transcript: cardTranscript,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Error saving card:', error);
            return;
          }
          
          // Save action items AFTER person_card is saved
          if (activeCard.actionItems.length > 0) {
            const actionItemsToSave = activeCard.actionItems.map(item => ({
              id: item.id,
              person_card_id: activeCard.id,
              text: item.text,
            }));
            supabase
              .from('action_items')
              .upsert(actionItemsToSave)
              .then(({ error: actionError }) => {
                if (actionError) console.error('Error saving action items:', actionError);
              });
          }
        });
    }

    // End session in database
    if (sessionId) {
      supabase
        .from('sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(({ error }) => {
          if (error) console.error('Error ending session:', error);
        });
    }

    set({
      isListening: false,
      activeCard: null,
      historyCards: activeCard 
        ? [{ ...activeCard, isActive: false }, ...historyCards]
        : historyCards,
      currentTranscript: '',
      currentCardStartIndex: 0,
    });
  },

  createNewCard: () => {
    const { activeCard, historyCards, currentTranscript } = get();
    const newCard: PersonCard = {
      id: crypto.randomUUID(),
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
    
    const updatedCard = { ...activeCard, ...updates };
    
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
    
    const newItem: ActionItem = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date(),
    };
    
    set({
      activeCard: {
        ...activeCard,
        actionItems: [...activeCard.actionItems, newItem],
      },
    });
  },

  setHistoryCards: (cards) => {
    set({ historyCards: cards });
  },

  loadFromDatabase: async () => {
    try {
      // Load person cards from Supabase
      const { data: cards, error: cardsError } = await supabase
        .from('person_cards')
        .select('*')
        .order('created_at', { ascending: false });

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
      const historyCards: PersonCard[] = cards.map(card => ({
        id: card.id,
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

      set({ historyCards });
    } catch (error) {
      console.error('Error loading from database:', error);
    }
  },
}));
