'use client';

import { useAppStore } from '@/store/useAppStore';

export function SearchBar() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const historyCards = useAppStore((s) => s.historyCards);
  const isVoiceSearching = useAppStore((s) => s.isVoiceSearching);

  // Don't show search when there are no contacts
  if (historyCards.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="relative group">
        {/* Subtle glow behind the search bar */}
        <div className={`absolute -inset-0.5 rounded-2xl blur transition-opacity duration-300 ${
          isVoiceSearching
            ? 'bg-gradient-to-r from-emerald-400/30 via-teal-400/30 to-emerald-400/30 opacity-100'
            : 'bg-gradient-to-r from-blue-200/40 via-teal-200/30 to-blue-200/40 opacity-0 group-focus-within:opacity-100'
        }`} />
        <div className={`relative flex items-center backdrop-blur-xl rounded-2xl shadow-sm transition-all duration-300 ${
          isVoiceSearching
            ? 'bg-white/95 border border-emerald-200/80 shadow-md shadow-emerald-100/40'
            : 'bg-white/90 border border-gray-200/60 group-focus-within:shadow-md group-focus-within:border-blue-200/80'
        }`}>
          {/* Icon: mic when voice searching, magnifying glass otherwise */}
          {isVoiceSearching ? (
            <div className="ml-4 flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-500 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
          ) : (
            <svg
              className="ml-4 w-4 h-4 text-gray-400 group-focus-within:text-blue-400 transition-colors duration-200 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isVoiceSearching ? 'Listening for your query...' : 'Search contacts...'}
            className="w-full px-3 py-3 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            aria-label="Search contacts"
            readOnly={isVoiceSearching}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mr-3 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Clear search"
            >
              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
