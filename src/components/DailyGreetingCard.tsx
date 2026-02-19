'use client';

import { useState } from 'react';

export interface GreetingData {
  userName: string;
  lastEventName: string | null;
  notableContact: { name: string; company: string } | null;
  pendingActionItems: string[];
  isFirstSession: boolean;
}

interface DailyGreetingCardProps {
  greeting: GreetingData;
  onDismiss: () => void;
}

export function DailyGreetingCard({ greeting, onDismiss }: DailyGreetingCardProps) {
  const [isFading, setIsFading] = useState(false);

  const handleDismiss = () => {
    setIsFading(true);
    setTimeout(onDismiss, 300);
  };

  if (greeting.isFirstSession) {
    return (
      <div
        className={`mx-4 mb-4 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-teal-50 border border-blue-100 shadow-sm transition-all duration-300 ${
          isFading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-lg text-gray-800">
              <span className="text-2xl mr-2">👋</span>
              Hey {greeting.userName}, welcome to Recall.
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Start a listening session to capture your first conversation.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-3 mt-1"
            aria-label="Dismiss greeting"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-4 mb-4 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-teal-50 border border-blue-100 shadow-sm transition-all duration-300 ${
        isFading ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-lg text-gray-800">
            <span className="text-2xl mr-2">👋</span>
            Welcome back, {greeting.userName}.
          </p>

          {greeting.notableContact && (
            <p className="text-sm text-gray-600 mt-1.5">
              Last time you met{' '}
              <span className="font-medium text-gray-800">{greeting.notableContact.name}</span>
              {greeting.notableContact.company && (
                <span> from {greeting.notableContact.company}</span>
              )}
              {greeting.lastEventName && (
                <span> at {greeting.lastEventName}</span>
              )}
              .
            </p>
          )}

          {greeting.pendingActionItems.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-500">Pending follow-ups:</span>
              {greeting.pendingActionItems.slice(0, 3).map((item, i) => (
                <span
                  key={i}
                  className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs"
                >
                  📋 {item}
                </span>
              ))}
              {greeting.pendingActionItems.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{greeting.pendingActionItems.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors ml-3 mt-1"
          aria-label="Dismiss greeting"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
