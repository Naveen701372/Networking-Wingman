'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Easing } from 'framer-motion';
import { PersonCard, GroupSuggestion, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';

function getAvatarUrl(name: string | null): string {
  const seed = name || 'anonymous';
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3f4f6`;
}

const BUBBLE_BG: Record<string, string> = {
  company: 'rgba(129,140,248,0.10)',
  category: 'rgba(167,139,250,0.10)',
  event: 'rgba(244,114,182,0.10)',
  time: 'rgba(251,191,36,0.10)',
};

const BUBBLE_BORDER: Record<string, string> = {
  company: 'rgba(129,140,248,0.25)',
  category: 'rgba(167,139,250,0.25)',
  event: 'rgba(244,114,182,0.25)',
  time: 'rgba(251,191,36,0.25)',
};

// Float animation per avatar slot
const floatVariants = (i: number) => ({
  y: [0, -5, 0, 4, 0],
  x: [0, i % 2 === 0 ? 4 : -4, 0, i % 2 === 0 ? -3 : 3, 0],
  transition: {
    duration: 3.5 + i * 0.7,
    ease: 'easeInOut' as Easing,
    repeat: Infinity,
    repeatType: 'loop' as const,
  },
});

// Positions for avatars inside the normal-sized bubble (% based)
const AVATAR_POS_SMALL = [
  { x: 50, y: 25 },
  { x: 30, y: 45 },
  { x: 70, y: 45 },
];

// Positions for avatars inside the focused/expanded bubble
const AVATAR_POS_LARGE = [
  { x: 50, y: 18 },
  { x: 25, y: 38 },
  { x: 75, y: 38 },
  { x: 35, y: 58 },
  { x: 65, y: 58 },
];

interface GroupBubblesProps {
  groups: GroupSuggestion[];
  cards: PersonCard[];
  onLinkedInClick: (card: PersonCard) => void;
}

export function GroupBubbles({ groups, cards, onLinkedInClick }: GroupBubblesProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);

  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));

  // Auto-rotate pages every 5s (pause when a bubble is focused)
  useEffect(() => {
    if (focusedLabel || totalPages <= 1) return;
    const timer = setInterval(() => {
      setPageIndex(prev => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(timer);
  }, [focusedLabel, totalPages]);

  const currentGroups = groups.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  const handleBubbleTap = useCallback((label: string) => {
    setFocusedLabel(prev => prev === label ? null : label);
  }, []);

  // Find the focused group data
  const focusedGroup = focusedLabel ? groups.find(g => g.label === focusedLabel) : null;
  const focusedMembers = focusedGroup ? cards.filter(c => focusedGroup.cardIds.includes(c.id)) : [];

  return (
    <div className="space-y-4">
      {/* Bubble carousel — show focused or 3-up */}
      <AnimatePresence mode="wait">
        {focusedGroup ? (
          /* ── Focused single bubble ── */
          <motion.div
            key={`focused-${focusedGroup.label}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            <motion.div
              onClick={() => setFocusedLabel(null)}
              className="relative cursor-pointer rounded-full flex items-center justify-center overflow-hidden"
              style={{
                width: 220,
                height: 220,
                background: BUBBLE_BG[focusedGroup.type] || 'rgba(209,213,219,0.12)',
                border: `2px solid ${BUBBLE_BORDER[focusedGroup.type] || 'rgba(209,213,219,0.3)'}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
              }}
              whileTap={{ scale: 0.96 }}
            >
              {focusedMembers.slice(0, 5).map((member, i) => {
                const pos = AVATAR_POS_LARGE[i];
                return (
                  <motion.div
                    key={member.id}
                    className="absolute"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                    animate={floatVariants(i)}
                  >
                    <div className="w-11 h-11 rounded-full border-2 border-white shadow-md overflow-hidden bg-gray-100">
                      <img src={getAvatarUrl(member.name)} alt={member.name || ''} className="w-full h-full object-cover" />
                    </div>
                  </motion.div>
                );
              })}
              {focusedMembers.length > 5 && (
                <motion.div
                  className="absolute"
                  style={{ left: '50%', top: '75%', transform: 'translate(-50%, -50%)' }}
                  animate={floatVariants(5)}
                >
                  <div className="w-11 h-11 rounded-full border-2 border-white shadow-md bg-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-500 font-bold">+{focusedMembers.length - 5}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>

            <h4 className="mt-3 text-lg font-medium text-gray-900 italic font-serif text-center">
              {focusedGroup.label}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              {focusedGroup.count} {focusedGroup.count === 1 ? 'person' : 'people'} · tap to close
            </p>

            {/* Member list below focused bubble */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15, ease: 'easeOut' }}
              className="w-full mt-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 p-3 space-y-1.5"
            >
              {focusedMembers.map(card => (
                <MemberRow key={card.id} card={card} onLinkedInClick={onLinkedInClick} />
              ))}
            </motion.div>
          </motion.div>
        ) : (
          /* ── 3-bubble carousel ── */
          <motion.div
            key={`page-${pageIndex}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="grid grid-cols-2 gap-3"
          >
            {currentGroups.map((group, idx) => {
              const memberCards = cards.filter(c => group.cardIds.includes(c.id));
              const preview = memberCards.slice(0, 3);

              return (
                <motion.div
                  key={`${group.label}-${idx}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.08, ease: 'easeOut' }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    onClick={() => handleBubbleTap(group.label)}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative w-full aspect-square rounded-full cursor-pointer
                               flex items-center justify-center overflow-hidden"
                    style={{
                      background: BUBBLE_BG[group.type] || 'rgba(209,213,219,0.12)',
                      border: `1.5px solid ${BUBBLE_BORDER[group.type] || 'rgba(209,213,219,0.3)'}`,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                    }}
                  >
                    {preview.map((member, i) => {
                      const pos = AVATAR_POS_SMALL[i];
                      return (
                        <motion.div
                          key={member.id}
                          className="absolute"
                          style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                          animate={floatVariants(i)}
                        >
                          <div className="w-9 h-9 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-100">
                            <img src={getAvatarUrl(member.name)} alt={member.name || ''} className="w-full h-full object-cover" />
                          </div>
                        </motion.div>
                      );
                    })}
                    {memberCards.length > 3 && (
                      <motion.div
                        className="absolute"
                        style={{ left: '50%', top: '65%', transform: 'translate(-50%, -50%)' }}
                        animate={floatVariants(3)}
                      >
                        <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm bg-gray-200 flex items-center justify-center">
                          <span className="text-[9px] text-gray-500 font-bold">+{memberCards.length - 3}</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  <p className="mt-2 text-xs font-medium text-gray-700 text-center leading-tight truncate w-full px-1">
                    {group.label}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {group.count}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page dots — only when not focused and more than 1 page */}
      {!focusedLabel && totalPages > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPageIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === pageIndex ? 'bg-gray-500 w-4' : 'bg-gray-300'
              }`}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ card, onLinkedInClick }: { card: PersonCard; onLinkedInClick: (card: PersonCard) => void }) {
  const accentColor = CATEGORY_COLORS[card.category];

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100
                 transition-colors duration-200 cursor-pointer"
      onClick={() => {
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
