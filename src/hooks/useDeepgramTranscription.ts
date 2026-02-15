'use client';

import { useState, useRef, useCallback } from 'react';

interface UseDeepgramTranscriptionReturn {
  isConnected: boolean;
  transcript: string;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
}

export function useDeepgramTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
): UseDeepgramTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    setError(null);

    try {
      // Get API key from our backend
      const response = await fetch('/api/transcribe');
      const data = await response.json();
      
      if (!response.ok || !data.apiKey) {
        throw new Error(data.error || 'Failed to get API key. Check your DEEPGRAM_API_KEY in .env.local');
      }

      // Build WebSocket URL with API key in query params (more reliable than subprotocol)
      const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
      wsUrl.searchParams.set('model', 'nova-2');
      wsUrl.searchParams.set('language', 'en');
      wsUrl.searchParams.set('smart_format', 'true');
      wsUrl.searchParams.set('interim_results', 'true');
      wsUrl.searchParams.set('utterance_end_ms', '1000');
      wsUrl.searchParams.set('vad_events', 'true');
      wsUrl.searchParams.set('encoding', 'linear16');
      wsUrl.searchParams.set('sample_rate', '16000');
      wsUrl.searchParams.set('channels', '1');

      // Connect with Authorization header via custom headers isn't supported in browser WebSocket
      // So we use the token subprotocol approach
      const socket = new WebSocket(wsUrl.toString(), ['token', data.apiKey]);

      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        console.log('Deepgram connected');
        setIsConnected(true);
        
        // Send keep-alive every 8 seconds
        keepAliveRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 8000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
            const text = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;
            
            if (text) {
              setTranscript(prev => {
                if (isFinal) {
                  const newTranscript = (prev + ' ' + text).trim();
                  onTranscript(newTranscript, true);
                  return newTranscript;
                } else {
                  // Show interim results but don't save them
                  onTranscript((prev + ' ' + text).trim(), false);
                  return prev;
                }
              });
            }
          } else if (data.type === 'Metadata') {
            console.log('Deepgram metadata:', data);
          } else if (data.type === 'Error') {
            console.error('Deepgram error:', data);
            setError(data.message || 'Transcription error');
          }
        } catch (err) {
          console.error('Error parsing Deepgram message:', err);
        }
      };

      socket.onerror = (event) => {
        console.error('Deepgram WebSocket error:', event);
        setError('Connection to transcription service failed. Check your API key.');
      };

      socket.onclose = (event) => {
        console.log('Deepgram disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }

        // Provide helpful error messages based on close code
        if (event.code === 1008) {
          setError('Invalid API key. Please check your DEEPGRAM_API_KEY.');
        } else if (event.code === 1006) {
          setError('Connection lost. Please check your internet connection and API key.');
        }
      };

      socketRef.current = socket;

    } catch (err) {
      console.error('Failed to connect to Deepgram:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to transcription service');
    }
  }, [onTranscript]);

  const disconnect = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        // Send close frame
        socketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
      }
      socketRef.current.close();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setTranscript('');
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioData);
    }
  }, []);

  return {
    isConnected,
    transcript,
    error,
    connect,
    disconnect,
    sendAudio,
  };
}
