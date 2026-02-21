'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { PersonCard, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_LABELS } from '@/store/useAppStore';
import { cardEnter, contentFade } from '@/lib/animations';

// Generate DiceBear avatar URL from name
function getAvatarUrl(name: string | null): string {
  const seed = name || 'anonymous';
  // Using 'notionists' style - creative human-like illustrations, gender-neutral
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3f4f6`;
}

interface ActiveCardProps {
  person: PersonCard | null;
  isListening: boolean;
  transcriptSnippet: string;
}

export function ActiveCard({ person, isListening, transcriptSnippet }: ActiveCardProps) {
  if (!person && !isListening) {
    return null;
  }

  const accentColor = person ? CATEGORY_COLORS[person.category] : CATEGORY_COLORS.other;

  return (
    <motion.div
      variants={cardEnter}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`
        mx-4 mb-6 p-5 rounded-2xl
        bg-white/95 backdrop-blur-xl shadow-xl
        border-2 transition-all duration-300
        ${isListening 
          ? 'border-emerald-400 shadow-emerald-100 animate-pulse-border-light' 
          : 'border-gray-100'
        }
      `}
    >
      <div className="flex gap-4">
        {/* Avatar with category accent */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-24 bg-gray-100 rounded-xl overflow-hidden">
            {/* Avatar image */}
            <img 
              src={getAvatarUrl(person?.name ?? null)} 
              alt={person?.name || 'Contact'} 
              className="w-full h-full object-cover"
            />
            {/* Category accent corner */}
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
            <div className="flex-1">
              {/* Name */}
              <h2 className="text-2xl font-medium text-gray-900 italic font-serif">
                {person?.name || 'Listening...'}
              </h2>
              
              {/* Company & Role */}
              {(person?.company || person?.role) && (
                <p className="text-gray-700 text-sm mt-0.5">
                  {[person.company, person.role].filter(Boolean).join(', ')}
                </p>
              )}
              
              {/* Category badge */}
              {person && (
                <span 
                  className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: accentColor,
                    color: CATEGORY_TEXT_COLORS[person.category]
                  }}
                >
                  {CATEGORY_LABELS[person.category]}
                </span>
              )}
            </div>

            {/* Live indicator */}
            {isListening && (
              <div className="flex items-center gap-2 bg-emerald-500 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-semibold">LIVE</span>
              </div>
            )}
          </div>

          {/* Transcript snippet */}
          <AnimatePresence mode="wait">
            {(transcriptSnippet || isListening) && (
              <motion.div
                key={transcriptSnippet ? 'transcript' : 'waiting'}
                variants={contentFade}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mt-4 p-3 bg-gray-50 rounded-xl"
              >
                <p className="text-gray-600 text-sm leading-relaxed min-h-[48px]">
                  {transcriptSnippet || (
                    <span className="text-gray-400 italic">Waiting for speech...</span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action items */}
          {person?.actionItems && person.actionItems.filter(item => item && item.text).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {person.actionItems.filter(item => item && item.text).map((item, index) => (
                <span
                  key={`${person.id}-action-${index}`}
                  className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm"
                >
                  📋 {item.text}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
