'use client';

import { useState } from 'react';
import { PersonCard, CATEGORY_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';

// Generate DiceBear avatar URL from name
function getAvatarUrl(name: string | null, style: 'shapes' | 'initials' | 'bottts' = 'shapes'): string {
  const seed = name || 'anonymous';
  // Using 'shapes' style - abstract, gender-neutral geometric patterns
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e5e7eb`;
}

interface HistoryGridProps {
  cards: PersonCard[];
  onLinkedInClick: (card: PersonCard) => void;
}

export function HistoryGrid({ cards, onLinkedInClick }: HistoryGridProps) {
  if (cards.length === 0) {
    return (
      <div className="px-4 py-12">
        <p className="text-gray-400 text-center text-lg">
          No contacts captured yet. Start a session and begin networking!
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-4">
        People Met ({cards.length})
      </h3>
      {cards.map((card) => (
        <PersonCardItem 
          key={card.id} 
          card={card} 
          onLinkedInClick={onLinkedInClick} 
        />
      ))}
    </div>
  );
}

interface PersonCardItemProps {
  card: PersonCard;
  onLinkedInClick: (card: PersonCard) => void;
}

function PersonCardItem({ card, onLinkedInClick }: PersonCardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLinkedInClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.linkedInUrl) {
      window.open(card.linkedInUrl, '_blank', 'noopener,noreferrer');
    }
    onLinkedInClick(card);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  // Calculate talk time (mock for now - will be real later)
  const talkTime = Math.floor(Math.random() * 10) + 2;
  
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
    >
      <div className="flex gap-4">
        {/* Avatar with category accent */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-24 bg-gray-100 rounded-xl overflow-hidden">
            {/* Avatar image */}
            <img 
              src={getAvatarUrl(card.name, 'shapes')} 
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
                className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: accentColor }}
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
                  <span className="font-semibold">Talk Time:</span> {talkTime} Minutes
                </p>
              </div>

              {/* Action items */}
              {card.actionItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {card.actionItems.map((item) => (
                    <span
                      key={item.id}
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
