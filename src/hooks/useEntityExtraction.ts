'use client';

import { useRef, useCallback } from 'react';
import { PersonCard, PersonCategory } from '@/store/useAppStore';

interface ExtractedEntities {
  name?: string;
  company?: string;
  role?: string;
  category?: PersonCategory;
  summary?: string;
  actionItems?: string[];
  isNewPerson?: boolean;
}

interface UseEntityExtractionReturn {
  extractEntities: (transcript: string, existingData?: Partial<PersonCard>) => Promise<ExtractedEntities | null>;
}

export function useEntityExtraction(): UseEntityExtractionReturn {
  const lastExtractionRef = useRef<number>(0);
  const pendingRef = useRef<boolean>(false);

  const extractEntities = useCallback(async (
    transcript: string, 
    existingData?: Partial<PersonCard>
  ): Promise<ExtractedEntities | null> => {
    // Debounce - don't extract more than once every 2 seconds
    const now = Date.now();
    if (now - lastExtractionRef.current < 2000) {
      return null;
    }

    // Don't run if already pending
    if (pendingRef.current) {
      return null;
    }

    // Extract earlier - after just 15 characters
    if (!transcript || transcript.trim().length < 15) {
      return null;
    }

    pendingRef.current = true;
    lastExtractionRef.current = now;

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          existingData: existingData ? {
            name: existingData.name,
            company: existingData.company,
            role: existingData.role,
            category: existingData.category,
            summary: existingData.summary,
          } : undefined,
        }),
      });

      if (!response.ok) {
        console.error('Entity extraction failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data.entities || null;

    } catch (error) {
      console.error('Entity extraction error:', error);
      return null;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  return { extractEntities };
}
