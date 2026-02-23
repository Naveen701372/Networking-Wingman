'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PersonCard, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';
import { cardEnter, staggerContainer } from '@/lib/animations';

/** Animated number that pops when value changes */
function AnimatedCount({ value }: { value: number }) {
  const prevRef = useRef(value);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setPop(true);
      const t = setTimeout(() => setPop(false), 350);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <motion.span
      animate={pop ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="inline-block"
    >
      {value}
    </motion.span>
  );
}

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
  activeTab?: 'people' | 'groups' | 'suggests';
  onTabChange?: (tab: 'people' | 'groups' | 'suggests') => void;
  groupCount?: number;
  suggestsCount?: number;
  isLoading?: boolean;
}

export function HistoryGrid({ cards, onLinkedInClick, searchQuery, activeTab, onTabChange, groupCount, suggestsCount, isLoading }: HistoryGridProps) {
  if (isLoading) {
    return (
      <div className="px-4 py-12 flex flex-col items-center justify-center gap-4">
        <div className="flex items-end gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pixar-dot-1" />
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pixar-dot-2" />
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pixar-dot-3" />
        </div>
        <p className="text-gray-400 text-sm">Loading your contacts...</p>
      </div>
    );
  }

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

  const showTabs = onTabChange && ((groupCount !== undefined && groupCount > 0) || (suggestsCount !== undefined && suggestsCount > 0));

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {showTabs ? (
          <>
            <button
              onClick={() => onTabChange('people')}
              className={`text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                activeTab === 'people'
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              People Met (<AnimatedCount value={matchCount} />{q && matchCount !== cards.length ? `/${cards.length}` : ''})
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onTabChange('groups')}
              className={`text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                activeTab === 'groups'
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              Groups (<AnimatedCount value={groupCount || 0} />)
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onTabChange('suggests')}
              className={`text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                activeTab === 'suggests'
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              Recall (<AnimatedCount value={suggestsCount || 0} />)
            </button>
          </>
        ) : (
          <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide">
            People Met ({matchCount}{q && matchCount !== cards.length ? ` of ${cards.length}` : ''})
          </h3>
        )}
      </div>
      {q && matchCount === 0 && (
        <p className="text-gray-400 text-center text-sm py-4">No matches found</p>
      )}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {sortedCards.map((card) => (
            <motion.div
              key={card.id}
              variants={cardEnter}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <PersonCardItem 
                card={card} 
                onLinkedInClick={onLinkedInClick}
                dimmed={q ? !cardMatches(card) : false}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
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
    <motion.div 
      onClick={toggleExpand}
      animate={{ opacity: dimmed ? 0.3 : 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
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
              className="w-8 h-8 bg-gray-400/80 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronIcon isExpanded={isExpanded} />
            </button>
          </div>

          {/* Summary - always visible but truncated when collapsed */}
          <p className={`text-gray-600 text-sm mt-3 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
            {(() => {
              const summary = card.summary || 'Conversation summary will appear here...';
              const limit = isExpanded ? 500 : 250;
              return summary.length > limit ? summary.slice(0, limit) + '…' : summary;
            })()}
          </p>

          {/* Expanded content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="mt-4 space-y-4 overflow-hidden"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg 
      className={`w-4 h-4 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
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
