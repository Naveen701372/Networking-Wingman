'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useDeepgramTranscription } from '@/hooks/useDeepgramTranscription';
import { useSimulatedTranscription } from '@/hooks/useSimulatedTranscription';

const IS_SIMULATION = process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true';
import { useEntityExtraction } from '@/hooks/useEntityExtraction';
import { useTranscriptStorage } from '@/hooks/useTranscriptStorage';
import { useReconciliation } from '@/hooks/useReconciliation';
import { useDeduplication } from '@/hooks/useDeduplication';
import { useAutoPersist } from '@/hooks/useAutoPersist';
import { ActiveCard } from '@/components/ActiveCard';
import { HistoryGrid } from '@/components/HistoryGrid';
import { SessionButton } from '@/components/SessionButton';
import { ListeningIndicator } from '@/components/ListeningIndicator';
import { ErrorModal } from '@/components/ErrorModal';
import { LoginCard } from '@/components/LoginCard';
import { DailyGreetingCard, GreetingData } from '@/components/DailyGreetingCard';
import { SearchBar } from '@/components/SearchBar';
import { GroupCard } from '@/components/GroupCard';
import { GroupBubbles } from '@/components/GroupBubbles';
import { ConnectionArchitectCard, generateArchitectInsights } from '@/components/ConnectionArchitectCard';
import { AnimatePresence, motion } from 'framer-motion';
import { tabContentSwitch, staggerContainer, cardEnter } from '@/lib/animations';
import { detectVoiceQuery, resolveVoiceQueryToName } from '@/lib/voice-query-detector';

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  
  const {
    isListening,
    activeCard,
    historyCards,
    currentTranscript,
    currentCardStartIndex,
    greetingDismissed,
    searchQuery,
    groups,
    setGroups,
    setUserId,
    startSession,
    endSession,
    createNewCard,
    setTranscript,
    updateActiveCard,
    addActionItem,
    dismissGreeting,
    setSearchQuery,
    setVoiceSearching,
    loadFromDatabase,
    isLoadingHistory,
  } = useAppStore();

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'people' | 'groups' | 'suggests'>('people');
  const lastTranscriptLengthRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const [greetingData, setGreetingData] = useState<GreetingData | null>(null);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const voiceQueryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceQueryTextRef = useRef<string>('');
  const voiceMatchRef = useRef<string | null>(null);

  // Set user ID in store when auth changes
  useEffect(() => {
    if (user) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
  }, [user, setUserId]);

  // Load history from database on mount (only when logged in)
  useEffect(() => {
    if (!hasLoadedRef.current && user) {
      hasLoadedRef.current = true;
      setIsLoadingCards(true);
      loadFromDatabase().finally(() => setIsLoadingCards(false));
    }
  }, [loadFromDatabase, user]);

  // Auto-dismiss greeting when listening starts
  useEffect(() => {
    if (isListening && greetingData) {
      setGreetingData(null);
      dismissGreeting();
    }
  }, [isListening, greetingData, dismissGreeting]);

  // Fetch daily greeting on mount (only before any session starts)
  useEffect(() => {
    if (!user || greetingDismissed || isListening) return;
    const firstName = (user.user_metadata?.full_name || user.user_metadata?.name || '').split(' ')[0] || 'there';
    fetch('/api/greeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: firstName }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.greeting && !data.alreadyShown) {
          setGreetingData(data.greeting);
        }
      })
      .catch(err => console.error('Failed to fetch greeting:', err));
  }, [user, greetingDismissed, isListening]);

  const { extractEntities } = useEntityExtraction();
  const { storeSegment, reset: resetTranscriptStorage } = useTranscriptStorage();
  useReconciliation();
  useDeduplication();
  useAutoPersist();

  // Fetch group suggestions when we have enough contacts
  const groupFetchedRef = useRef(false);
  useEffect(() => {
    if (historyCards.length <= 5 || isListening || groupFetchedRef.current) return;
    groupFetchedRef.current = true;

    fetch('/api/group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: historyCards }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.groups && data.groups.length > 0) {
          setGroups(data.groups);
        }
      })
      .catch(err => console.error('Failed to fetch groups:', err));
  }, [historyCards, isListening, setGroups]);

  // Handle transcript updates from Deepgram
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    // Use setTimeout to defer the state update outside of render
    setTimeout(() => {
      const { isVoiceSearching, historyCards } = useAppStore.getState();

      // ── MAIN PIPELINE — always runs, never blocked by search ──
      setTranscript(text);
      if (isFinal) {
        const { sessionId, activeCard } = useAppStore.getState();
        storeSegment(text, sessionId, activeCard?.id ?? null);
      }

      // ── PARALLEL SEARCH — only when no active conversation (fresh session / between people) ──
      if (isFinal) {
        const { activeCard: currentCard } = useAppStore.getState();
        const voiceQuery = detectVoiceQuery(text);

        if (voiceQuery.isQuery && !currentCard) {
          // Recall trigger detected — resolve and show result briefly
          const queryText = voiceQuery.queryText || '';
          voiceQueryTextRef.current = queryText;

          const matchedName = resolveVoiceQueryToName(queryText, historyCards, null);
          if (matchedName) {
            setSearchQuery(matchedName);
            voiceMatchRef.current = matchedName;
          }
          setVoiceSearching(true);

          // Auto-dismiss after 3s — enough time to glance at the result
          if (voiceQueryTimerRef.current) clearTimeout(voiceQueryTimerRef.current);
          voiceQueryTimerRef.current = setTimeout(() => {
            setSearchQuery('');
            setVoiceSearching(false);
            voiceQueryTextRef.current = '';
            voiceMatchRef.current = null;
            voiceQueryTimerRef.current = null;
          }, 3000);

        } else if (isVoiceSearching) {
          // Any non-trigger speech while search is showing — dismiss immediately.
          // The user has moved on to normal conversation.
          if (voiceQueryTimerRef.current) clearTimeout(voiceQueryTimerRef.current);
          voiceQueryTimerRef.current = null;
          setSearchQuery('');
          setVoiceSearching(false);
          voiceQueryTextRef.current = '';
          voiceMatchRef.current = null;
        }
      }
    }, 0);
  }, [setTranscript, storeSegment, setSearchQuery, setVoiceSearching]);

  // Extract entities when transcript grows significantly
  useEffect(() => {
    // Get only the transcript for the current person (or full if no card yet)
    const currentPersonTranscript = activeCard 
      ? currentTranscript.slice(currentCardStartIndex)
      : currentTranscript;
    const transcriptLength = currentPersonTranscript.length;
    
    // Extract sooner - after just 30 characters of new content
    if (transcriptLength - lastTranscriptLengthRef.current < 30) {
      return;
    }
    
    if (!isListening) {
      return;
    }

    lastTranscriptLengthRef.current = transcriptLength;

    // Run extraction with only current person's transcript
    extractEntities(currentPersonTranscript, activeCard || undefined).then((entities) => {
      if (!entities) return;

      // Skip if the detected name is the user themselves
      const selfNames = ['navi'];
      const isSelf = entities.name && selfNames.includes(entities.name.toLowerCase().trim());

      // If no active card yet and we detected a name, create the first card
      if (!activeCard && entities.name && !isSelf) {
        createNewCard();
        // Apply the extracted data to the new card after a tick
        setTimeout(() => {
          const updates: Record<string, unknown> = {};
          if (entities.name) updates.name = entities.name;
          if (entities.company) updates.company = entities.company;
          if (entities.role) updates.role = entities.role;
          if (entities.category) updates.category = entities.category;
          if (entities.summary) updates.summary = entities.summary;
          updateActiveCard(updates);
          
          if (entities.actionItems) {
            entities.actionItems.forEach(item => addActionItem(item));
          }
        }, 0);
        return;
      }

      if (!activeCard) return;

      // Check if this is a new person - create new card and move current to history
      if (entities.isNewPerson && activeCard.name && !isSelf) {
        // Check if this "new person" already has a card IN THE SAME SESSION (duplicate detection)
        // Same name at different events = different people, same name in same session = duplicate
        const { sessionId } = useAppStore.getState();
        const existingCard = historyCards.find(c => 
          c.name && entities.name && 
          c.sessionId === sessionId &&
          c.name.toLowerCase().trim() === entities.name.toLowerCase().trim()
        );
        
        if (existingCard) {
          // Same person detected again — merge into existing card instead of creating duplicate
          // Move current active card to history first
          createNewCard();
          lastTranscriptLengthRef.current = 0;
          
          // Merge the new info into the existing history card
          const { historyCards: currentHistory } = useAppStore.getState();
          const mergedHistory = currentHistory.map(c => {
            if (c.id !== existingCard.id) return c;
            return {
              ...c,
              company: entities.company || c.company,
              role: entities.role || c.role,
              category: entities.category && entities.category !== 'other' ? entities.category : c.category,
              summary: entities.summary 
                ? (c.summary ? `${c.summary}. ${entities.summary}` : entities.summary)
                : c.summary,
              actionItems: [
                ...c.actionItems,
                ...(entities.actionItems || [])
                  .filter(item => item && !c.actionItems.some(ai => ai.text && ai.text.toLowerCase() === item.toLowerCase()))
                  .map(item => ({ id: crypto.randomUUID(), text: item, createdAt: new Date() })),
              ],
            };
          });
          useAppStore.setState({ historyCards: mergedHistory });
          return;
        }
        
        // Genuinely new person — create new card
        createNewCard();
        lastTranscriptLengthRef.current = 0;
        
        // Apply new person's data after card is created
        setTimeout(() => {
          const updates: Record<string, unknown> = {};
          if (entities.name) updates.name = entities.name;
          if (entities.company) updates.company = entities.company;
          if (entities.role) updates.role = entities.role;
          if (entities.category) updates.category = entities.category;
          if (entities.summary) updates.summary = entities.summary;
          updateActiveCard(updates);
          
          if (entities.actionItems) {
            entities.actionItems.forEach(item => addActionItem(item));
          }
        }, 0);
        return;
      }

      // Update the active card with extracted entities
      const updates: Record<string, unknown> = {};
      
      if (entities.name && !activeCard.name && !isSelf) {
        updates.name = entities.name;
      }
      if (entities.company && !activeCard.company) {
        updates.company = entities.company;
      }
      if (entities.role && !activeCard.role) {
        updates.role = entities.role;
      }
      if (entities.category && activeCard.category === 'other') {
        updates.category = entities.category;
      }
      if (entities.summary) {
        updates.summary = entities.summary;
      }

      if (Object.keys(updates).length > 0) {
        updateActiveCard(updates);
      }

      // Add action items
      if (entities.actionItems && entities.actionItems.length > 0) {
        entities.actionItems.forEach((item) => {
          if (!item || typeof item !== 'string' || item.trim().length === 0) return;
          
          // Extract key words for fuzzy matching (remove stop words)
          const stopWords = new Set(['the', 'a', 'an', 'to', 'and', 'or', 'i', 'my', 'me', 'will', 'ill', "i'll", 'them', 'their', 'this', 'that', 'over', 'with', 'for', 'on', 'at', 'by']);
          const getKeyWords = (text: string) => 
            text.toLowerCase().trim().split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
          
          const newKeyWords = getKeyWords(item);
          
          const exists = activeCard.actionItems.some((existing) => {
            if (!existing.text) return false;
            const existingKeyWords = getKeyWords(existing.text);
            // Check if >50% of key words overlap
            const overlap = newKeyWords.filter(w => existingKeyWords.some(ew => ew.includes(w) || w.includes(ew)));
            return overlap.length >= Math.min(newKeyWords.length, existingKeyWords.length) * 0.5;
          });
          if (!exists) {
            addActionItem(item);
          }
        });
      }
    });
  }, [currentTranscript, currentCardStartIndex, isListening, activeCard, extractEntities, updateActiveCard, addActionItem, createNewCard]);

  // Both hooks must always be called (React rules), but only one is active
  const deepgram = useDeepgramTranscription(IS_SIMULATION ? () => {} : handleTranscript);
  const simulated = useSimulatedTranscription(IS_SIMULATION ? handleTranscript : () => {});

  const transcriptionError = IS_SIMULATION ? simulated.error : deepgram.error;
  const connectTranscription = IS_SIMULATION ? simulated.connect : deepgram.connect;
  const disconnectTranscription = IS_SIMULATION ? simulated.disconnect : deepgram.disconnect;
  const sendAudio = deepgram.sendAudio;

  // Handle audio chunks - send to Deepgram (no-op in simulation mode)
  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    sendAudio(chunk);
  }, [sendAudio]);

  const { isCapturing, error: captureError, audioLevels, startCapture, stopCapture } = useAudioCapture();

  // Handle errors via useEffect to avoid setState during render
  const error = IS_SIMULATION ? transcriptionError : (captureError || transcriptionError);
  useEffect(() => {
    if (error && !showError) {
      setErrorMessage(error);
      setShowError(true);
    }
  }, [error, showError]);

  const handleStartSession = useCallback(async () => {
    setIsConnecting(true);
    // Auto-dismiss greeting when session starts
    if (greetingData) {
      setGreetingData(null);
      dismissGreeting();
    }
    try {
      // Create session in DB first (await ensures sessionId is set before cards are created)
      await startSession();
      
      // Connect to transcription service (real or simulated)
      await connectTranscription();
      
      // Start audio capture only in live mode (skip in simulation)
      if (!IS_SIMULATION) {
        await startCapture(handleAudioChunk);
      }
      
    } catch (err) {
      console.error('Failed to start session:', err);
      setErrorMessage('Failed to start listening session. Please try again.');
      setShowError(true);
      // Clean up on error
      endSession();
    } finally {
      setIsConnecting(false);
    }
  }, [connectTranscription, startCapture, handleAudioChunk, startSession, endSession]);

  const handleEndSession = useCallback(() => {
    if (!IS_SIMULATION) {
      stopCapture();
    }
    disconnectTranscription();
    endSession();
    resetTranscriptStorage();
  }, [stopCapture, disconnectTranscription, endSession, resetTranscriptStorage]);

  const handleLinkedInClick = () => {
    // Analytics or logging could go here
  };

  const handleRetry = useCallback(async () => {
    setShowError(false);
    setErrorMessage('');
    await handleStartSession();
  }, [handleStartSession]);

  const handleCloseError = useCallback(() => {
    setShowError(false);
    setErrorMessage('');
  }, []);

  // In simulation mode, we're "active" as long as we're listening (no mic needed)
  const isActive = IS_SIMULATION ? isListening : (isListening && isCapturing);

  const handleDismissGreeting = useCallback(() => {
    setGreetingData(null);
    dismissGreeting();
  }, [dismissGreeting]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-200/40 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-teal-200/30 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="animate-pulse text-gray-500 z-10">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginCard onGoogleSignIn={signInWithGoogle} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28 relative overflow-hidden">
      {/* Subtle animated gradient orbs */}
      <div className="fixed top-1/4 -left-32 w-64 h-64 bg-blue-200/40 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-80 h-80 bg-teal-200/30 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center justify-between px-4 py-3">
          <img 
            src="/Recall_logo.png" 
            alt="Recall" 
            className="h-10 w-auto"
          />
          <div className="flex items-center gap-3">
            <ListeningIndicator isActive={isActive} audioLevels={audioLevels} />
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-4">
        {/* Daily greeting card — only before session starts */}
        <AnimatePresence>
          {greetingData && !greetingDismissed && !isListening && (
            <DailyGreetingCard greeting={greetingData} onDismiss={handleDismissGreeting} />
          )}
        </AnimatePresence>

        {/* Search bar */}
        <SearchBar />

        {/* Active conversation card */}
        <ActiveCard
          person={activeCard}
          isListening={isActive}
          transcriptSnippet={currentTranscript.slice(currentCardStartIndex)}
        />

        {/* Content based on active tab */}
        {!isListening && (groups.length > 0 || historyCards.length >= 3) && (activeTab === 'groups' || activeTab === 'suggests') ? (
          <div className="px-4 space-y-3">
            {/* Tab header — replicated from HistoryGrid style */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <button
                onClick={() => setActiveTab('people')}
                className="text-sm font-medium uppercase tracking-wide text-gray-400 hover:text-gray-500 transition-colors duration-200"
              >
                People Met ({historyCards.length})
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setActiveTab('groups')}
                className={`text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                  activeTab === 'groups' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                Groups ({groups.filter(g => g.type !== 'topic' && g.type !== 'custom').length})
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setActiveTab('suggests')}
                className={`text-sm font-medium uppercase tracking-wide transition-colors duration-200 ${
                  activeTab === 'suggests' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                Recall ({(() => {
                  const aiCount = groups.filter(g => g.type === 'topic' || g.type === 'custom').length;
                  return aiCount > 0 ? aiCount : generateArchitectInsights(historyCards).length;
                })()})
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* Groups tab — deterministic groups only */}
              {activeTab === 'groups' && (
                <motion.div
                  key="groups-tab"
                  variants={tabContentSwitch}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <GroupBubbles
                    groups={groups.filter(g => g.type !== 'topic' && g.type !== 'custom')}
                    cards={historyCards}
                    onLinkedInClick={handleLinkedInClick}
                  />
                </motion.div>
              )}

              {/* Recall Suggests tab — AI groups + architect cards fallback */}
              {activeTab === 'suggests' && (
                <motion.div
                  key="suggests-tab"
                  variants={tabContentSwitch}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {(() => {
                    const recallGroups = groups.filter(g => g.type === 'topic' || g.type === 'custom');
                    if (recallGroups.length > 0) {
                      return (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                          {recallGroups.map((group, idx) => (
                            <motion.div key={`ai-${group.label}-${idx}`} variants={cardEnter}>
                              <GroupCard
                                group={group}
                                cards={historyCards}
                                onLinkedInClick={handleLinkedInClick}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      );
                    }
                    // Fallback: show AI architect insights when no recall groups exist
                    const architectInsights = generateArchitectInsights(historyCards);
                    if (architectInsights.length > 0) {
                      return (
                        <div className="space-y-3">
                          <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">AI Network Analysis</p>
                          {architectInsights.map((insight, idx) => (
                            <ConnectionArchitectCard key={insight.id} card={insight} />
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">Recall suggestions appear after meeting 6+ people.</p>
                        <p className="text-gray-300 text-xs mt-1">AI finds hidden connections between your contacts.</p>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <HistoryGrid
            cards={historyCards}
            onLinkedInClick={handleLinkedInClick}
            searchQuery={searchQuery}
            activeTab={activeTab}
            onTabChange={!isListening && (groups.length > 0 || historyCards.length >= 3) ? setActiveTab : undefined}
            groupCount={groups.filter(g => g.type !== 'topic' && g.type !== 'custom').length}
            suggestsCount={(() => {
              const aiCount = groups.filter(g => g.type === 'topic' || g.type === 'custom').length;
              return aiCount > 0 ? aiCount : generateArchitectInsights(historyCards).length;
            })()}
            isLoading={isLoadingCards}
          />
        )}
      </main>

      {/* Floating session button */}
      <SessionButton
        isActive={isActive}
        isConnecting={isConnecting}
        onStart={handleStartSession}
        onEnd={handleEndSession}
      />

      {/* Error modal */}
      {showError && (
        <ErrorModal
          message={errorMessage}
          onClose={handleCloseError}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
