# PHASE 10 IMPLEMENTATION PLAN
## Features + Persistence for Streams Chat

---

## TASKS (Prioritized)

### TIER 1: CRITICAL (Day 1-2) - Prevents data loss

**[T1.1] Create Supabase chat tables migration**
- `streams_chat_sessions` (id, userId, workspaceId, projectId, topic, createdAt, updatedAt, messageCount)
- `streams_chat_messages` (id, sessionId, role, content, createdAt, updatedAt, deleted)
- `streams_chat_artifacts` (id, messageId, code, language, type, title, createdAt)
- `streams_chat_async_content` (id, artifactId, type, url, status, progress, createdAt, completedAt)
- Indexes on (userId, sessionId), (createdAt), (updatedAt)

**[T1.2] Update ChatTab.tsx with persistence**
- Auto-save messages on each send (debounced 1s)
- Load messages on mount from Supabase
- Replace localStorage with Supabase queries
- Handle Supabase auth errors gracefully

**[T1.3] Add error retry logic**
- Exponential backoff: 100ms → 1s → 5s
- Max 3 retries per failed request
- Show error to user after max retries
- Log to Sentry for monitoring

### TIER 2: FEATURES (Day 3-4) - User engagement

**[T2.1] Message reactions**
- Add 👍 👎 buttons below each message
- Store reactions in `streams_message_reactions` table
- Real-time sync (Supabase realtime)
- Show reaction count

**[T2.2] Regenerate button**
- Add 🔄 button to assistant messages
- Resend last user message to get new response
- Show loading state
- Keep old response in history (branching prep)

**[T2.3] Message editing**
- Add ✏️ button to user messages
- Modal or inline edit UI
- Save edited message
- Show "edited" indicator
- Regenerate assistant response automatically

**[T2.4] Copy to clipboard**
- Add 📋 button on code artifacts and text
- Show "Copied!" toast (2 second confirmation)
- Works for multi-line code

### TIER 3: FEATURES (Day 5) - Polish

**[T3.1] Conversation branching preparation**
- Add `branchId` to messages table
- Store alternative responses as separate message threads
- UI: "View alternatives" button on regenerated messages

**[T3.2] Conversation sharing**
- Add share button
- Generate shareable link with public access
- Show share modal with copy link

**[T3.3] Search conversation history**
- Text search across all user's conversations
- Filter by date range, model used
- Highlight matches in results

---

## FILES TO CREATE/MODIFY

### NEW FILES:
- `supabase/migrations/20260427_streams_chat_tables.sql` - Supabase schema
- `src/lib/streams/chat-persistence-v2.ts` - Enhanced persistence (retry logic, reactions, editing)
- `src/components/streams/ChatMessageActions.tsx` - Reaction + edit UI component
- `src/hooks/useMessageReactions.ts` - Reactions logic
- `src/hooks/useMessageEditing.ts` - Edit logic
- `src/hooks/useMessageClipboard.ts` - Copy to clipboard logic

### MODIFIED FILES:
- `src/components/streams/tabs/ChatTab.tsx` - Add persistence, reactions, regenerate, edit, copy
- `src/components/streams/artifacts/SplitPanelChat.tsx` - Add action buttons
- `.env.example` - Add Supabase URLs if needed

---

## IMPLEMENTATION APPROACH

### Pattern: Feature flags (optional rollout)
```typescript
const FEATURES = {
  PERSISTENCE: true,      // Critical
  RETRY_LOGIC: true,      // Critical
  REACTIONS: true,        // Day 3-4
  REGENERATE: true,       // Day 3-4
  MESSAGE_EDIT: true,     // Day 3-4
  COPY_CLIPBOARD: true,   // Day 3-4
  BRANCHING: false,       // Future
  SHARING: false,         // Future
  SEARCH: false,          // Future
};
```

### Database pattern: Soft deletes
```sql
-- Messages marked as deleted, not actually removed
UPDATE streams_chat_messages 
SET deleted = true, updatedAt = now() 
WHERE id = $1;

-- Queries filter out deleted messages by default
SELECT * FROM streams_chat_messages 
WHERE sessionId = $1 AND NOT deleted
ORDER BY createdAt;
```

### React pattern: Custom hooks for each feature
```typescript
// Each feature is isolated in its own hook
const useMessageReactions = (messageId: string) => { ... };
const useMessageEditing = (messageId: string) => { ... };
const useMessageClipboard = (text: string) => { ... };
const useMessageRegenerate = (sessionId: string, userMessageId: string) => { ... };
```

---

## BUILD RULES COMPLIANCE

✅ **All features must comply with:**
- `[S.1]` Spacing from scale: {4,8,12,16,20,24,32,40,48,64,80,96}
- `[T.8]` Font size minimum 12px
- `[S.8]` Z-index from scale: {10,100,200,300,400}
- `[M.1-2]` Animations: transform+opacity only, 150-220ms duration
- `[A.7]` Touch targets: 44×44 minimum
- `[C.1]` Contrast: 4.5:1 minimum (AA)
- `[K.1]` Keyboard navigation: All interactive elements reachable by Tab
- `[F.1]` Form inputs: Controlled components (value + onChange)
- `[M.7]` prefers-reduced-motion respected

---

## TESTING CHECKLIST

### Persistence:
- [ ] Chat persists after page refresh
- [ ] Messages load on mount
- [ ] Multi-device sync works (open in 2 tabs)
- [ ] Error handling: show "Offline" if no connection
- [ ] Auto-save doesn't hammer database (debounced)

### Reactions:
- [ ] Reaction buttons visible below message
- [ ] Click reaction adds it
- [ ] Multiple users' reactions shown
- [ ] Real-time sync (add reaction in one tab, see in other)

### Regenerate:
- [ ] Button visible on assistant messages
- [ ] Click regenerates response
- [ ] Old response kept for branching prep
- [ ] Loading state shown during regeneration

### Editing:
- [ ] Edit button visible on user messages
- [ ] Click opens edit UI
- [ ] Save updates message
- [ ] Shows "edited" indicator
- [ ] Auto-regenerates assistant response

### Copy:
- [ ] Copy button visible on code artifacts
- [ ] Click copies to clipboard
- [ ] Shows "Copied!" toast
- [ ] Works on mobile

---

## METRICS TO TRACK

After Phase 10 completion:
- [ ] Zero data loss (messages persist)
- [ ] Retry logic handles 80% of transient failures
- [ ] Reactions engaged on 30%+ of conversations
- [ ] Edit feature used on 10%+ of user messages
- [ ] Copy button clicked on 50%+ of artifacts

---

## DEPLOYMENT STRATEGY

### Step 1: Deploy schema first
```bash
supabase db push  # Create tables
```

### Step 2: Deploy persistence (feature flag OFF for others)
```typescript
const FEATURE_FLAGS = {
  PERSISTENCE: user.testing === true,  // Only test users
  ...
};
```

### Step 3: Verify it works with test users (1 day)

### Step 4: Enable for all users

### Step 5: Deploy features one at a time
- Day 1: Persistence
- Day 2: Retry logic
- Day 3: Reactions + Regenerate
- Day 4: Edit + Copy
- Day 5: Polish + testing

---

## SUCCESS CRITERIA

Phase 10 is DONE when:

✅ Zero test failures  
✅ Zero data loss in testing  
✅ All build rule violations fixed  
✅ Persistence works offline → online  
✅ Reactions real-time synced  
✅ Regenerate keeps history  
✅ Edit shows "edited" indicator  
✅ Copy works on mobile  
✅ Mobile at 390px viewport works  
✅ All components pass accessibility audit  
✅ TypeScript: zero errors  

---

Ready to build? Execute tasks in order: T1.1 → T1.2 → T1.3 → T2.1 → T2.2 → T2.3 → T2.4 → T3.x
