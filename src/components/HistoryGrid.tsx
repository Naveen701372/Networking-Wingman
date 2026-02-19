'use client';

import { useState } from 'react';
import { PersonCard, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';

// Generate DiceBear avatar URL from name
function getAvatarUrl(name: string | null): string {
  const seed = name || 'anonymous';
  // Using 'notionists' style - creative human-like illustrations, gender-neutral
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3f4f6`;
}

interface HistoryGridProps {
  cards: PersonCard[];
  onLinkedInClick: (card: PersonCard) => void;
  searchQuery?: string;
}

export function HistoryGrid({ cards, onLinkedInClick, searchQuery }: HistoryGridProps) {
  if (cards.length === 0) {
    return null;
  }

  const q = (searchQuery || '').toLowerCase().trim();

  // Helper: does this card match the search query?
  const cardMatches = (card: PersonCard): boolean => {
    if (!q) return true;
    return [card.name, card.company, card.role, card.summary]
      .some(field => field && field.toLowerCase().includes(q));
  };

  // Rank: 0 = name match (highest), 1 = company/role match, 2 = summary match, 3 = no match
  const matchRank = (card: PersonCard): number => {
    if (!q) return 0;
    if (card.name && card.name.toLowerCase().includes(q)) return 0;
    if ((card.company && card.company.toLowerCase().includes(q)) ||
        (card.role && card.role.toLowerCase().includes(q))) return 1;
    if (card.summary && card.summary.toLowerCase().includes(q)) return 2;
    return 3;
  };

  const matchCount = q ? cards.filter(cardMatches).length : cards.length;

  // When searching, sort: name matches first, then company/role, then summary, then non-matches
  const sortedCards = q
    ? [...cards].sort((a, b) => matchRank(a) - matchRank(b))
    : cards;

  return (
    <div className="px-4 space-y-3">
      <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-4">
        People Met ({matchCount}{q && matchCount !== cards.length ? ` of ${cards.length}` : ''})
      </h3>
      {q && matchCount === 0 && (
        <p className="text-gray-400 text-center text-sm py-4">No matches found</p>
      )}
      {sortedCards.map((card) => (
        <PersonCardItem 
          key={card.id} 
          card={card} 
          onLinkedInClick={onLinkedInClick}
          dimmed={q ? !cardMatches(card) : false}
        />
      ))}
    </div>
  );
}

interface PersonCardItemProps {
  card: PersonCard;
  onLinkedInClick: (card: PersonCard) => void;
  dimmed?: boolean;
}

function PersonCardItem({ card, onLinkedInClick, dimmed }: PersonCardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLinkedInClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.linkedInUrl) {
      window.open(card.linkedInUrl, '_blank', 'noopener,noreferrer');
    }
    onLinkedInClick(card);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  // Calculate talk time from card creation time
  const talkTimeMinutes = Math.max(1, Math.round((Date.now() - new Date(card.createdAt).getTime()) / 60000));
  
  // Get category color
  const accentColor = CATEGORY_COLORS[card.category];

  return (
    <div 
      onClick={toggleExpand}
      className={`
        bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg
        border border-gray-100
        transition-all duration-300 ease-out cursor-pointer
        hover:shadow-xl hover:scale-[1.01]
        ${isExpanded ? 'p-5' : 'p-4'}
      `}
      style={{ opacity: dimmed ? 0.3 : 1 }}
    >
      <div className="flex gap-4">
        {/* Avatar with category accent */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-24 bg-gray-100 rounded-xl overflow-hidden">
            {/* Avatar image */}
            <img 
              src={getAvatarUrl(card.name)} 
              alt={card.name || 'Contact'} 
              className="w-full h-full object-cover"
            />
            {/* Category color accent corner */}
            <div 
              className="absolute top-0 left-0 w-0 h-0 border-b-[24px] border-b-transparent"
              style={{ 
                borderLeftWidth: '24px',
                borderLeftStyle: 'solid',
                borderLeftColor: accentColor 
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Name - Italic serif style */}
              <h4 className="text-2xl font-medium text-gray-900 italic font-serif truncate">
                {card.name || 'Unknown'}
              </h4>
              
              {/* Company & Role */}
              <p className="text-gray-700 text-sm mt-0.5">
                {[card.company, card.role].filter(Boolean).join(', ') || 'No details yet'}
              </p>
              
              {/* Category badge */}
              <span 
                className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: accentColor,
                  color: CATEGORY_TEXT_COLORS[card.category]
                }}
              >
                {CATEGORY_LABELS[card.category]}
              </span>
            </div>

            {/* Expand/Collapse button */}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
              className="w-10 h-10 bg-gray-400/80 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronIcon isExpanded={isExpanded} />
            </button>
          </div>

          {/* Summary - always visible but truncated when collapsed */}
          <p className={`text-gray-600 text-sm mt-3 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
            {card.summary || 'Conversation summary will appear here...'}
          </p>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 space-y-4 animate-fadeIn">
              {/* Metadata */}
              <div className="space-y-1">
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Event:</span> Networking Session
                </p>
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Talk Time:</span> {talkTimeMinutes} Minutes
                </p>
              </div>

              {/* Action items */}
              {card.actionItems.filter(item => item && item.text).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.actionItems.filter(item => item && item.text).map((item, index) => (
                    <span
                      key={`${card.id}-action-${index}`}
                      className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm"
                    >
                      📋 {item.text}
                    </span>
                  ))}
                </div>
              )}

              {/* LinkedIn button */}
              <button
                onClick={handleLinkedInClick}
                disabled={!card.linkedInUrl}
                className={`
                  w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                  text-base font-medium transition-colors
                  ${card.linkedInUrl 
                    ? 'bg-[#5B7FD3] hover:bg-[#4A6BC4] text-white' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
                aria-label={`Search ${card.name} on LinkedIn`}
              >
                <span>LinkedIn</span>
                <PersonIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg 
      className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  );
}
