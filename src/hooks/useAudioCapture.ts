'use client';

import { useState, useRef, useCallback } from 'react';

export interface UseAudioCaptureReturn {
  isCapturing: boolean;
  error: string | null;
  startCapture: (onAudioChunk: (chunk: ArrayBuffer) => void) => Promise<void>;
  stopCapture: () => void;
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onAudioChunkRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);

  const startCapture = useCallback(async (onAudioChunk: (chunk: ArrayBuffer) => void) => {
    setError(null);
    onAudioChunkRef.current = onAudioChunk;

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      streamRef.current = stream;

      // Create AudioContext for raw PCM processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode to get raw audio data
      // Buffer size of 4096 gives us ~256ms chunks at 16kHz
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!onAudioChunkRef.current) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array (linear16 PCM)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp and convert to 16-bit
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        onAudioChunkRef.current(pcmData.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsCapturing(true);

    } catch (err) {
      console.error('Audio capture error:', err);
      
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow microphone access to use this feature.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else if (err.name === 'NotReadableError') {
          setError('Microphone is in use by another application. Please close other apps using the microphone.');
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError('Failed to start audio capture. Please try again.');
      }
    }
  }, []);

  const stopCapture = useCallback(() => {
    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    onAudioChunkRef.current = null;
    setIsCapturing(false);
  }, []);

  return {
    isCapturing,
    error,
    startCapture,
    stopCapture,
  };
}
