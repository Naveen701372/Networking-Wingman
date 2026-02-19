'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PersonCard, ActionItem, PersonCategory } from '@/store/useAppStore';

export function useSupabase() {
  // Create a new session
  const createSession = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('sessions')
      .insert({ is_active: true })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return null;
    }
    return data.id;
  }, []);

  // End a session
  const endSession = useCallback(async (sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending session:', error);
    }
  }, []);

  // Create a person card
  const createPersonCard = useCallback(async (
    sessionId: string,
    card: Partial<PersonCard>
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from('person_cards')
      .insert({
        session_id: sessionId,
        name: card.name,
        company: card.company,
        role: card.role,
        category: card.category || 'other',
        summary: card.summary,
        linkedin_url: card.linkedInUrl,
        transcript: card.transcriptSnippet || '',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating person card:', error);
      return null;
    }
    return data.id;
  }, []);

  // Update a person card
  const updatePersonCard = useCallback(async (
    cardId: string,
    updates: Partial<PersonCard>,
    transcript?: string
  ): Promise<void> => {
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
    if (updates.linkedInUrl !== undefined) dbUpdates.linkedin_url = updates.linkedInUrl;
    if (transcript !== undefined) dbUpdates.transcript = transcript;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
      .from('person_cards')
      .update(dbUpdates)
      .eq('id', cardId);

    if (error) {
      console.error('Error updating person card:', error);
    }
  }, []);

  // Add action item
  const addActionItem = useCallback(async (
    personCardId: string,
    text: string
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from('action_items')
      .insert({
        person_card_id: personCardId,
        text,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding action item:', error);
      return null;
    }
    return data.id;
  }, []);

  // Load all person cards (for history)
  const loadPersonCards = useCallback(async (): Promise<PersonCard[]> => {
    const { data: cards, error: cardsError } = await supabase
      .from('person_cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (cardsError) {
      console.error('Error loading person cards:', cardsError);
      return [];
    }

    // Load action items for all cards
    const cardIds = cards.map(c => c.id);
    const { data: actionItems, error: actionsError } = await supabase
      .from('action_items')
      .select('*')
      .in('person_card_id', cardIds);

    if (actionsError) {
      console.error('Error loading action items:', actionsError);
    }

    // Map to PersonCard format
    return cards.map(card => ({
      id: card.id,
      sessionId: card.session_id || null,
      name: card.name,
      company: card.company,
      role: card.role,
      category: (card.category || 'other') as PersonCategory,
      summary: card.summary,
      linkedInUrl: card.linkedin_url,
      actionItems: (actionItems || [])
        .filter(a => a.person_card_id === card.id)
        .map(a => ({
          id: a.id,
          text: a.text,
          createdAt: new Date(a.created_at),
        })) as ActionItem[],
      transcriptSnippet: card.transcript?.slice(-200) || '',
      createdAt: new Date(card.created_at),
      isActive: false,
    }));
  }, []);

  return {
    createSession,
    endSession,
    createPersonCard,
    updatePersonCard,
    addActionItem,
    loadPersonCards,
  };
}
