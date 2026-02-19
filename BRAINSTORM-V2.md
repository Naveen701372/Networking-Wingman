# Recall V2 - The Intelligent Companion

> Recall is not just an app. Recall is a being — empathetic, intelligent, subtle, calm. It understands you and your surroundings. It helps you recall what you may have forgotten by deeply understanding your context.

---

## MVP Status ✅

What we built:
- Real-time audio → Deepgram transcription → Perplexity LLM extraction
- Person detection, context switching, card-based UI
- Supabase auth + persistence, LinkedIn search
- Glass UI, pastel categories, reactive audio visualizer

---

## 1. LLM Provider Strategy

### Current: Perplexity API (sonar model via OpenAI-compatible endpoint)

### Thinking:
Perplexity works well for extraction because it's fast and cheap. But we should think about this as a configurable layer.

**Google Gemini Live API consideration:**
- Gemini Live is designed for real-time multimodal conversations — it can process audio streams directly
- This could eliminate the Deepgram → text → LLM pipeline and go audio → Gemini directly
- However: Gemini Live requires its own API key (Google AI Studio / Vertex AI), it's a separate service from Perplexity
- Perplexity doesn't proxy Gemini — they only expose their own models and some OpenAI models

**Decision: Make LLM provider configurable**
- Create an `llm-config.ts` that reads from env which provider to use
- Support: `perplexity` (current), `gemini`, `openai` as options
- Toggle via `LLM_PROVIDER=perplexity|gemini|openai` in `.env.local`
- Each provider implements the same extraction interface
- This lets us A/B test quality and cost

**For Gemini specifically:**
- Would need `GOOGLE_AI_API_KEY` env var
- Could use `@google/generative-ai` SDK
- Gemini 2.0 Flash has native audio understanding — could skip Deepgram entirely in future
- For now: keep Deepgram for transcription, make LLM extraction swappable

### Token/Cost Logging
- Log token usage per API call to terminal
- Track: provider, model, input tokens, output tokens, latency
- Simple console.log format for now, structured enough to grep

---

## 2. Recall as an Agent — Context Reconciliation

### Thinking:
The core insight is that extraction happens in real-time with partial info, but understanding improves over time. We need a background "thinking" process.

### The Reconciliation Agent
Instead of just extracting once, Recall periodically reviews the full conversation log and compares it against what's been extracted:

```
[Full Transcript Log] → Agent analyzes → [JSON tree of entities]
                                              ↓
                                    Compare with existing cards
                                              ↓
                              Identify: updates, merges, corrections
                                              ↓
                                    Apply changes smoothly
```

**How it works:**
1. Store full transcript with timestamps (not just snippets)
2. Every N seconds (or on significant new content), run a reconciliation pass
3. Agent builds a JSON tree: `{ people: [{ name, company, role, whatTheySaid, whatUserSaid }] }`
4. Compare against current cards
5. If confident (>90%): auto-apply changes, show subtle animation
6. If uncertain (60-90%): show suggestion pill — "Did you mean Naveen, not Navin?"
7. If low confidence: do nothing, wait for more context

**UI for suggestions:**
- Small, non-intrusive pill/toast at bottom of card
- "Recall thinks: This might be the same person as Naveen" → tap to merge
- Auto-dismiss after 10 seconds if ignored
- Smooth fade-in animation

**Speaker attribution without voice fingerprinting:**
- Analyze conversation patterns from text
- "I work at Google" → contact is speaking about themselves
- "You should check out..." → user is speaking
- "My name is..." → contact introducing themselves
- Build speaker labels from contextual clues in the transcript
- Voice fingerprinting is V3 — too complex for now, contextual analysis gets us 70% there

---

## 3. Event & Session Context

### Thinking:
Events are the natural grouping unit. A user goes to TechCrunch in the morning, a dinner mixer at night. Different contexts, different people.

### First-Time Daily Greeting
When user opens Recall for the first time that day:

> "Hey Navi 👋 How was [last event name]? You met some interesting people — [most notable contact name] from [company] seemed like a great connection. Ready to network today?"

**How we build this:**
- On app load, check last session date
- If new day: show greeting card (not a modal — a card at the top)
- Pull user's first name from Google auth profile
- Reference last session's most interesting contact (highest action items or longest conversation)
- Surface pending action items: "You mentioned sending a deck to Roman — done yet?"
- Keep it warm, one sentence, not a wall of text

**Event prompt:**
- After greeting, subtle prompt: "Where are we today?" with quick-select chips
- User can type event name or pick from recent
- Or just skip — Recall works without it, events just add organization

**This becomes a nudge when listening starts:**
- Before first person is detected, show the greeting/prompt
- Once conversation starts, it fades away naturally
- The nudge is voice-compatible: user can say "We're at TechCrunch" and Recall picks it up

---

## 4. Dynamic UI — Showing What's Happening Around You

### Thinking:
Recall isn't just for networking. It's for anyone who wants to understand their audio surroundings.

**Use cases beyond networking:**
- A comic performing a set → "Which jokes landed? What got laughs?"
- Friends cooking together → "What recipe did they mention? What was the ingredient?"
- A student in a lecture → "What were the key points?"
- A meeting → "What were the action items?"

**The UI should be dynamic based on context:**
- During a networking event: show person cards
- During a comedy set: show "moments" cards (funny reactions, audience response)
- During a meeting: show topic cards with action items
- During casual hangout: show conversation highlights

**For now (V2):** Focus on networking but architect the extraction prompt to be context-aware. The event type ("conference" vs "comedy show" vs "meeting") changes what Recall looks for.

---

## 5. Search & Voice Recall

### Thinking:
This is the killer feature. "I can't recall his name but he was from tech" — and Recall finds them.

### Combined Search Bar
- Text input + mic icon
- Type to filter cards in real-time
- Or speak naturally while listening is active

### Voice Query Detection
When listening is active, Recall needs to distinguish:
- User talking TO someone (conversation) → extract entities
- User talking TO Recall (query) → search and respond

**Detection signals:**
- "Recall, who was..." or "Hey Recall..."
- "I can't remember..." / "I can't recall..."
- Question directed at no one present
- Shift in tone/context from conversation to self-talk

**Search pipeline:**
1. Detect query intent
2. Parse into search filters (semantic, not keyword)
3. Search across: names, companies, roles, summaries, full transcripts
4. Rank by relevance
5. Highlight matching cards with smooth animation
6. Optional: brief audio response "Found 2 people from tech startups"

---

## 6. Smart Grouping

### Thinking:
Flat list of cards doesn't scale. After 50 contacts, you need structure.

### Dynamic Group-By Agent
An agent that looks at all contacts and finds interesting groupings:

- By company: "3 people from Google"
- By category: "5 Founders, 3 Investors"
- By event: "TechCrunch Disrupt — 12 contacts"
- By time: "This morning, Yesterday, Last week"
- By topic: "People who mentioned AI"
- By relationship: "People you promised follow-ups to"
- Creative: "People who love coffee" (if mentioned in conversation)

**UI: Grid-based cards**
- Same card style as person cards
- Group header card → tap to expand into person cards
- Smooth expand/collapse animation
- Agent suggests groupings, user can pin favorites

**During an event:** Show today's contacts in a live grid
**After event:** Show group-by suggestions

---

## 7. Gamification

### Thinking:
Keep it subtle. Not a game, but rewarding.

**All shown as cards in the same grid UI:**
- "Networking Streak: 5 days 🔥"
- "This Week: 12 new connections"
- "Follow-up Score: 80% ✅"
- "Super Connector: Met 5+ people at one event"

**Weekly recap card:**
> "This week you met 12 people across 3 events. Your most active day was Tuesday. You have 4 pending follow-ups."

---

## 8. Animation & UX Philosophy

> Every UI change should feel like a warm breath, not a slap.

- Card appears: gentle fade-in + slight upward slide
- Card updates: content morphs smoothly, no flash
- Search results: cards that don't match fade to 30% opacity
- Group expand: cards flow into position like water
- Suggestions: slide in from bottom, auto-dismiss
- Typing in search: real-time filter with 0 jank
- Everything: 200-300ms transitions, ease-out curves

---

## 9. Data Architecture

### Transcript Storage
```
Full text stored per session, segmented by:
- Timestamp (when it was said)
- Speaker label (user/contact/unknown — from contextual analysis)
- Linked person_card_id (which card this segment belongs to)
```

This gives us:
- Full searchable history
- Per-person conversation replay
- Context for reconciliation agent
- Data for voice query search

### Cost Tracking (Terminal Logs)
```
[Recall:LLM] provider=perplexity model=sonar tokens_in=450 tokens_out=120 latency=1.2s
[Recall:STT] provider=deepgram duration=5.2s cost_estimate=$0.002
```

---

## 10. Monetization Awareness (Not Implementing Yet)

**Free tier candidates:**
- 3 sessions/day
- 10 contacts/session
- Basic search
- 7-day transcript retention

**Premium candidates:**
- Unlimited sessions
- Voice recall queries
- Smart grouping
- Full transcript history
- Calendar sync
- Export to CRM

**Track in terminal:** API calls count, token usage, session duration — so we know the cost profile per user.

---

## 11. Future (V3+)
- Voice fingerprinting for speaker diarization
- Offline mode with local whisper model
- Calendar sync (Google Calendar)
- Telegram bot integration
- CRM export (HubSpot, Salesforce)
- Multi-device sync

---

## Priority Roadmap

### Phase 1: Context Foundation
- [ ] Full transcript storage with timestamps
- [ ] LLM provider config (toggle perplexity/gemini/openai)
- [ ] Token/cost logging in terminal
- [ ] Event context prompt on session start
- [ ] Daily greeting card

### Phase 2: Intelligence
- [ ] Reconciliation agent (periodic context analysis)
- [ ] Auto-correction with confidence scoring
- [ ] Suggestion pills for uncertain merges
- [ ] Contextual speaker attribution
- [ ] Smooth real-time UI updates on card changes

### Phase 3: Search & Recall
- [ ] Search/filter bar (text)
- [ ] Voice query detection
- [ ] Semantic search across transcripts
- [ ] Natural language filtering

### Phase 4: Organization
- [ ] Dynamic group-by agent
- [ ] Grid-based group cards
- [ ] Event-based organization
- [ ] Time-based views

### Phase 5: Delight
- [ ] Gamification cards
- [ ] Weekly recaps
- [ ] Smart follow-up nudges
- [ ] Animation polish pass

---

*Recall remembers so you don't have to.*
