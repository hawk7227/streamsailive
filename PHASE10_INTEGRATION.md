# PHASE 10 INTEGRATION GUIDE
## How to update ChatTab.tsx with persistence + features

---

## STEP 1: Update imports in ChatTab.tsx

Add these imports at the top:

```typescript
// Persistence v2
import {
  createChatSession,
  loadSessionMessages,
  saveMessage,
  editMessage,
  deleteMessage,
  loadChatSessions,
  withRetry,
} from '@/lib/streams/chat-persistence-v2';

// Components & hooks
import { MessageActions } from '@/components/streams/ChatMessageActions';
import { useMessage } from '@/hooks/useMessage';

// Supabase client
import { createClient } from '@supabase/supabase-js';
```

---

## STEP 2: Initialize Supabase client

In ChatTab component, add:

```typescript
// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get current user from auth
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;
```

---

## STEP 3: Replace localStorage with Supabase

**BEFORE (localStorage):**
```typescript
const [sessions, setSessions] = useState<Session[]>(() => {
  const saved = localStorage.getItem('streams_sessions');
  return saved ? JSON.parse(saved) : [];
});

useEffect(() => {
  localStorage.setItem('streams_sessions', JSON.stringify(sessions));
}, [sessions]);
```

**AFTER (Supabase):**
```typescript
const [sessions, setSessions] = useState<Session[]>([]);

useEffect(() => {
  if (!userId) return;
  
  loadChatSessions(supabase, userId).then(({ data, error }) => {
    if (!error && data) {
      setSessions(data);
    }
  });
}, [userId]);
```

---

## STEP 4: Load messages when session changes

Add to useEffect:

```typescript
useEffect(() => {
  if (!activeSession) return;
  
  loadSessionMessages(supabase, activeSession).then(({ data, error }) => {
    if (!error && data) {
      setMsgs(data.map(msg => ({
        id: msg.id,
        role: msg.role,
        text: msg.content,
        // ... other fields
      })));
    }
  });
}, [activeSession]);
```

---

## STEP 5: Update message sending with persistence

Replace current `handleSend` with version that saves to Supabase:

```typescript
async function handleSend() {
  const text = input.trim();
  if (!text || streaming || !userId || !activeSession) return;

  const userMsg = { id: crypto.randomUUID(), role: 'user' as const, text };
  setMsgs(prev => [...prev, userMsg]);
  setInput('');
  setStreaming(true);

  // Save user message to Supabase
  const { data: savedMsg, error: saveError } = await saveMessage(supabase, {
    sessionId: activeSession,
    role: 'user',
    content: text,
  });

  if (saveError) {
    console.error('Failed to save message:', saveError);
    // Fallback: keep in local state but show warning
  }

  // Continue with existing OpenAI streaming logic...
  const aiId = (Date.now() + 1).toString();
  
  // ... existing streaming code ...
  
  // Save assistant message when streaming completes
  await saveMessage(supabase, {
    sessionId: activeSession,
    role: 'assistant',
    content: responseText,
    modelUsed: route.model,
    routeReasons: route.reasons,
  });
}
```

---

## STEP 6: Add Message Actions component to rendered message

In the message rendering loop, add action buttons:

```typescript
{msgs.map(msg => (
  <div key={msg.id}>
    {/* Existing message display */}
    <div>{msg.text}</div>
    
    {/* NEW: Add message actions */}
    <MessageActions
      messageId={msg.id}
      role={msg.role}
      content={msg.text}
      onReact={async (reaction) => {
        // Will be handled by useMessage hook
      }}
      onRegenerate={async () => {
        // Re-send last user message
        const lastUserMsg = msgs
          .filter(m => m.role === 'user')
          .reverse()[0];
        if (lastUserMsg) {
          await handleSend(); // Re-send
        }
      }}
      onEdit={async (newContent) => {
        const { error } = await editMessage(supabase, msg.id, newContent);
        if (!error) {
          setMsgs(prev => 
            prev.map(m => m.id === msg.id ? { ...m, text: newContent } : m)
          );
        }
      }}
      onDelete={async () => {
        const { error } = await deleteMessage(supabase, msg.id);
        if (!error) {
          setMsgs(prev => prev.filter(m => m.id !== msg.id));
        }
      }}
    />
  </div>
))}
```

---

## STEP 7: Error handling and retry logic

The retry logic is built into `withRetry` wrapper. All persistence functions use it automatically:

```typescript
// This will automatically retry 3 times with exponential backoff
const { data, error, attempt } = await saveMessage(supabase, {...});

if (error) {
  console.error(`Failed after ${attempt} attempts:`, error);
  showErrorToast('Failed to save message. Try again.');
}
```

---

## STEP 8: Environment variables

Add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## STEP 9: Test checklist

- [ ] Messages persist after page refresh
- [ ] Loading previous session messages works
- [ ] Reactions (👍👎) appear and sync
- [ ] Regenerate button works
- [ ] Edit message updates it
- [ ] Delete message soft-deletes it
- [ ] Copy button copies to clipboard
- [ ] Retry logic handles network errors
- [ ] Mobile responsive at 390px
- [ ] All build rules pass

---

## TESTING WITH LOCALHOST

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Start local Supabase:
```bash
supabase start
```

3. Push schema:
```bash
supabase db push
```

4. Update `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

5. Run dev server:
```bash
npm run dev
```

---

## COMMON PATTERNS

### Pattern 1: Load data on component mount
```typescript
useEffect(() => {
  if (!userId || !sessionId) return;
  
  const load = async () => {
    const { data, error } = await loadSessionMessages(supabase, sessionId);
    if (!error) setMessages(data);
  };
  
  load();
}, [userId, sessionId]);
```

### Pattern 2: Auto-save with debounce
```typescript
const autoSaveRef = useRef<NodeJS.Timeout>();

const autoSave = useCallback((msg: Message) => {
  clearTimeout(autoSaveRef.current);
  autoSaveRef.current = setTimeout(async () => {
    await saveMessage(supabase, msg);
  }, 1000); // Save 1 second after last change
}, []);
```

### Pattern 3: Real-time subscriptions
```typescript
useEffect(() => {
  const unsubscribe = subscribeToSessionMessages(
    supabase,
    sessionId,
    (newMsg) => setMessages(prev => [...prev, newMsg]),
    (updatedMsg) => setMessages(prev => 
      prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
    ),
    (deletedId) => setMessages(prev => prev.filter(m => m.id !== deletedId))
  );
  
  return unsubscribe;
}, [sessionId]);
```

---

## BEFORE/AFTER CODE DIFF

To see the complete before/after, compare:
- `src/components/streams/tabs/ChatTab.tsx` (old)
- New version with persistence + features

Key changes:
- Remove localStorage imports
- Add Supabase persistence imports
- Add Supabase client init
- Replace message loading/saving logic
- Add MessageActions component
- Add useMessage hooks for reactions/editing
- Add error handling with retry logic

---

## NEXT: Full ChatTab.tsx implementation

Ready to update the actual ChatTab component? Follow these patterns exactly and test each section.
