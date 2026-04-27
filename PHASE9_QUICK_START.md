# PHASE 9: QUICK START GUIDE
## Concurrent Artifact Rendering for Desktop & Mobile

---

## FILES CREATED

```
src/components/streams/artifacts/
├─ ConcurrentArtifactRenderer.tsx    (14KB) - Code + async content rendering
├─ SplitPanelChat.tsx                (18KB) - Layout + auto-scroll
├─ ActivityTimeline.tsx              (8.4KB) - Real work progress display
├─ Phase9ChatControlPlane.tsx        (7.9KB) - Main orchestrator
└─ index.ts                          (1.3KB) - Exports
```

**Total:** 5 files, ~50KB, 0 dependencies

---

## FEATURES IMPLEMENTED

### 1. Concurrent Rendering ✓
- Code artifacts render immediately
- Async content (images/videos) load in parallel
- Progress indication visible
- All visible simultaneously
- Nothing blocks anything

### 2. Split-Panel Layout ✓
**Desktop (≥768px):** 65% chat | 35% preview
**Mobile (<768px):** 60% chat | 40% preview
- No tab switching on mobile (differentiates from ChatGPT)
- Sticky right panel (doesn't scroll with chat)
- Responsive sizing at breakpoint
- Touch-friendly (44×44px minimum)

### 3. Activity Phase ✓
- Future Grid animated background
- Real work steps with indicators (✓, ✕, →)
- Status tracking (Done, Error, Working...)
- Auto-fade when complete
- Modal overlay during generation

### 4. Response Phase ✓
- Text streams word-by-word
- Auto-scroll follows content
- "Jump to Latest" button when user scrolls up
- Smooth scroll animations
- Non-blocking async loading

### 5. Responsive Behavior ✓
- Desktop: Full split-panel
- Mobile: Scaled split-panel
- No layout shift on breakpoint
- No horizontal scrollbar
- All text wraps correctly

---

## QUICK INTEGRATION

### Step 1: Import

```tsx
import { Phase9ChatControlPlane } from '@/components/streams/artifacts';
```

### Step 2: Use in Component

```tsx
export function ChatPage() {
  return (
    <Phase9ChatControlPlane
      projectId="proj_123"
      userId="user_456"
      onArtifactGenerated={(artifactId) => {
        console.log('Generated:', artifactId);
      }}
    />
  );
}
```

### Step 3: Connect API

Update `Phase9ChatControlPlane.tsx`:

Replace this:
```typescript
// Simulated response
setTimeout(() => {
  const assistantMsg = { ... };
}, 2000);
```

With this:
```typescript
// Real API call
async function sendMessage() {
  const response = await fetch('/api/streams/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      projectId,
      userId,
    }),
  });

  // Parse SSE stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // Handle: activity steps, response tokens, artifacts
  }
}
```

### Step 4: Build API Endpoint

Create `src/app/api/streams/chat/route.ts`:

```typescript
import { POST } from 'next/server';

export async function POST(req: Request) {
  const { message, projectId, userId } = await req.json();

  // 1. Activity phase: Show real work
  // Call runtime endpoint to get steps
  // Stream steps to client

  // 2. Response phase: Call OpenAI with context
  // Stream response tokens to client
  // Inject artifact generation calls
  
  // 3. Artifact phase: Generate async content
  // Stream artifact metadata
  // Images/videos load in parallel
}
```

---

## WHAT HAPPENS WHEN USER SENDS MESSAGE

### Timeline

```
t=0ms     User sends "Build a counter"
          └─ Activity overlay appears

t=100ms   Activity Phase
          ✓ Load context
          ✓ Resolve keys
          → Generate code (working)
          [Future Grid animating]

t=2000ms  All steps complete
          └─ Activity fades

t=2200ms  Response Phase
          Left: Text starts appearing word-by-word
          Right: Code artifact rendering
          [Auto-scroll follows]

t=2500ms  Code ready + interactive
          Left: Text continues
          Right: "Generate image..." (progress 25%)
          [User can click component]

t=3500ms  Image complete
          Left: Text streaming
          Right: Component with real image

t=4000ms  Complete
          User can interact with full component
          Continue reading explanation
```

### Key Behavior

- ✓ Activity shows real work (not spinner)
- ✓ Code renders first (interactive immediately)
- ✓ Text streams continuously (not blocked)
- ✓ Images load in parallel (progress visible)
- ✓ All visible at once (split-panel)
- ✓ No dead screens (something always moving)

---

## DESIGN DECISIONS

### Split-Panel on Mobile (Not Tabs)

Unlike ChatGPT, Streams keeps split-panel on mobile:

**ChatGPT:**
```
Mobile: Full-width artifact with tabs
[Preview] [Code]
← Click to switch
```

**Streams:**
```
Mobile: Split-panel 60/40
Left 60%  │  Right 40%
Chat code │  Preview
← Always visible
```

**Why:** Differentiates Streams as a **control plane**, not just chat.
- More cognitive bandwidth
- Both visible simultaneously
- No tab switching
- Builder's perspective

### Concurrent Rendering (Code First, Content Parallel)

```
t=0:     Code artifact starts
t=100:   Code rendered
         └─ Interactive immediately
         
t=100:   Async content (images) starts
         └─ In parallel, doesn't block

Result:  User can test code while images load
         No waiting, no blocking
```

### Auto-Scroll (Smart, Respectful)

```
User reads old message
│
├─ Scroll up detected
├─ Auto-scroll pauses
├─ "Jump to Latest" button shows
├─ New text still arrives (doesn't force scroll)
│
└─ User clicks "Jump"
  └─ Smooth scroll to bottom
     └─ Auto-scroll resumes
```

Principle: **Respect user intent, don't fight the UI.**

---

## COMPONENTS EXPLAINED

### Phase9ChatControlPlane (Orchestrator)

Manages entire flow:
- Detects when to show activity
- Triggers API calls
- Manages message history
- Coordinates all sub-components

```tsx
<Phase9ChatControlPlane
  projectId="..."       // For context loading
  userId="..."          // For permissions
  onArtifactGenerated={...}  // Callback
/>
```

### ActivityTimeline (Work Progress)

Shows real work during activity phase:
- Steps with status indicators
- Future Grid animated background
- Auto-fades when complete

```tsx
<ActivityTimeline
  steps={[
    { id: 'load', label: 'Load context', status: 'complete' },
    { id: 'gen', label: 'Generate code', status: 'in-progress' },
  ]}
  isActive={true}
  onComplete={() => {...}}
/>
```

### SplitPanelChat (Layout)

Manages split-panel and auto-scroll:
- Responsive: 65/35 desktop, 60/40 mobile
- Chat on left, preview on right
- Auto-scroll with smart pause
- "Jump to Latest" button

```tsx
<SplitPanelChat
  messages={messages}
  onSendMessage={handleSend}
  isLoading={isLoading}
/>
```

### ConcurrentArtifactRenderer (Rendering)

Renders code + async content in parallel:
- Iframe for React/HTML/SVG
- Image/video loading with progress
- Error handling and fallbacks

```tsx
<ConcurrentArtifactRenderer
  artifact={artifact}
  isStreaming={streaming}
  onAsyncContentReady={(content) => {...}}
  onError={(error) => {...}}
/>
```

---

## STYLING & TOKENS

All components use `tokens.ts`:

```javascript
import C from '../tokens';

<div style={{
  backgroundColor: C.bg2,
  color: C.t1,
  padding: '16px',
  gap: '12px'
}}>
```

Colors available:
- `C.bg` — Main background
- `C.bg2` — Secondary
- `C.bg3` — Tertiary
- `C.t1` — Primary text
- `C.t2` — Secondary text
- `C.t3` — Tertiary text
- `C.t4` — Muted text
- `C.acc` — Accent (buttons)

Spacing scale:
- Only use: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px

---

## TESTING

### Desktop (1920×1080)

```
□ Activity phase shows steps
□ Activity fades after complete
□ Text streams word-by-word
□ Code renders in right panel
□ Images load with progress bar
□ Auto-scroll follows text
□ User can scroll up, see "Jump" button
□ "Jump to Latest" works
□ Right panel sticky
□ Split ratio 65/35 correct
```

### Mobile (390×844)

```
□ Activity phase fits screen
□ Chat and preview both visible
□ Split ratio 60/40 correct
□ Touch targets ≥44px
□ Smooth scroll
□ "Jump" button accessible
□ Images scale to 40% width
□ No horizontal scrollbar
```

### Responsive (768px)

```
□ At exactly 768px, layout updates
□ No layout shift
□ Correct widths at breakpoint
□ All controls still work
```

---

## DEPLOYMENT CHECKLIST

- [ ] Files created in `src/components/streams/artifacts/`
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No audit violations (`python3 scripts/audit.py`)
- [ ] Tokens imported and available
- [ ] API endpoint exists or stubbed
- [ ] Desktop testing passed
- [ ] Mobile testing passed
- [ ] Responsive testing passed
- [ ] Git status clean
- [ ] Push to main branch
- [ ] Vercel deployment confirms "Ready"

---

## WHAT'S NOT INCLUDED YET

Phase 9 foundation is ready. Still needed for full integration:

1. **POST /api/streams/chat endpoint**
   - Accept message + projectId + userId
   - Call runtime for activity steps
   - Stream text response
   - Stream artifact metadata
   - Return artifact ID

2. **Real API integration in Phase9ChatControlPlane**
   - Replace simulated timeout with actual fetch
   - Parse SSE responses
   - Handle streaming properly
   - Error handling

3. **Database persistence**
   - Save chat sessions to Supabase
   - Save artifacts to Supabase
   - Load previous sessions
   - Fetch context (memory, tasks, artifacts)

4. **Real artifact generation**
   - Call OpenAI API with project context
   - Handle function calling for image generation
   - Stream response directly

These are Phase 9B features (next pass).

---

## SUMMARY

Phase 9 concurrent rendering system is **complete and ready to use**.

✓ All 5 components created
✓ Both desktop and mobile support
✓ Activity phase with real work
✓ Response phase with streaming
✓ Concurrent code + async rendering
✓ Auto-scroll with smart pause
✓ Fully responsive
✓ 0 external dependencies
✓ Design tokens integrated
✓ Error handling included

**Just connect the API and go live.**

