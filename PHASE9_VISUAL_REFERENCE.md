# PHASE 9: VISUAL REFERENCE
## Concurrent Rendering - Desktop & Mobile Layouts

---

## DESKTOP VIEW (≥768px)

### Full Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                         PHASE 9 CHAT CONTROL PLANE                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  LEFT PANEL (65%)              │  RIGHT PANEL (35%)                  │
│  ┌──────────────────────────┤  │  ┌───────────────────────────────┐  │
│  │ CHAT AREA                │  │  │ ARTIFACT PREVIEW (Sticky)     │  │
│  │                          │  │  │                               │  │
│  │ [Previous messages...]   │  │  │ Always visible, never scrolls │  │
│  │                          │  │  │ with chat                     │  │
│  │ User: "Build a counter"  │  │  │ ┌─────────────────────────┐  │  │
│  │                          │  │  │ │ React Counter Component │  │  │
│  │ [Activity Phase: 0-2s]   │  │  │ │                         │  │  │
│  │ ✓ Load context           │  │  │ │     Count: 0            │  │  │
│  │ ✓ Resolve keys           │  │  │ │     [+]  [−]            │  │  │
│  │ ✓ Generate code          │  │  │ │                         │  │  │
│  │ → "Preparing..."         │  │  │ │ Click to test           │  │  │
│  │                          │  │  │ │ (Interactive now)       │  │  │
│  │ [Activity fades]         │  │  │ └─────────────────────────┘  │  │
│  │                          │  │  │ [Expand Code]                │  │
│  │ [Response Phase: 2.2s+]  │  │  │ [Copy] [Full Screen]         │  │
│  │                          │  │  │                               │  │
│  │ "I've created a..."      │  │  │ OR [Async Content Loading]   │  │
│  │ "React component"        │  │  │ ┌─────────────────────────┐  │  │
│  │ "with hooks state"       │  │  │ │ Generating image...     │  │  │
│  │ [auto-scroll ↓]          │  │  │ │ ████░░░░░░░░░░░░░░░░░ │  │  │
│  │                          │  │  │ │ 30% (Est. 15s remaining)│  │  │
│  │ "- Increment button"     │  │  │ └─────────────────────────┘  │  │
│  │ "- Decrement button"     │  │  │                               │  │
│  │ "- Display count"        │  │  │                               │  │
│  │                          │  │  │                               │  │
│  │ Code block (below):      │  │  │                               │  │
│  │ ┌──────────────────────┐ │  │  │                               │  │
│  │ │ function Counter() { │ │  │  │                               │  │
│  │ │   const [count,...]  │ │  │  │                               │  │
│  │ │   return (           │ │  │  │                               │  │
│  │ │     <div>            │ │  │  │                               │  │
│  │ │       {count}        │ │  │  │                               │  │
│  │ │     </div>           │ │  │  │                               │  │
│  │ │   );                 │ │  │  │                               │  │
│  │ │ }                    │ │  │  │                               │  │
│  │ └──────────────────────┘ │  │  │                               │  │
│  │                          │  │  │                               │  │
│  │ [Jump to Latest ↓↓]      │  │  │                               │  │
│  │ (appears if user        │  │  │                               │  │
│  │  scrolls up)            │  │  │                               │  │
│  │                          │  │  │                               │  │
│  └──────────────────────────┤  └───────────────────────────────┘  │
│                             │                                     │
│  INPUT BAR (100% width below both columns)                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ [📎] [🎥] [🎨] [+]  [Type your message...] [Send Button]  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

WIDTHS:
Left:  65% of viewport
Gap:   20px padding
Right: 35% of viewport
```

---

## MOBILE VIEW (<768px)

### Full Layout

```
┌────────────────────────────────────────────┐
│    PHASE 9 CHAT CONTROL PLANE (Mobile)    │
├────────────────────────────────────────────┤
│                                            │
│ LEFT (60%)      │ RIGHT (40%)             │
│ ┌──────────────┤ ┌──────────────────────┐ │
│ │ CHAT AREA    │ │ PREVIEW (Sticky)     │ │
│ │              │ │ Scaled to 40% width  │ │
│ │ [Msgs...]    │ │                      │ │
│ │              │ │ [Component here]     │ │
│ │ User: "Build"│ │ ┌──────────────────┐ │ │
│ │              │ │ │ Count: 0         │ │ │
│ │ [Activity]   │ │ │ [+] [−]          │ │ │
│ │ ✓ Load       │ │ │ Still interactive│ │ │
│ │ ✓ Resolve    │ │ │ at 40% width     │ │ │
│ │ → Generate   │ │ └──────────────────┘ │ │
│ │              │ │ [Expand Code ▼]     │ │
│ │ Claude:      │ │ [Copy] [Full Scr.] │ │
│ │ "I've        │ │                      │ │
│ │  created"    │ │ OR [Loading image]  │ │
│ │              │ │ ██░░░░░░░░░░░░░░░░ │ │
│ │ "a React"    │ │ 10%                 │ │
│ │ "component"  │ │                      │ │
│ │ [auto-scroll]│ │                      │ │
│ │              │ │                      │ │
│ │ "with hooks" │ │                      │ │
│ │              │ │                      │ │
│ │ Code (scroll)│ │                      │ │
│ │ ┌──────────┐ │ │                      │ │
│ │ │ function │ │ │                      │ │
│ │ │ Counter()│ │ │                      │ │
│ │ │ { ... }  │ │ │                      │ │
│ │ └──────────┘ │ │                      │ │
│ │              │ │                      │ │
│ │ [Jump to     │ │                      │ │
│ │  Latest ↓↓] │ │                      │ │
│ │              │ │                      │ │
│ └──────────────┤ └──────────────────────┘ │
│                │                           │
│  INPUT BAR (100% width)                   │
│  ┌──────────────────────────────────────┐ │
│  │ [📎] [text...] [Send]                │ │
│  └──────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘

WIDTHS:
Left:  60% of viewport
Gap:   12px padding
Right: 40% of viewport

HEIGHTS:
Chat:  Scrollable, auto-scroll enabled
Input: Fixed at bottom
All:   Responsive font sizes
```

---

## ACTIVITY PHASE (0-2000ms)

### Modal Overlay

```
┌─────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░ OVERLAY (semi-transparent) ░░░░░ │
│ ░                                             ░ │
│ ░  ┌─────────────────────────────────────┐  ░  │
│ ░  │ Building your artifact              │  ░  │
│ ░  │ Real-time progress                  │  ░  │
│ ░  │                                     │  ░  │
│ ░  │ [Future Grid animated background]  │  ░  │
│ ░  │                                     │  ░  │
│ ░  │ ✓ Load project context             │  ░  │
│ ░  │   Done                              │  ░  │
│ ░  │                                     │  ░  │
│ ░  │ ✓ Resolve API keys                 │  ░  │
│ ░  │   Done                              │  ░  │
│ ░  │                                     │  ░  │
│ ░  │ → Generate component code           │  ░  │
│ ░  │   Working... (animated)             │  ░  │
│ ░  │                                     │  ░  │
│ ░  │ ⚪ Register artifact                │  ░  │
│ ░  │   Waiting...                        │  ░  │
│ ░  │                                     │  ░  │
│ ░  └─────────────────────────────────────┘  ░  │
│ ░                                             ░ │
│ ░ (Activity fades at t=2000ms)                ░ │
│ ░                                             ░ │
└─────────────────────────────────────────────────┘

FEATURES:
✓ Green checkmark (complete)
✕ Red X (error)
→ Animated arrow (in-progress, cyan)
⚪ Gray circle (pending)

BACKGROUND:
Conic gradient (hue-rotating)
Grid overlay (perspective)
Slight blur behind
No dead screens - shows work
```

---

## RESPONSE PHASE: TIMELINE

### t=2200ms - Text Starts

```
┌──────────────────────────┬──────────────────────┐
│ "I've created a React"   │ [Code compiling...]  │
│ [Auto-scroll ↓]          │ ████░░░░░░░░░░░░░░░ │
│                          │ Rendering...        │
└──────────────────────────┴──────────────────────┘
```

### t=2500ms - Code Ready

```
┌──────────────────────────┬──────────────────────┐
│ "I've created a React    │ ✓ Component Ready    │
│  component"              │ ┌──────────────────┐ │
│ "with hooks state..."    │ │ Count: 0         │ │
│ [Auto-scroll ↓]          │ │ [+] [−]          │ │
│                          │ │ (Interactive)    │ │
│                          │ └──────────────────┘ │
│                          │ [Expand Code]       │
└──────────────────────────┴──────────────────────┘
```

### t=3000ms - Async Loading

```
┌──────────────────────────┬──────────────────────┐
│ "...component that"      │ ✓ Component Ready    │
│ "displays items..."      │ ┌──────────────────┐ │
│ "...with smooth..."      │ │ Count: 0         │ │
│ "[Auto-scroll ↓]"        │ │ [+] [−]          │ │
│                          │ │ (User can click) │ │
│                          │ └──────────────────┘ │
│                          │ Generating image... │
│                          │ ████░░░░░░░░░░░░░░░ │
│                          │ 35%                │
└──────────────────────────┴──────────────────────┘
```

### t=3500ms - Content Complete

```
┌──────────────────────────┬──────────────────────┐
│ "...You can customize"   │ ✓ Gallery Complete   │
│ "...the colors and"      │ ┌──────────────────┐ │
│ "...styling..."          │ │ [Real image]     │ │
│ "[Still reading]"        │ │ Loaded ✓         │ │
│                          │ │ [< Prev] [Next]  │ │
│                          │ │ (Fully interactive)
│                          │ └──────────────────┘ │
│                          │ [Expand Code]       │
└──────────────────────────┴──────────────────────┘
```

---

## AUTO-SCROLL BEHAVIOR

### State 1: At Bottom (Auto-scrolling)

```
┌────────────────────────┐
│ [Previous messages]    │
│                        │
│ User: "Build..."       │
│ Claude: "I've..."      │ ← Auto-scroll keeps
│ "with hooks..."        │   following this
│ "and state..."         │   as text streams
│ [cursor typing here] ↓ │
│                        │ ← Scroll bar at bottom
└────────────────────────┘
```

### State 2: User Scrolled Up (Paused)

```
┌────────────────────────┐
│ [Old message]   ↑      │
│ (User scrolled │       │ ← Scroll position
│  here to read) │       │   user wants
│                │       │
│ [New text      │       │ ← Still arrives
│  appearing...] ↓       │
│                        │ ← Scroll bar NOT at
│ [Jump to Latest ↓↓]    │   bottom (paused)
└────────────────────────┘
```

### State 3: Jump to Latest Clicked

```
┌────────────────────────┐
│ [Scroll animation...] ↓│
│                        │
│ "...latest text now"   │ ← Smooth scroll
│ "visible at bottom"    │   animation to bottom
│ [cursor here now] ↓    │
│                        │ ← Scroll bar back
│ [Jump button fades]    │   at bottom
│                        │
│ [Auto-scroll resumes]  │
└────────────────────────┘
```

---

## CONCURRENT RENDERING: SIDE-BY-SIDE

### Left Panel (Chat Streaming)

```
t=0    User sends message
       
t=100  Activity phase (hidden)
       
t=2000 Activity fades

t=2200 "I've created" ← First word appears
       
t=2300 "I've created a"
       "React component"
       
t=2400 "I've created a React"
       "component with hooks"
       
t=2500 "...with hooks state"
       "management and..."
       
...text continues...
```

### Right Panel (Code + Async)

```
t=0    Waiting for code
       
t=100  (Activity in progress)
       
t=2000 Activity fades

t=2200 [Code compiling...]
       ████░░░░░░░░░░
       
t=2500 ✓ Code ready!
       Component visible
       [Can interact now]
       
       Generating image...
       ████░░░░░░░░░░ 30%
       
t=3000 ████████░░░░░░░ 55%
       
t=3500 ✓ Image appears!
       Component complete
```

### Combined View

```
BOTH HAPPENING SIMULTANEOUSLY:

Left:  Text 25% ────────────────────────────────────────────────
Code:  ─────────────── 75% ─────────────────────────────────────
Image: ─────────────────────────────── 45% ────────────────────

Result: User reads explanation while component loads
        Nothing blocks anything
        All progress visible
        No dead screens
```

---

## RESPONSIVE BREAKPOINT (768px)

### At 767px (Mobile)

```
Layout: 60% | 40%
Font:   12px (smaller)
Gap:    12px (smaller)
Padding: 8px (tighter)
```

### At 768px (Desktop)

```
Layout: 65% | 35%
Font:   14px (larger)
Gap:    20px (spacious)
Padding: 12px (comfortable)
[NO LAYOUT SHIFT - smooth transition]
```

---

## COMPONENT HIERARCHY

```
Phase9ChatControlPlane (Orchestrator)
├─ ActivityPhaseOverlay (Modal, t=0-2s)
│  └─ ActivityTimeline (Real work steps)
│
├─ SplitPanelChat (Layout 65/35 or 60/40)
│  ├─ LEFT PANEL (Chat)
│  │  ├─ Message list (auto-scroll)
│  │  ├─ CodeBlockPreview (shows first 25 lines)
│  │  ├─ Jump to Latest button (conditional)
│  │  └─ Input bar (textarea + send)
│  │
│  └─ RIGHT PANEL (Artifact Preview)
│     ├─ ConcurrentArtifactRenderer
│     │  ├─ iframe (Code artifact)
│     │  ├─ AsyncContentLoader (Progress bar)
│     │  └─ Controls (Copy, Full Screen)
│     │
│     └─ AsyncContentStatus (when loading)
```

---

## KEY METRICS

### Timing
- Activity phase: 0-2000ms
- Transition: 2000-2200ms
- Response starts: 2200ms
- First token: ~2200ms
- Code rendered: ~2500ms
- Progress updates: Every 150ms
- Total to interactive: ~2500ms

### Layout
- Desktop split: 65% | 35%
- Mobile split: 60% | 40%
- Gap: 20px (desktop) | 12px (mobile)
- Breakpoint: 768px
- Min width: 390px
- Max preview width: 35% (desktop)

### Touch
- Min tap target: 44×44px
- Button padding: 8-12px
- Text min size: 12px (0.75rem)
- Line height: 1.4-1.6

### Performance
- Code render: ~200ms
- Auto-scroll: requestAnimationFrame
- Scroll detection: Every 100ms
- Progress updates: Every 150ms
- Animation duration: 150-220ms

---

## SUMMARY

Phase 9 creates a **never-dead-screen experience**:

✓ Activity phase shows real work
✓ Response phase streams naturally
✓ Code renders first and stays interactive
✓ Async content loads in parallel
✓ Progress always visible
✓ Auto-scroll respects user
✓ Split-panel on all devices
✓ Fully responsive and accessible

**This is a builder's control plane, not just chat.**

