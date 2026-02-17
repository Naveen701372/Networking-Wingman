import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DbSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface DbPersonCard {
  id: string;
  session_id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  category: string;
  summary: string | null;
  linkedin_url: string | null;
  transcript: string;
  created_at: string;
  updated_at: string;
}

export interface DbActionItem {
  id: string;
  person_card_id: string;
  text: string;
  created_at: string;
}
