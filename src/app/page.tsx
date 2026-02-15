'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useDeepgramTranscription } from '@/hooks/useDeepgramTranscription';
import { useEntityExtraction } from '@/hooks/useEntityExtraction';
import { ActiveCard } from '@/components/ActiveCard';
import { HistoryGrid } from '@/components/HistoryGrid';
import { SessionButton } from '@/components/SessionButton';
import { ListeningIndicator } from '@/components/ListeningIndicator';
import { ErrorModal } from '@/components/ErrorModal';

export default function Home() {
  const {
    isListening,
    activeCard,
    historyCards,
    currentTranscript,
    startSession,
    endSession,
    createNewCard,
    setTranscript,
    updateActiveCard,
    addActionItem,
  } = useAppStore();

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastTranscriptLengthRef = useRef(0);

  const { extractEntities } = useEntityExtraction();

  // Handle transcript updates from Deepgram
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    // Use setTimeout to defer the state update outside of render
    setTimeout(() => {
      setTranscript(text);
    }, 0);
  }, [setTranscript]);

  // Extract entities when transcript grows significantly
  useEffect(() => {
    const transcriptLength = currentTranscript.length;
    
    // Extract sooner - after just 30 characters of new content
    if (transcriptLength - lastTranscriptLengthRef.current < 30) {
      return;
    }
    
    if (!isListening || !activeCard) {
      return;
    }

    lastTranscriptLengthRef.current = transcriptLength;

    // Run extraction
    extractEntities(currentTranscript, activeCard).then((entities) => {
      if (!entities) return;

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
  }, [currentTranscript, isListening, activeCard, extractEntities, updateActiveCard, addActionItem]);

  const { 
    isConnected: isTranscribing, 
    error: transcriptionError,
    connect: connectTranscription, 
    disconnect: disconnectTranscription,
    sendAudio 
  } = useDeepgramTranscription(handleTranscript);

  // Handle audio chunks - send to Deepgram
  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    sendAudio(chunk);
  }, [sendAudio]);

  const { isCapturing, error: captureError, startCapture, stopCapture } = useAudioCapture();

  // Handle errors via useEffect to avoid setState during render
  const error = captureError || transcriptionError;
  useEffect(() => {
    if (error && !showError) {
      setErrorMessage(error);
      setShowError(true);
    }
  }, [error, showError]);

  const handleStartSession = useCallback(async () => {
    try {
      // Update app state first
      startSession();
      createNewCard();
      
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
    }
  }, [connectTranscription, startCapture, handleAudioChunk, startSession, createNewCard, endSession]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">NetworkMem</h1>
            <p className="text-gray-500 text-xs">Your AI networking companion</p>
          </div>
          <ListeningIndicator isActive={isActive} />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-4">
        {/* Active conversation card */}
        <ActiveCard
          person={activeCard}
          isListening={isActive}
          transcriptSnippet={currentTranscript}
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
