import { create } from 'zustand';

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
  founder: '#EF4444',    // Red
  vc: '#8B5CF6',         // Purple
  developer: '#3B82F6',  // Blue
  designer: '#EC4899',   // Pink
  student: '#22C55E',    // Green
  executive: '#F59E0B',  // Gold/Amber
  other: '#6B7280',      // Gray
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
  
  // Cards
  activeCard: PersonCard | null;
  historyCards: PersonCard[];
  
  // Real-time
  currentTranscript: string;
  
  // Actions
  startSession: () => void;
  endSession: () => void;
  createNewCard: () => void;
  updateActiveCard: (updates: Partial<PersonCard>) => void;
  moveActiveToHistory: () => void;
  setTranscript: (text: string) => void;
  addActionItem: (text: string) => void;
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

// Mock data for UI development
const mockHistoryCards: PersonCard[] = [
  {
    id: '1',
    name: 'Roman G Pillai',
    company: 'Kupa Creative',
    role: 'Creative Director',
    category: 'designer',
    summary: 'Works as a creative director managing teams of interdisciplinary artists in the XR space. Previously worked with Meta creating AR experiences on Instagram, Snapchat and TikTok. Having collaborated with top design agencies and worked on projects with Knorr, BMW, Bajaj, etc',
    linkedInUrl: generateLinkedInUrl('Roman Pillai', 'Kupa'),
    actionItems: [{ id: 'a1', text: 'Send portfolio link', createdAt: new Date() }],
    transcriptSnippet: '',
    createdAt: new Date(Date.now() - 3600000),
    isActive: false,
  },
  {
    id: '2',
    name: 'Priya Sharma',
    company: 'Accel Partners',
    role: 'Principal',
    category: 'vc',
    summary: 'Focuses on early-stage B2B SaaS investments in India and Southeast Asia. Previously founded a fintech startup that was acquired. Interested in AI-first products.',
    linkedInUrl: generateLinkedInUrl('Priya Sharma', 'Accel'),
    actionItems: [{ id: 'a2', text: 'Send pitch deck', createdAt: new Date() }],
    transcriptSnippet: '',
    createdAt: new Date(Date.now() - 7200000),
    isActive: false,
  },
  {
    id: '3',
    name: 'Alex Chen',
    company: 'Stripe',
    role: 'Engineering Manager',
    category: 'developer',
    summary: 'Leading the payments infrastructure team. Interested in developer tools and API design. Previously at Google working on Cloud APIs.',
    linkedInUrl: generateLinkedInUrl('Alex Chen', 'Stripe'),
    actionItems: [],
    transcriptSnippet: '',
    createdAt: new Date(Date.now() - 10800000),
    isActive: false,
  },
];

export const useAppStore = create<AppState>((set, get) => ({
  isListening: false,
  sessionId: null,
  activeCard: null,
  historyCards: mockHistoryCards,
  currentTranscript: '',

  startSession: () => {
    set({
      isListening: true,
      sessionId: crypto.randomUUID(),
    });
  },

  endSession: () => {
    const { activeCard, historyCards } = get();
    set({
      isListening: false,
      activeCard: null,
      historyCards: activeCard 
        ? [{ ...activeCard, isActive: false }, ...historyCards]
        : historyCards,
      currentTranscript: '',
    });
  },

  createNewCard: () => {
    const { activeCard, historyCards } = get();
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
      currentTranscript: '',
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
}));
