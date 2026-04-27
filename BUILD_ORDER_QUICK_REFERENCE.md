# BUILD ORDER — QUICK REFERENCE

## STATUS
- ✅ Phase 1 COMPLETE: Layout + File I/O
- ⏸️ Phase 2-10: Ready to build

## IMMEDIATE NEXT STEPS

### 1. Verify Phase 1 (5 min)
```bash
cd /home/claude/streamsailive
git status
npx tsc --noEmit
npm run dev
# Test: visit http://localhost:3000/visual-editor
# - File tree sidebar works
# - Code editor loads files
# - Auto-save works
# - Floating panel resizes
```

### 2. Read Build Order Document (10 min)
```bash
cat BUILD_ORDER_VISUAL_EDITOR.md
```

### 3. Start Phase 2: Live Preview (3 days)
**What you'll build:**
- iframe loads actual website
- Device viewport switching (iPhone/iPad/Desktop)
- HMR reload on file save
- Safe area overlays

**Files to create:**
```
/src/app/api/visual-editor/hmr/route.ts        (NEW)
/src/app/visual-editor/page.tsx                (UPDATE)
```

**Commands:**
```bash
# Build
git checkout -b feature/phase-2-live-preview
# ... make changes ...
git add src/
git commit -m "feat: live preview iframe with device switching"
git push origin feature/phase-2-live-preview

# Test
npm run dev
# Visit /visual-editor
# - See iPhone 15 Pro Max frame
# - iframe loads website
# - Change viewport → frame resizes
# - Save file → iframe reloads

# Deploy
git pull origin main
git merge feature/phase-2-live-preview
git push origin main
# Wait for Vercel green ✓
```

---

## PHASE BREAKDOWN

### FOUNDATION (Phase 0-1)
- **Phase 0:** Setup (1 day) — not started
- **Phase 1:** Layout + File I/O (2 days) — ✅ DONE
- **Total:** 3 days

### CORE (Phase 2-4)
- **Phase 2:** Live Preview (3 days) — next
- **Phase 3:** Click-to-Inspect (3 days)
- **Phase 4:** Property Editor (3 days)
- **Checkpoint 1:** Preview Release
- **Total:** 9 days

### POLISH (Phase 5-7)
- **Phase 5:** Monaco Editor (2 days)
- **Phase 6:** Safe Areas (1 day)
- **Phase 7:** Measurements (2 days)
- **Total:** 5 days

### ADVANCED (Phase 8-10)
- **Phase 8:** Image Analyzer (3 days)
- **Phase 9:** GitHub Push (2 days)
- **Phase 10:** Polish (1 day)
- **Checkpoint 2:** Full Release
- **Total:** 6 days

---

## RISK CHECKLIST

✅ Chat features isolated (separate routes)
✅ No shared state with chat
✅ No modifications to StreamsPanel
✅ Floating panel doesn't overlap chat
✅ Each phase is modular (can skip/reorder)
✅ Auto-save prevents data loss
✅ File I/O tested and working
✅ Build rules enforced before each push
✅ Vercel green before next phase
✅ No breaking changes to chat

---

## BUILD COMMAND TEMPLATE

For each phase:

```bash
# 1. Create feature branch
git checkout -b feature/phase-N-description

# 2. Implement changes
# ... code ...

# 3. Verify before commit
npx tsc --noEmit                    # Type check
npm run build                        # Build check
npm run dev                          # Manual test

# 4. Commit & push
git add src/
git commit -m "feat: phase N - description"
git push origin feature/phase-N-description

# 5. Create PR / merge to main
git pull origin main
git merge feature/phase-N-description
git push origin main

# 6. Wait for Vercel
# Check: https://vercel.com/streams
# Wait for green deployment

# 7. Verify live
# Visit: https://streamsailive.vercel.app/visual-editor
# Test core features

# 8. Tag if checkpoint
git tag v1.0-phase-N
git push origin v1.0-phase-N
```

---

## FILE STRUCTURE AFTER COMPLETION

```
src/
├── app/
│   ├── visual-editor/
│   │   ├── page.tsx                  (Main editor UI)
│   │   └── layout.tsx                (Route layout)
│   └── api/
│       └── visual-editor/
│           ├── files/
│           │   └── route.ts          (File I/O)
│           ├── hmr/
│           │   └── route.ts          (Hot reload)
│           ├── analyze-image/
│           │   └── route.ts          (Image → design)
│           └── github/
│               └── route.ts          (Push to repo)
├── components/
│   └── streams/
│       ├── InspectorPanel.tsx        (Element inspector)
│       ├── PropertyPanel.tsx         (Property editor)
│       ├── ColorPicker.tsx           (Color picker)
│       ├── SpacingEditor.tsx         (Spacing controls)
│       ├── MeasurementPanel.tsx      (Measurements)
│       └── DesignAnalysisPanel.tsx   (Image analysis)
└── lib/
    └── streams/
        └── ast/
            ├── component-map.ts      (Element ID mapping)
            ├── mutations.ts          (AST mutations)
            └── parser.ts             (Babel parser setup)
```

---

## DEPENDENCIES TO INSTALL

```bash
# Phase 1 (DONE)
# No new dependencies needed

# Phase 2 (Live preview)
# No new dependencies (iframe native)

# Phase 3 (Click-to-inspect)
npm install @babel/parser @babel/generator @babel/traverse

# Phase 5 (Monaco)
npm install @monaco-editor/react

# Phase 8 (Image analyzer)
# No new dependencies (uses Anthropic API)

# Phase 9 (GitHub)
npm install @octokit/rest

# TOTAL NEW DEPS
npm install @babel/parser @babel/generator @babel/traverse @monaco-editor/react @octokit/rest
```

---

## ENV VARS NEEDED

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000

# .env
ANTHROPIC_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
```

---

## TESTING CHECKLIST

### Phase 1
- [ ] File tree loads
- [ ] File read works
- [ ] File write works
- [ ] Sidebar collapses
- [ ] Auto-save triggers
- [ ] No typecheck errors
- [ ] Vercel green

### Phase 2
- [ ] iframe loads
- [ ] Device switching works
- [ ] Safe areas visible
- [ ] File save triggers reload
- [ ] Responsive at each size
- [ ] No typecheck errors
- [ ] Vercel green

### Phase 3
- [ ] Click detection works
- [ ] postMessage sends ID
- [ ] Code highlights
- [ ] Inspector shows properties
- [ ] No typecheck errors
- [ ] Vercel green

### Phase 4
- [ ] Color picker opens
- [ ] Color change updates code
- [ ] Font size slider works
- [ ] Spacing editor works
- [ ] Margin/padding controls work
- [ ] AST regeneration works
- [ ] No typecheck errors
- [ ] Vercel green

...and so on for each phase.

---

## DECISION POINTS

### Phase 2: iframe src
- Option A: `src="/"`  (home page)
- Option B: `src="/preview"` (dedicated preview route)
- **Decision:** Use `/` (your actual website)

### Phase 3: AST library
- Option A: `@babel/parser` (full featured, larger)
- Option B: `acorn` (lighter weight)
- **Decision:** Use Babel (more control)

### Phase 5: Editor
- Option A: `@monaco-editor/react` (full VS Code)
- Option B: `ace` (lighter)
- **Decision:** Use Monaco (better UX)

### Phase 8: Image → Design
- Option A: Claude API (GPT-4 Vision fallback)
- Option B: Claude only
- **Decision:** Claude only (already integrated)

### Phase 9: GitHub Push
- Option A: OAuth flow (user's GitHub account)
- Option B: App token (server controlled)
- **Decision:** OAuth (user controls their repo)

---

## SUCCESS METRICS

✅ Visual editor works without breaking chat
✅ File I/O is reliable (no data loss)
✅ Preview updates in <1s on save
✅ Click-to-inspect is accurate
✅ Property editor works for colors/spacing/fonts
✅ Monaco editor loads without lag
✅ Safe areas are visible and clear
✅ Measurements are accurate (within 1px)
✅ Image analyzer extracts designs correctly
✅ GitHub push works without errors
✅ Keyboard shortcuts responsive
✅ All animations smooth (60fps)
✅ Mobile responsive (iPad works)
✅ Zero chat interference

---

## ROLLBACK PLAN

If anything breaks:

```bash
# Option 1: Revert last commit
git revert HEAD
git push origin main

# Option 2: Go back to main
git reset --hard origin/main
git push origin main -f

# Option 3: Restore from backup
git checkout phase-N-1
# ... test ...
git push origin main

# Never:
# - Delete files in production
# - Push without testing
# - Merge PR without green Vercel
# - Skip verification steps
```

---

## READY?

See BUILD_ORDER_VISUAL_EDITOR.md for full details.

Start Phase 2 now? Or review build order first?
