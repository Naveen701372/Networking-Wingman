'use client';

import { useState, useRef, useCallback } from 'react';

interface UseSimulatedTranscriptionReturn {
  isConnected: boolean;
  transcript: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
}

export function useSimulatedTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
): UseSimulatedTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  const fullTranscriptRef = useRef('');

  const connect = useCallback(async () => {
    setError(null);
    fullTranscriptRef.current = '';

    // Fetch the script from the file at runtime
    let scriptText: string;
    try {
      const res = await fetch('/api/sim-script');
      const data = await res.json();
      if (!res.ok || !data.script) {
        throw new Error(data.error || 'Failed to load script');
      }
      scriptText = data.script;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load simulation script');
      return;
    }

    setIsConnected(true);
    isRunningRef.current = true;

    const lines = scriptText.split('\n').filter(line => line.trim().length > 0);
    let lineIndex = 0;

    const feedNextLine = () => {
      if (!isRunningRef.current || lineIndex >= lines.length) {
        if (isRunningRef.current) {
          console.log('[Simulation] Script complete');
        }
        return;
      }

      const line = lines[lineIndex];
      const words = line.split(' ');
      let wordIndex = 0;

      const feedNextWord = () => {
        if (!isRunningRef.current) return;

        wordIndex++;
        const partial = words.slice(0, wordIndex).join(' ');

        if (wordIndex < words.length) {
          // Interim result — show partial sentence building up
          const interimTranscript = (fullTranscriptRef.current + ' ' + partial).trim();
          onTranscript(interimTranscript, false);
          const delay = 80 + Math.random() * 70;
          timeoutRef.current = setTimeout(feedNextWord, delay);
        } else {
          // Final result — full sentence done
          fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + line).trim();
          setTranscript(fullTranscriptRef.current);
          onTranscript(fullTranscriptRef.current, true);

          lineIndex++;
          const nextLine = lineIndex < lines.length ? lines[lineIndex] : '';
          const isNewConversation = nextLine.startsWith('Hey') || nextLine.startsWith('Oh hey') || nextLine.startsWith('Navi!');
          const pause = isNewConversation ? 2000 + Math.random() * 1000 : 300 + Math.random() * 500;
          timeoutRef.current = setTimeout(feedNextLine, pause);
        }
      };

      timeoutRef.current = setTimeout(feedNextWord, 100);
    };

    // Start after a brief initial delay
    timeoutRef.current = setTimeout(feedNextLine, 500);
  }, [onTranscript]);

  const disconnect = useCallback(() => {
    isRunningRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsConnected(false);
    setTranscript('');
    fullTranscriptRef.current = '';
  }, []);

  const sendAudio = useCallback((_audioData: ArrayBuffer) => {}, []);

  return {
    isConnected,
    transcript,
    error,
    connect,
    disconnect,
    sendAudio,
  };
}
