'use client';

import { motion } from 'framer-motion';
import { PersonCard } from '@/store/useAppStore';

interface ConnectionArchitectCardProps {
  card: ArchitectInsight;
}

export interface ArchitectInsight {
  id: string;
  emoji: string;
  title: string;
  body: string;
  accentColor: string;
}

// Accent colors that feel at home next to the contact card palette
const ACCENT = {
  diversity: '#C4B5FD',   // Pastel purple (matches vc/investor)
  balanced: '#86EFAC',    // Pastel green (matches student)
  connector: '#FCD34D',   // Pastel gold (matches executive)
  followup: '#FCA5A5',    // Pastel red (matches founder)
  depth: '#93C5FD',       // Pastel blue (matches developer)
};

/** Generate 2 architect insights based on the user's contacts */
export function generateArchitectInsights(cards: PersonCard[]): ArchitectInsight[] {
  if (cards.length === 0) return [];

  const categories = cards.map(c => c.category);
  const companies = cards.map(c => c.company).filter(Boolean);
  const uniqueCompanies = new Set(companies.map(c => c!.toLowerCase().trim()));

  const catCounts: Record<string, number> = {};
  for (const cat of categories) {
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  const topCategory = Object.entries(catCounts)
    .filter(([k]) => k !== 'other')
    .sort((a, b) => b[1] - a[1])[0];

  const insights: ArchitectInsight[] = [];

  // Insight 1: Network diversity or concentration
  if (topCategory && topCategory[1] >= cards.length * 0.5) {
    const catLabel: Record<string, string> = {
      founder: 'founders', vc: 'investors', developer: 'developers',
      designer: 'designers', student: 'students', executive: 'executives',
    };
    const label = catLabel[topCategory[0]] || topCategory[0];
    const missing = Object.keys(catLabel).filter(k => !catCounts[k] || catCounts[k] === 0);
    const suggestType = missing.length > 0
      ? catLabel[missing[Math.floor(Math.random() * missing.length)]] || 'new types of people'
      : 'people outside your usual circle';

    insights.push({
      id: 'arch-diversity',
      emoji: '🧭',
      title: 'Diversify Your Circle',
      body: `${Math.round((topCategory[1] / cards.length) * 100)}% of your network are ${label}. Meeting some ${suggestType} could open unexpected doors.`,
      accentColor: ACCENT.diversity,
    });
  } else {
    insights.push({
      id: 'arch-balanced',
      emoji: '⚖️',
      title: 'Well-Rounded Network',
      body: `You're connecting across ${Object.keys(catCounts).filter(k => k !== 'other').length} different roles. That kind of range is how serendipity happens.`,
      accentColor: ACCENT.balanced,
    });
  }

  // Insight 2: Company spread or connector potential
  if (uniqueCompanies.size >= 4) {
    insights.push({
      id: 'arch-connector',
      emoji: '🌐',
      title: 'Connector Potential',
      body: `You've touched ${uniqueCompanies.size} different companies. You're becoming the person who "knows someone at every company" — lean into that.`,
      accentColor: ACCENT.connector,
    });
  } else if (cards.length >= 3) {
    const actionCount = cards.reduce((sum, c) => sum + c.actionItems.length, 0);
    if (actionCount > 0) {
      insights.push({
        id: 'arch-followup',
        emoji: '🎯',
        title: 'Follow-Up Power',
        body: `You've got ${actionCount} action item${actionCount > 1 ? 's' : ''} across ${cards.length} contacts. Following up within 48 hours makes you 3x more memorable.`,
        accentColor: ACCENT.followup,
      });
    } else {
      insights.push({
        id: 'arch-depth',
        emoji: '🤝',
        title: 'Go Deeper',
        body: `You've met ${cards.length} people but haven't captured follow-ups yet. Next time, try asking "How can I help you?" — it creates natural action items.`,
        accentColor: ACCENT.depth,
      });
    }
  }

  return insights.slice(0, 2);
}

export function ConnectionArchitectCard({ card }: ConnectionArchitectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100
                 transition-all duration-300 ease-out hover:shadow-xl hover:scale-[1.01] p-4"
    >
      <div className="flex gap-4">
        {/* Avatar area — emoji, matching the contact card thumbnail slot */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-24 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
            <span className="text-4xl">{card.emoji}</span>
          </div>
          {/* Accent corner triangle — same as contact cards */}
          <div
            className="absolute top-0 left-0 w-0 h-0 border-b-[24px] border-b-transparent"
            style={{
              borderLeftWidth: '24px',
              borderLeftStyle: 'solid',
              borderLeftColor: card.accentColor,
            }}
          />
        </div>

        {/* Content — mirrors contact card layout */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Title — italic serif, same as contact names */}
              <h4 className="text-2xl font-medium text-gray-900 italic font-serif">
                {card.title}
              </h4>
              {/* Badge — styled like the category pill */}
              <span
                className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: card.accentColor, color: '#374151' }}
              >
                AI Insight
              </span>
            </div>
          </div>

          {/* Body — same position and style as the contact summary */}
          <p className="text-gray-600 text-sm mt-3 leading-relaxed">
            {card.body}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
