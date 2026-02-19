'use client';

import { useState } from 'react';
import { PersonCard, GroupSuggestion, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';

function getAvatarUrl(name: string | null): string {
  const seed = name || 'anonymous';
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3f4f6`;
}

// Soft accent colors for group types (used for the corner triangle, matching contact card pattern)
const GROUP_ACCENT: Record<string, string> = {
  company: '#818cf8',
  category: '#a78bfa',
  event: '#f472b6',
  time: '#fbbf24',
  topic: '#34d399',
  custom: '#22d3ee',
};

const DEFAULT_EMOJIS: Record<string, string> = {
  company: '🏢',
  category: '👥',
  event: '🎪',
  time: '🕐',
  topic: '💡',
  custom: '✨',
};

interface GroupCardProps {
  group: GroupSuggestion;
  cards: PersonCard[];
  onLinkedInClick: (card: PersonCard) => void;
}

export function GroupCard({ group, cards, onLinkedInClick }: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const memberCards = cards.filter(c => group.cardIds.includes(c.id));
  const emoji = group.emoji || DEFAULT_EMOJIS[group.type] || '📁';
  const accentColor = GROUP_ACCENT[group.type] || '#6b7280';
  // Show first few member avatars stacked inside the "avatar" area
  const previewMembers = memberCards.slice(0, 3);

  return (
    <div className="transition-all duration-300 ease-out">
      {/* Main group card — matches PersonCardItem design */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg
          border border-gray-100
          transition-all duration-300 ease-out cursor-pointer
          hover:shadow-xl hover:scale-[1.01]
          ${isExpanded ? 'p-5' : 'p-4'}
        `}
      >
        <div className="flex gap-4">
          {/* Avatar area — emoji with stacked member avatars */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-24 bg-gray-50 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1">
              <span className="text-2xl">{emoji}</span>
              {/* Mini avatar row */}
              <div className="flex -space-x-1.5">
                {previewMembers.map((m) => (
                  <div key={m.id} className="w-5 h-5 rounded-full border border-white overflow-hidden bg-gray-100">
                    <img src={getAvatarUrl(m.name)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {memberCards.length > 3 && (
                  <div className="w-5 h-5 rounded-full border border-white bg-gray-200 flex items-center justify-center">
                    <span className="text-[8px] text-gray-500 font-bold">+{memberCards.length - 3}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Category accent corner — same as contact cards */}
            <div
              className="absolute top-0 left-0 w-0 h-0 border-b-[24px] border-b-transparent"
              style={{
                borderLeftWidth: '24px',
                borderLeftStyle: 'solid',
                borderLeftColor: accentColor,
              }}
            />
          </div>

          {/* Content — matches contact card layout */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Group name — italic serif like contact names */}
                <h4 className="text-2xl font-medium text-gray-900 italic font-serif truncate">
                  {group.label}
                </h4>

                {/* Member count */}
                <p className="text-gray-700 text-sm mt-0.5">
                  {group.count} {group.count === 1 ? 'person' : 'people'}
                </p>
              </div>

              {/* Expand/Collapse button — same style as contact cards */}
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="w-8 h-8 bg-gray-400/80 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`w-4 h-4 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Reason / summary — like the contact card summary */}
            <p className={`text-gray-600 text-sm mt-3 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
              {group.reason || `A group of ${group.count} contacts`}
            </p>

            {/* Expanded: show member list */}
            {isExpanded && (
              <div className="mt-4 space-y-2 animate-fadeIn">
                {memberCards.map((card) => (
                  <MemberRow key={card.id} card={card} onLinkedInClick={onLinkedInClick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact member row inside expanded group */
function MemberRow({ card, onLinkedInClick }: { card: PersonCard; onLinkedInClick: (card: PersonCard) => void }) {
  const accentColor = CATEGORY_COLORS[card.category];

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100
                 transition-colors duration-200 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        if (card.linkedInUrl) window.open(card.linkedInUrl, '_blank', 'noopener,noreferrer');
        onLinkedInClick(card);
      }}
    >
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <img src={getAvatarUrl(card.name)} alt={card.name || 'Contact'} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{card.name || 'Unknown'}</p>
        <p className="text-gray-400 text-xs truncate">
          {[card.company, card.role].filter(Boolean).join(', ') || 'No details'}
        </p>
      </div>
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
        style={{ backgroundColor: accentColor, color: CATEGORY_TEXT_COLORS[card.category] }}
      >
        {CATEGORY_LABELS[card.category]}
      </span>
    </div>
  );
}
