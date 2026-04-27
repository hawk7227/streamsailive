# STREAMS VISUAL EDITOR — COMPLETE BUILD ORDER

## OVERVIEW
Total: 10 phases + 2 deployment checkpoints
Estimated: 3-4 weeks full implementation
Risk level: LOW (modular, non-destructive to chat)

---

## PHASE 0: PREP & VALIDATION (1 day)
**Goal:** Verify all existing files, confirm no conflicts

### 0.1 Verify existing files
```bash
git status
git log --oneline -5
npx tsc --noEmit
npm run build
```

### 0.2 Confirm routes don't conflict
- ✅ /visual-editor (new route, CLEAR)
- ✅ /api/visual-editor/files (new endpoint, CLEAR)
- Chat routes unaffected

### 0.3 Confirm chat features untouched
- ✅ /dashboard still works
- ✅ /streams still works
- ✅ /api/chat/* unaffected
- ✅ No shared UI components modified

### Deliverable
```
git commit -m "chore: prep visual editor project"
```

---

## PHASE 1: FOUNDATION — Layout & Real File I/O (2 days)

**ALREADY DONE** ✅
- ✅ `/src/app/visual-editor/page.tsx` (collapsible layout)
- ✅ `/src/app/api/visual-editor/files/route.ts` (file read/write)

### 1.1 Verify existing implementation
- [ ] Test file tree loads from API
- [ ] Test file read works (GET)
- [ ] Test file write works (PUT)
- [ ] Test sidebar collapse/expand toggle
- [ ] Test code editor textarea
- [ ] Test auto-save (2s debounce)

### 1.2 Build Option 1: Floating Side Panel Layout
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**Changes:**
```jsx
// Change from: layout with three columns
// To: floating panel on right side of chat

// New structure:
// ┌────────────────────────────────────────┐
// │          Chat (LEFT, FULL HEIGHT)     │
// │                                        │  ┌────────────┐
// │  [Messages, input, etc.]              │  │  Editor    │
// │                                        │  │ (Floating) │
// │                                        │  │            │
// └────────────────────────────────────────┘  └────────────┘
```

**CSS changes:**
- Remove full-height editor layout
- Add floating panel positioning (position: fixed or absolute)
- Add resize handle (drag to adjust width)
- Add close button (X button)
- Add minimize button

**State:**
- `[isFloatingOpen, setIsFloatingOpen]` — open/closed
- `[floatingWidth, setFloatingWidth]` — user-set width (persist to localStorage)
- `[floatingX, setFloatingX]` — user-set X position

**Features:**
- Draggable by header
- Resizable from right edge
- Minimize to corner
- Close to hide (click "Show Editor" to restore)
- Remembers size/position in localStorage

### Deliverable
```
git add src/app/visual-editor/page.tsx
git commit -m "feat: floating side panel layout for visual editor"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 2: LIVE PREVIEW — Real Rendering in iframe (3 days)

**Goal:** Show actual website rendered in phone frame, updates on file change

### 2.1 Add iframe rendering
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Replace placeholder "Preview loading..." with actual iframe
- iframe loads `/preview` route (or configurable URL)
- iframe height = 874px (iPhone 15 Pro Max)
- iframe width = 402px (actual device width)

**Implementation:**
```jsx
<iframe
  ref={iframeRef}
  src="/"  // Or /preview — configurable
  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
  style={{ width: 402, height: 874 }}
/>
```

### 2.2 Add HMR (Hot Module Replacement) webhook
**File:** `/src/app/api/visual-editor/hmr/route.ts` (NEW)

**What:**
- When file is saved, POST to `/api/visual-editor/hmr`
- Server sends `postMessage` to iframe
- iframe reloads or uses Fast Refresh

**Implementation:**
```ts
// When file saved:
// 1. Save file to disk
// 2. POST /api/visual-editor/hmr { filePath, content }
// 3. Iframe gets notification
// 4. Iframe calls `window.location.reload()` or triggers HMR

export async function POST(req: Request) {
  const { filePath, content } = await req.json();
  
  // Send to connected iframes via WebSocket or polling
  // For MVP: just return 200, iframe polls for changes
  
  return NextResponse.json({ reloaded: true });
}
```

### 2.3 Add iframe reload trigger
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- After saveFile() succeeds, reload iframe
- `iframeRef.current?.contentWindow?.location?.reload()`

**Implementation:**
```jsx
const saveFile = useCallback(async () => {
  // ... save logic ...
  if (res.ok) {
    setSaveStatus('saved');
    // RELOAD IFRAME
    setTimeout(() => {
      iframeRef.current?.contentWindow?.location?.reload();
    }, 100);
  }
}, [...]);
```

### 2.4 Add viewport selector (device presets)
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**Presets:**
```ts
const DEVICES = {
  iphone15max: { w: 402, h: 874, name: "iPhone 15 Pro Max" },
  iphone15: { w: 390, h: 844, name: "iPhone 15" },
  iphonese: { w: 375, h: 667, name: "iPhone SE" },
  ipad: { w: 820, h: 1180, name: "iPad Air" },
  desktop: { w: 1440, h: 900, name: "Desktop 1440px" },
};
```

**UI:**
- Dropdown in preview header: "iPhone 15 Pro Max ▼"
- Click to switch device
- Update iframe size dynamically
- Update iPhone frame dimensions (border-radius, notch position, etc)

### Deliverable
```
git add src/app/visual-editor/page.tsx
git add src/app/api/visual-editor/hmr/route.ts
git commit -m "feat: live preview iframe with device viewport selector"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 3: CLICK-TO-INSPECT — Element → Code Mapping (3 days)

**Goal:** Click element in preview → highlight exact code line in editor

### 3.1 Add data attributes to iframe content
**File:** `/src/lib/streams/ast/component-map.ts` (NEW)

**What:**
- Parse TSX into AST (Babel)
- Add `data-component-id="UUID"` to every JSX element
- Regenerate code with IDs injected
- Send ID map to iframe

**Implementation:**
```ts
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

export function injectComponentIds(code: string): {
  code: string;
  idMap: Map<string, { line: number; col: number; path: string }>;
} {
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const idMap = new Map();
  let idCounter = 0;

  traverse(ast, {
    JSXElement(path) {
      const id = `comp-${idCounter++}`;
      // Inject data-component-id attribute
      const attr = {
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name: 'data-component-id' },
        value: { type: 'StringLiteral', value: id },
      };
      path.node.openingElement.attributes.push(attr);
      
      // Map ID to source location
      idMap.set(id, {
        line: path.node.loc.start.line,
        col: path.node.loc.start.column,
        path: code.substring(0, 50), // simplified
      });
    },
  });

  const newCode = generate(ast).code;
  return { code: newCode, idMap };
}
```

### 3.2 Add postMessage listener in iframe
**File:** New script injected into iframe via iframe sandbox/srcdoc

**What:**
- iframe adds click listener to all elements
- On click: find closest element with `data-component-id`
- Send `postMessage` to parent: `{ type: 'elementClicked', id: '...' }`

**Implementation:**
```js
// Injected into iframe
window.addEventListener('click', (e) => {
  const el = e.target.closest('[data-component-id]');
  if (el) {
    const id = el.getAttribute('data-component-id');
    window.parent.postMessage({ type: 'elementClicked', id }, '*');
  }
});
```

### 3.3 Add postMessage handler in editor
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Listen for `postMessage` from iframe
- Get ID from message
- Look up line number in idMap
- Jump to that line in editor
- Highlight that line

**Implementation:**
```jsx
useEffect(() => {
  const handler = (e: MessageEvent) => {
    if (e.data.type === 'elementClicked') {
      const { id } = e.data;
      const location = idMap.get(id);
      if (location) {
        // Jump to line in editor
        editorRef.current?.setSelection({
          startLineNumber: location.line,
          startColumn: 1,
          endLineNumber: location.line,
          endColumn: 100,
        });
      }
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, [idMap]);
```

### 3.4 Add inspector panel
**File:** `/src/components/streams/InspectorPanel.tsx` (NEW)

**What:**
- Show selected element's properties
- Display: component name, className, inline styles, dimensions (W/H)
- Read from AST node (not DOM computed styles)

**Implementation:**
```jsx
export function InspectorPanel({ 
  selectedElementId, 
  idMap,
  code,
}: Props) {
  const element = idMap.get(selectedElementId);
  
  return (
    <div className="inspector-panel">
      <div className="inspector-section">
        <div className="label">Element</div>
        <div className="value">{element?.path}</div>
      </div>
      <div className="inspector-section">
        <div className="label">Line</div>
        <div className="value">{element?.line}</div>
      </div>
      {/* Add color picker, font size slider, spacing controls here (Phase 4) */}
    </div>
  );
}
```

### Deliverable
```
git add src/lib/streams/ast/component-map.ts
git add src/components/streams/InspectorPanel.tsx
git add src/app/visual-editor/page.tsx
git commit -m "feat: click-to-inspect element highlighting"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 4: PROPERTY EDITOR — Edit Colors, Fonts, Spacing (3 days)

**Goal:** Click element → show editable properties (color picker, font size, spacing)

### 4.1 Add property panel components
**Files:** 
- `/src/components/streams/PropertyPanel.tsx` (NEW)
- `/src/components/streams/ColorPicker.tsx` (NEW)
- `/src/components/streams/SpacingEditor.tsx` (NEW)

**What:**
- Color picker (click swatch → picker)
- Font size slider (12px - 48px)
- Font family dropdown (Sans, Serif, Mono)
- Padding/margin controls (4 inputs: top, right, bottom, left)
- Width/height inputs

**Implementation:**
```jsx
export function PropertyPanel({ selectedElement, onUpdate }: Props) {
  return (
    <div className="property-panel">
      <ColorPicker 
        label="Background"
        value={selectedElement?.backgroundColor}
        onChange={(color) => onUpdate('backgroundColor', color)}
      />
      
      <FontSizeSlider
        value={selectedElement?.fontSize}
        onChange={(size) => onUpdate('fontSize', size)}
      />
      
      <SpacingEditor
        padding={selectedElement?.padding}
        onChange={(padding) => onUpdate('padding', padding)}
      />
    </div>
  );
}
```

### 4.2 Wire property edits to AST mutations
**File:** `/src/lib/streams/ast/mutations.ts` (NEW)

**What:**
- When user changes color → mutate AST node's style prop
- Regenerate code with new value
- Update code in editor
- Trigger iframe reload

**Implementation:**
```ts
export function mutateProperty(
  ast: AST,
  componentId: string,
  property: string,
  value: string
): string {
  // Find node with data-component-id
  // Update its props (either className or style={})
  // Return new code
  
  traverse(ast, {
    JSXElement(path) {
      const attr = path.node.openingElement.attributes.find(
        a => a.name?.name === 'data-component-id'
      );
      if (attr?.value?.value === componentId) {
        // Mutate the style or className
        // For now: direct style mutation
        path.node.openingElement.attributes = [
          ...path.node.openingElement.attributes,
          createStyleAttribute(property, value),
        ];
      }
    },
  });

  return generate(ast).code;
}
```

### 4.3 Add visual feedback on property change
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- When property changes, update code immediately
- Mark file as dirty
- Auto-save timer resets
- Show "Saving..." status

### Deliverable
```
git add src/components/streams/PropertyPanel.tsx
git add src/components/streams/ColorPicker.tsx
git add src/components/streams/SpacingEditor.tsx
git add src/lib/streams/ast/mutations.ts
git add src/app/visual-editor/page.tsx
git commit -m "feat: property editor with color, font, spacing controls"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 5: MONACO EDITOR — VS Code-like Code Editor (2 days)

**Goal:** Replace textarea with Monaco editor (syntax highlighting, search, etc)

### 5.1 Install Monaco
```bash
npm install @monaco-editor/react
```

### 5.2 Replace textarea with Monaco
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Remove `<textarea>` component
- Add `<Editor>` from @monaco-editor/react
- Set language to 'typescript'
- Show line numbers
- Add minimap
- Add search/replace (Ctrl+H)

**Implementation:**
```jsx
import Editor from '@monaco-editor/react';

<Editor
  language="typescript"
  value={activeFileData?.content}
  onChange={(value) => {
    if (value) handleContentChange({ target: { value } } as any);
  }}
  options={{
    minimap: { enabled: true },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: '"Monaco", "Menlo", monospace',
  }}
  height="100%"
/>
```

### Deliverable
```
git add package.json (npm install)
git add src/app/visual-editor/page.tsx
git commit -m "feat: monaco editor with syntax highlighting"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 6: SAFE AREA INDICATORS — Notch & Home Bar Zones (1 day)

**Goal:** Show red warning zones for unsafe areas (notch, home indicator)

### 6.1 Add safe area overlay to iframe
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Add transparent red overlay on notch area (top 30px)
- Add transparent red overlay on home indicator area (bottom 34px)
- Add warning icons (⚠️)
- Add labels: "Unsafe area - don't place interactive elements"

**CSS:**
```css
.safe-area-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 0, 0, 0.7);
}

.safe-area-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 34px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 0, 0, 0.7);
}
```

### 6.2 Add toggle in header
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Checkbox: "Show safe areas"
- Default: ON (always show)
- Off: hide red zones

### Deliverable
```
git add src/app/visual-editor/page.tsx
git commit -m "feat: safe area indicators for notch and home bar"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 7: MEASUREMENT OVERLAYS — Show px Values (2 days)

**Goal:** Hover over element → show padding/margin/width/height labels

### 7.1 Add measurement display on hover
**File:** Injected into iframe

**What:**
- On hover: show measurement boxes around element
- Display px values for: margin, border, padding, width, height
- Use Chrome DevTools style layout
- Color-coded: margin (orange), border (yellow), padding (green), content (blue)

**Implementation:**
```js
// In iframe
document.addEventListener('mouseover', (e) => {
  const el = e.target;
  if (el.hasAttribute('data-component-id')) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    
    // Create measurement overlay
    const overlay = createMeasurementBox({
      rect,
      margin: styles.margin,
      padding: styles.padding,
      width: el.clientWidth,
      height: el.clientHeight,
    });
    
    document.body.appendChild(overlay);
  }
});
```

### 7.2 Add measurement details panel
**File:** `/src/components/streams/MeasurementPanel.tsx` (NEW)

**What:**
- When element selected, show detailed measurements:
  - Width / Height
  - Padding (T, R, B, L)
  - Margin (T, R, B, L)
  - Border (width, color, style)
  - Position (X, Y)
  - Rotation / Transform

### Deliverable
```
git add src/components/streams/MeasurementPanel.tsx
git add src/app/visual-editor/page.tsx
git commit -m "feat: measurement overlays with px values"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 8: IMAGE-TO-DESIGN ANALYZER — Screenshot Analysis (3 days)

**Goal:** Upload screenshot → AI extracts colors, fonts, spacing

### 8.1 Add image upload UI
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Button: "Upload design screenshot"
- Drag-and-drop area
- Accept PNG, JPG, WebP

### 8.2 Build image analysis API
**File:** `/src/app/api/visual-editor/analyze-image/route.ts` (NEW)

**What:**
- Receive image (base64)
- Call Claude API with vision
- Analyze: colors (hex + names), fonts (families, sizes, weights), spacing, layout
- Return: JSON with design specs

**Implementation:**
```ts
export async function POST(req: Request) {
  const { imageBase64 } = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
            },
            {
              type: 'text',
              text: `Analyze this screenshot and extract design specifications.
              
Return JSON:
{
  "colors": [{ "hex": "#...", "name": "...", "usage": "..." }],
  "typography": [{ "family": "...", "size": "...", "weight": "..." }],
  "spacing": { "margin": "...", "padding": "..." },
  "layout": "...",
  "elements": [{ "type": "...", "properties": {...} }]
}`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

### 8.3 Display analysis results
**File:** `/src/components/streams/DesignAnalysisPanel.tsx` (NEW)

**What:**
- Show extracted colors (swatches)
- Show fonts (samples)
- Show spacing values
- Show layout structure diagram

### Deliverable
```
git add src/app/api/visual-editor/analyze-image/route.ts
git add src/components/streams/DesignAnalysisPanel.tsx
git add src/app/visual-editor/page.tsx
git commit -m "feat: image-to-design analyzer with AI extraction"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 9: GITHUB INTEGRATION — Push Changes to Repo (2 days)

**Goal:** One-click push modified files to GitHub

### 9.1 Add GitHub authentication
**File:** `/src/lib/github.ts` (NEW)

**What:**
- Store GitHub token in session/context
- Prompt user for token on first use
- Verify token has `repo` scope

### 9.2 Build GitHub API client
**File:** `/src/lib/github.ts` (ADD)

**What:**
```ts
export async function pushToGitHub(
  owner: string,
  repo: string,
  branch: string,
  files: { path: string; content: string }[],
  commitMessage: string,
  token: string
) {
  // 1. Get current commit hash
  // 2. Create blob for each file
  // 3. Create tree with blobs
  // 4. Create commit
  // 5. Update branch ref
}
```

### 9.3 Add push UI
**File:** `/src/app/visual-editor/page.tsx` (UPDATE)

**What:**
- Input: GitHub owner
- Input: Repository name
- Input: Branch (default: main)
- Input: Commit message
- Button: "Push to GitHub"
- Show progress: "Pushing... 3/5 files"
- Show result: "✓ Pushed to main"

### Deliverable
```
git add src/lib/github.ts
git add src/app/visual-editor/page.tsx
git commit -m "feat: github integration for pushing changes"
git push origin main
# Verify Vercel green ✓
```

---

## PHASE 10: POLISH & KEYBOARD SHORTCUTS (1 day)

**Goal:** Add shortcuts, error handling, UX improvements

### 10.1 Add keyboard shortcuts
```
Cmd+S         → Save file
Cmd+K         → Search code
Cmd+Shift+P   → Command palette
Ctrl+/        → Toggle comment
Alt+Enter     → Format code
Escape        → Close panels
```

### 10.2 Add error boundaries
- Catch render errors
- Show "Editor crashed" with reload button
- Log to Sentry

### 10.3 Add loading states
- Show skeleton while loading file tree
- Show skeleton while rendering preview
- Show skeleton while analyzing image

### 10.4 Add animations
- Smooth panel transitions
- Smooth highlight animations
- Fade in/out for overlays

### Deliverable
```
git add src/app/visual-editor/page.tsx
git commit -m "chore: polish keyboard shortcuts, error handling, animations"
git push origin main
# Verify Vercel green ✓
```

---

## DEPLOYMENT CHECKPOINT 1: Preview Release (After Phase 4)

**Timing:** End of week 1-2

**What's ready:**
- ✅ Floating panel layout
- ✅ Live preview (device switching)
- ✅ Click-to-inspect
- ✅ Property editor (colors, fonts, spacing)
- ✅ Monaco editor

**Not ready:**
- ⏸️ Safe areas (Phase 6)
- ⏸️ Measurements (Phase 7)
- ⏸️ Image analyzer (Phase 8)
- ⏸️ GitHub push (Phase 9)

**Action:**
```bash
git tag v1.0-preview
git push origin v1.0-preview
# Announce: "Visual editor preview live at /visual-editor"
```

---

## DEPLOYMENT CHECKPOINT 2: Full Release (After Phase 10)

**Timing:** End of week 3-4

**What's ready:**
- ✅ All 10 phases complete
- ✅ All features working
- ✅ All keyboard shortcuts
- ✅ All error handling

**Action:**
```bash
git tag v1.0-release
git push origin v1.0-release
# Announce: "Visual editor fully launched"
# Update docs
# Send email to users
```

---

## IMPLEMENTATION CHECKLIST

### Pre-Phase 0
- [ ] Review BUILD_RULES.md
- [ ] Review FRONTEND_BUILD_RULES.md
- [ ] Confirm no conflicts with existing code
- [ ] Backup current state: `git stash`

### Phase 0
- [ ] Run verification checks
- [ ] Confirm chat routes clear
- [ ] Confirm no typecheck errors

### Phase 1
- [ ] Test file tree loading
- [ ] Test file read/write
- [ ] Test collapsible panels
- [ ] Test auto-save

### Phase 2
- [ ] Test iframe rendering
- [ ] Test HMR reload
- [ ] Test device switching
- [ ] Test safe area zones

### Phase 3
- [ ] Test element click detection
- [ ] Test postMessage flow
- [ ] Test line highlighting
- [ ] Test inspector panel

### Phase 4
- [ ] Test color picker
- [ ] Test font size slider
- [ ] Test spacing editor
- [ ] Test AST mutations
- [ ] Test code regeneration

### Phase 5
- [ ] Test Monaco install
- [ ] Test syntax highlighting
- [ ] Test search/replace
- [ ] Test keyboard bindings

### Phase 6
- [ ] Test safe area overlays
- [ ] Test toggle on/off
- [ ] Test visual clarity

### Phase 7
- [ ] Test measurement hover
- [ ] Test measurement panel
- [ ] Test detailed readouts

### Phase 8
- [ ] Test image upload
- [ ] Test AI analysis
- [ ] Test color extraction
- [ ] Test font extraction

### Phase 9
- [ ] Test GitHub auth
- [ ] Test push flow
- [ ] Test commit creation
- [ ] Test branch updates

### Phase 10
- [ ] Test all shortcuts
- [ ] Test error boundaries
- [ ] Test loading states
- [ ] Test animations
- [ ] Full regression test

---

## ESTIMATED TIMELINE

```
Phase 0:   1 day  (Prep)
Phase 1:   2 days (Layout + File I/O)     ✅ DONE
Phase 2:   3 days (Live Preview)
Phase 3:   3 days (Click-to-Inspect)
Phase 4:   3 days (Property Editor)
Phase 5:   2 days (Monaco Editor)
--------- CHECKPOINT 1: Preview Release ---
Phase 6:   1 day  (Safe Areas)
Phase 7:   2 days (Measurements)
Phase 8:   3 days (Image Analyzer)
Phase 9:   2 days (GitHub Push)
Phase 10:  1 day  (Polish)
--------- CHECKPOINT 2: Full Release -----

TOTAL: ~23 days (~4 weeks)
```

---

## RISK MITIGATION

**Risk:** Building so close to chat features → breaks chat

**Mitigation:**
- ✅ Separate route (`/visual-editor`)
- ✅ Separate API endpoints (`/api/visual-editor/*`)
- ✅ No shared state with chat
- ✅ No modifications to StreamsPanel
- ✅ No modifications to chat tabs
- ✅ Floating panel doesn't overlap chat

**Risk:** Large bundle size (Monaco, Babel, etc)

**Mitigation:**
- Dynamic import Monaco (lazy load)
- Ship Babel parser only in `/visual-editor` route
- Lazy load device presets
- Lazy load image analyzer

**Risk:** iframe communication (postMessage reliability)

**Mitigation:**
- Fallback to polling if postMessage fails
- Add retry logic for failed reloads
- Log all postMessage events for debugging

---

## SUCCESS CRITERIA

✅ All files saved to disk (verified by git ls-files)
✅ All files tracked (git status shows no untracked imports)
✅ TypeScript passes: `npx tsc --noEmit`
✅ Vercel green: all deployments pass
✅ Chat unaffected: /dashboard, /streams still work
✅ Editor functional: file tree, preview, inspector all working
✅ No console errors: all warnings resolved
✅ Mobile responsive: works on iPad (720px+)

---

## NEXT STEP

Ready to start Phase 1 verification + Phase 2 build?

Suggest:
1. **Verify Phase 1** (already done) — test file I/O
2. **Build Phase 2** (live preview) — 3 days
3. **Build Phase 3** (click-to-inspect) — 3 days
4. **Build Phase 4** (property editor) — 3 days
5. **Deploy Checkpoint 1** (preview release)

Should we proceed?
