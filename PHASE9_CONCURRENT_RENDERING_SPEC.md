# PHASE 9: CONCURRENT ARTIFACT RENDERING
## Complete Specification for Desktop & Mobile

---

## OVERVIEW

**Phase 9 implements the Streams Chat Control Plane** with concurrent rendering of code artifacts and async content (images, videos).

**Not a chat. A builder's control center.**
- Real-time artifact generation with progress
- Live preview while content loads
- Split-panel design (desktop AND mobile)
- Activity phase shows real work
- Response phase streams naturally

---

## ARCHITECTURE

### Three-Phase Flow

```
PHASE 1: ACTIVITY (0-2000ms)
├─ Future Grid animated background
├─ Real work steps with checkmarks
├─ Parallel task visualization
└─ Shows no dead screens

PHASE 2: TRANSITION (2000-2200ms)
├─ Activity fades gracefully
└─ Response phase begins

PHASE 3: RESPONSE (2200ms+)
├─ Text streams word-by-word (left panel)
├─ Code renders immediately (right panel)
├─ Async content loads in parallel
├─ All visible simultaneously
└─ Auto-scroll with smart pause
```

---

## COMPONENTS

### 1. `Phase9ChatControlPlane` (Main Orchestrator)
**File:** `src/components/streams/artifacts/Phase9ChatControlPlane.tsx`

Manages entire chat flow:
- Coordinates activity phase → response phase
- Handles message history
- Triggers artifact generation
- Manages loading states

**Props:**
```typescript
interface Phase9ChatControlPlaneProps {
  projectId?: string;        // Project context ID
  userId?: string;           // Current user ID
  onArtifactGenerated?: (id: string) => void;
}
```

### 2. `ActivityTimeline` (Work Progress Display)
**File:** `src/components/streams/artifacts/ActivityTimeline.tsx`

Shows real work during activity phase:
- Future Grid animated background
- Step-by-step progress (✓, ✕, →)
- Status indicators (Done, Error, Working...)
- Auto-fade when complete

**Props:**
```typescript
interface ActivityTimelineProps {
  steps: ActivityStep[];        // Work steps
  isActive?: boolean;           // Show/hide
  onComplete?: () => void;      // When done
}

interface ActivityStep {
  id: string;
  label: string;                // "Load context", "Generate code", etc.
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  timestamp?: number;
}
```

**Example:**
```jsx
<ActivityTimeline
  steps={[
    { id: 'load', label: 'Load project context', status: 'complete' },
    { id: 'gen', label: 'Generate code', status: 'in-progress' },
    { id: 'reg', label: 'Register artifact', status: 'pending' },
  ]}
  isActive={true}
  onComplete={() => console.log('Done')}
/>
```

### 3. `SplitPanelChat` (Layout Manager)
**File:** `src/components/streams/artifacts/SplitPanelChat.tsx`

Handles split-panel layout and auto-scroll:

**Desktop (≥768px):**
```
┌─────────────────────────────────────────────────────┐
│ LEFT 65%          │  RIGHT 35%                      │
│ Chat messages     │  Artifact preview               │
│ Code blocks       │  Async content progress         │
│ Auto-scroll       │  (sticky, no scroll)            │
│                   │                                 │
└─────────────────────────────────────────────────────┘
```

**Mobile (<768px):**
```
┌────────────────────────────────────────────┐
│ LEFT 60%      │  RIGHT 40%                │
│ Chat          │  Preview (scaled down)    │
│ Messages      │  Still interactive        │
│ Code          │  Still visible            │
│               │                           │
└────────────────────────────────────────────┘
```

**Features:**
- Auto-scroll follows text during streaming
- Pauses if user scrolls up (respects intent)
- "Jump to Latest" button when paused
- Resume on scroll back to bottom
- Touch-friendly on mobile
- 44×44px minimum tap targets

**Props:**
```typescript
interface SplitPanelChatProps {
  messages: ChatMessage[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: ArtifactData[];
  isStreaming?: boolean;
}
```

### 4. `ConcurrentArtifactRenderer` (Parallel Loading)
**File:** `src/components/streams/artifacts/ConcurrentArtifactRenderer.tsx`

Renders code + async content simultaneously:

**Phase 1: Code Renders First**
- iframe created immediately
- React/HTML/SVG code injected
- Component interactive from start
- Progress bar hidden

**Phase 2: Async Content Loads**
- Images/videos load in parallel
- Progress bar shows status
- Component doesn't wait (placeholder shown)
- Progress updates: 0% → 100%

**Phase 3: Content Ready**
- Image/video replaces placeholder
- Smooth transition
- Component fully complete
- User can interact

**Props:**
```typescript
interface ConcurrentArtifactRendererProps {
  artifact: ArtifactData;
  isStreaming?: boolean;
  onAsyncContentReady?: (content: AsyncContent) => void;
  onError?: (error: string) => void;
}

interface ArtifactData {
  id: string;
  code: string;
  type: 'react' | 'html' | 'svg';
  asyncContent?: AsyncContent;
}

interface AsyncContent {
  type: 'image' | 'video' | 'none';
  url?: string;
  status: 'idle' | 'loading' | 'complete' | 'error';
  progress?: number; // 0-100
  error?: string;
}
```

---

## FLOW DIAGRAM

```
USER SENDS MESSAGE
        ↓
ACTIVITY PHASE STARTS (t=0)
├─ Activity overlay appears
├─ Future Grid animation shows
├─ Steps begin (pending → in-progress → complete)
├─ Real work happens in parallel
└─ At t=2000: All steps complete

TRANSITION (t=2000-2200)
├─ Activity fades out
└─ Prepare response rendering

RESPONSE PHASE (t=2200+)
├─ Message appears in chat
├─ Text starts streaming (word-by-word)
├─ Left panel: Auto-scroll follows text
├─ Right panel: Code artifact renders
│  └─ Interactive immediately
├─ Async content loads in parallel
│  ├─ Progress bar visible
│  └─ "Generating image..." status
├─ Content ready → appears in artifact
├─ User can interact with both
└─ Continue reading while component loads

COMPLETE (t=4000+)
├─ All text streamed
├─ All content ready
├─ User can test artifact
└─ Next message ready
```

---

## RESPONSIVE BEHAVIOR

### Desktop (≥768px)

```css
Left panel: 65% width
  - Chat messages fill area
  - Code blocks below messages
  - Auto-scroll follows text
  - Gap to right panel: 20px

Right panel: 35% width, sticky
  - Always visible
  - Artifact preview (code)
  - Progress bar for async content
  - Doesn't scroll independently
  - Updated live when code changes
```

**Breakpoint:** `@media (min-width: 768px)`

### Mobile (<768px)

```css
Left panel: 60% width
  - Chat messages fill area
  - Smaller text (12px)
  - Code scrollable horizontally if wide
  - Gap to right panel: 12px

Right panel: 40% width, sticky
  - Preview scaled to fit
  - Still interactive
  - Progress bar visible
  - Touch targets 44×44px minimum
  - Responsive font sizing
```

**Breakpoint:** `@media (max-width: 767px)`

### No Tab Switching on Mobile

Unlike ChatGPT, Streams keeps split-panel on mobile:
- Code visible in left panel
- Preview visible in right panel
- No tabs (Preview | Code)
- Both always accessible
- More cognitive bandwidth

This differentiates Streams as a **builder's control plane**, not just chat.

---

## AUTO-SCROLL LOGIC

### States

**1. User at Bottom**
```javascript
if (scrollTop + clientHeight >= scrollHeight - 100) {
  // Auto-scroll
  scrollTo({ top: scrollHeight, behavior: 'smooth' })
}
```

**2. User Scrolls Up**
```javascript
if (scrollTop < scrollHeight - clientHeight - 100) {
  // Show "Jump to Latest" button
  // Pause auto-scroll
  // Continue streaming (don't block)
}
```

**3. User Clicks "Jump to Latest"**
```javascript
scrollTo({ top: scrollHeight, behavior: 'smooth' })
hideJumpButton()
resumeAutoScroll()
```

### Threshold: 100px

Detects if user is "close enough" to bottom to continue auto-scrolling.

---

## CONCURRENT RENDERING TIMELINE

### Example: React Component + Image

```
t=0ms     User sends message
          "Build a gallery component with sample images"

t=100ms   ACTIVITY PHASE
          ✓ Load project context
          ✓ Resolve API keys
          → Generate component code (in-progress)
          [Future Grid background animating]

t=1500ms  [Activity steps complete]

t=2000ms  [Activity fades]

t=2100ms  RESPONSE PHASE
          Left: "I've created a gallery component..."
          Right: [Code artifact loading...]

t=2200ms  [First token arrives]
          Left: "I've created a gallery component"
               "with photo fetching..."
               [Auto-scroll follows]
          Right: [Code compiling...]

t=2500ms  [Code ready]
          Left: "...and image loading..."
          Right: ✓ Component visible
                 [Loading images...]
                 ████░░░░░░░░░░░░░ 25%

t=3000ms  [Text continues]
          Left: "...with smooth transitions..."
          Right: Component interactive
                 ████████░░░░░░░░░░ 60%
                 [User can click buttons]

t=3500ms  [Image complete]
          Left: "...You can customize..."
          Right: ✓ Image appears
                 Component fully functional
                 [User sees real content]

t=4000ms  [Response complete]
          All text streamed
          All content ready
          No blocking, no dead screens
```

**Key principle:** Everything progresses simultaneously.
- Text doesn't wait for code
- Code doesn't wait for images
- User can interact immediately
- Progress always visible

---

## CODE EXAMPLE: INTEGRATION

### Use Phase 9 in Your Component

```tsx
import { Phase9ChatControlPlane } from '@/components/streams/artifacts';

export function ChatPage() {
  return (
    <Phase9ChatControlPlane
      projectId="proj_123"
      userId="user_456"
      onArtifactGenerated={(artifactId) => {
        console.log('Generated artifact:', artifactId);
        // Save to database, track analytics, etc.
      }}
    />
  );
}
```

### Real API Integration (POST /api/streams/chat)

```typescript
// In Phase9ChatControlPlane.tsx
async function sendMessageToChat(message: string) {
  // Start activity phase
  setIsActivityPhase(true);
  
  // Call real endpoint
  const response = await fetch('/api/streams/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      projectId,
      userId,
    }),
  });

  // Stream activity steps
  const reader = response.body?.getReader();
  // Parse SSE stream, update activity steps
  
  // Stream response text + artifact
  // Update messages as text arrives
  // Render artifact as code loads
  // Show progress as images load
}
```

---

## STYLING & TOKENS

All components use design tokens from `tokens.ts`:

```javascript
// Colors
C.bg       // Main background
C.bg2      // Secondary (panels, cards)
C.bg3      // Tertiary (inputs, subtle)
C.t1       // Primary text
C.t2       // Secondary text
C.t3       // Tertiary text
C.t4       // Muted text
C.acc      // Accent (buttons, highlights)

// For example:
<div style={{ backgroundColor: C.bg2, color: C.t1 }} />
```

All spacing from scale: `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}`

```javascript
// Correct
style={{ gap: '12px', padding: '16px' }}

// Wrong
style={{ gap: '10px', padding: '15px' }}
```

---

## PERFORMANCE CONSIDERATIONS

### Code Artifact
- Renders in iframe (sandboxed)
- No blocking of chat text
- Interactive immediately (no wait)
- ~200ms first render

### Async Content
- Parallel to text streaming
- Non-blocking image/video load
- Progress updates every 150ms
- Error handling with fallback UI

### Text Streaming
- Word-by-word, no buffering
- Direct OpenAI → render (no RAF pacing)
- Auto-scroll smooth (requestAnimationFrame)
- Touch scroll responsive (event debounced)

### Responsive
- Desktop: Full split-panel
- Mobile: Scaled split-panel
- No layout shift on breakpoint
- Touch targets always ≥44px

---

## ERROR HANDLING

### Code Artifact Error
```javascript
// Iframe fails to render
{
  status: 'error',
  message: 'Failed to render code artifact'
}
// Shows: "Component failed to load"
// Action: Copy code, download, try full screen
```

### Image Load Error
```javascript
{
  type: 'image',
  status: 'error',
  error: 'Failed to load image'
}
// Shows: Error indicator in progress bar
// Action: User can retry or continue
```

### Video Load Error
```javascript
{
  type: 'video',
  status: 'error',
  error: 'Failed to load video'
}
// Shows: Error indicator
// Action: Suggest alternative format
```

---

## TESTING CHECKLIST

### Desktop (1920×1080)

- [ ] Activity phase shows all steps
- [ ] Activity fades after complete
- [ ] Response text streams word-by-word
- [ ] Code artifact renders in right panel
- [ ] Image loads in parallel (progress visible)
- [ ] Auto-scroll follows text
- [ ] User can scroll up, see "Jump" button
- [ ] "Jump to Latest" scrolls to bottom
- [ ] Right panel sticky (doesn't scroll with left)
- [ ] All controls clickable (copy, full screen)
- [ ] Split ratio correct (65/35)

### Mobile (390×844)

- [ ] Activity phase fits screen
- [ ] Response phase full width
- [ ] Split panels visible (60/40)
- [ ] Code and preview both visible
- [ ] Touch targets ≥44px
- [ ] Scroll smooth and responsive
- [ ] "Jump" button accessible
- [ ] Input bar accessible
- [ ] Images scale to 40% width
- [ ] No horizontal page scrollbar

### Responsive Transition (768px)

- [ ] At exactly 768px, switch from mobile to desktop
- [ ] No layout shift
- [ ] Correct width ratio (65/35 on desktop)
- [ ] Correct width ratio (60/40 on mobile)

---

## DEPLOYMENT

### Files Added
```
src/components/streams/artifacts/
  ├─ Phase9ChatControlPlane.tsx       (Main orchestrator)
  ├─ ActivityTimeline.tsx             (Work progress display)
  ├─ SplitPanelChat.tsx               (Layout + auto-scroll)
  ├─ ConcurrentArtifactRenderer.tsx   (Code + async loading)
  └─ index.ts                         (Exports)
```

### To Enable Phase 9

1. Update ChatTab.tsx to use `Phase9ChatControlPlane`:
```tsx
import { Phase9ChatControlPlane } from '@/components/streams/artifacts';

export function ChatTab() {
  return <Phase9ChatControlPlane projectId={...} />;
}
```

2. Ensure `tokens.ts` exports color tokens
3. Run audit: `python3 scripts/audit.py` → zero violations
4. Test on desktop and mobile
5. Push to Vercel, verify deployment

### API Endpoint Needed

POST `/api/streams/chat`

Accepts:
```json
{
  "message": "string",
  "projectId": "string",
  "userId": "string"
}
```

Returns (SSE):
```
event: activity
data: {"step": "...", "status": "..."}

event: response
data: {"token": "...", "artifacts": [...]}

event: complete
data: {"artifactId": "..."}
```

---

## SUMMARY: WHAT MAKES PHASE 9 SPECIAL

✓ **Activity phase** — Shows real work, not boring spinner
✓ **Concurrent rendering** — Code immediate, content parallel
✓ **Split-panel everywhere** — Desktop AND mobile (differentiates from ChatGPT)
✓ **Auto-scroll smart** — Pauses when user scrolls, resumes when ready
✓ **Preview always visible** — No tab switching
✓ **Never a dead screen** — Something always progressing
✓ **Responsive** — Works perfectly on any device
✓ **Project-aware** — Context from Phases 1-8 loaded
✓ **Control plane** — Not just chat, a builder's command center

This is **Streams Phase 9: Chat Control Plane.**

