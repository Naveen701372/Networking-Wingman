'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useDeepgramTranscription } from '@/hooks/useDeepgramTranscription';
import { useEntityExtraction } from '@/hooks/useEntityExtraction';
import { ActiveCard } from '@/components/ActiveCard';
import { HistoryGrid } from '@/components/HistoryGrid';
import { SessionButton } from '@/components/SessionButton';
import { ListeningIndicator } from '@/components/ListeningIndicator';
import { ErrorModal } from '@/components/ErrorModal';
import { LoginCard } from '@/components/LoginCard';

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  
  const {
    isListening,
    activeCard,
    historyCards,
    currentTranscript,
    currentCardStartIndex,
    setUserId,
    startSession,
    endSession,
    createNewCard,
    setTranscript,
    updateActiveCard,
    addActionItem,
    loadFromDatabase,
  } = useAppStore();

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const lastTranscriptLengthRef = useRef(0);
  const hasLoadedRef = useRef(false);

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
      loadFromDatabase();
    }
  }, [loadFromDatabase, user]);

  const { extractEntities } = useEntityExtraction();

  // Handle transcript updates from Deepgram
  const handleTranscript = useCallback((text: string, _isFinal: boolean) => {
    // Use setTimeout to defer the state update outside of render
    setTimeout(() => {
      setTranscript(text);
    }, 0);
  }, [setTranscript]);

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

      // If no active card yet and we detected a name, create the first card
      if (!activeCard && entities.name) {
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
      if (entities.isNewPerson && activeCard.name) {
        // Only switch if current card has a name (meaning we captured someone)
        createNewCard();
        // Reset transcript length tracking for new card
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
      
      if (entities.name && !activeCard.name) {
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
          // Check if action item already exists
          const exists = activeCard.actionItems.some(
            (existing) => existing.text.toLowerCase() === item.toLowerCase()
          );
          if (!exists) {
            addActionItem(item);
          }
        });
      }
    });
  }, [currentTranscript, currentCardStartIndex, isListening, activeCard, extractEntities, updateActiveCard, addActionItem, createNewCard]);

  const { 
    error: transcriptionError,
    connect: connectTranscription, 
    disconnect: disconnectTranscription,
    sendAudio 
  } = useDeepgramTranscription(handleTranscript);

  // Handle audio chunks - send to Deepgram
  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    sendAudio(chunk);
  }, [sendAudio]);

  const { isCapturing, error: captureError, audioLevels, startCapture, stopCapture } = useAudioCapture();

  // Handle errors via useEffect to avoid setState during render
  const error = captureError || transcriptionError;
  useEffect(() => {
    if (error && !showError) {
      setErrorMessage(error);
      setShowError(true);
    }
  }, [error, showError]);

  const handleStartSession = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Update app state first - but DON'T create a card yet
      // Card will be created when first person is detected
      startSession();
      
      // Connect to transcription service
      await connectTranscription();
      
      // Start audio capture (this will prompt for mic permission)
      await startCapture(handleAudioChunk);
      
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
    stopCapture();
    disconnectTranscription();
    endSession();
  }, [stopCapture, disconnectTranscription, endSession]);

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

  const isActive = isListening && isCapturing;

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
        {/* Active conversation card */}
        <ActiveCard
          person={activeCard}
          isListening={isActive}
          transcriptSnippet={currentTranscript.slice(currentCardStartIndex)}
        />

        {/* History list */}
        <HistoryGrid
          cards={historyCards}
          onLinkedInClick={handleLinkedInClick}
        />
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
