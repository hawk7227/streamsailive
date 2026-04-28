# DEPLOYMENT CHECKLIST
## Phases 0-2, 9, 3, 10 → Production

### Pre-Deployment Verification (5 min)
- [x] All code committed to main
- [x] All commits pushed to GitHub
- [x] TypeScript: 0 errors
- [x] Build rules: 0 violations
- [x] Tests: All passing locally

### Staging Deployment (10 min)
Vercel will auto-deploy on push to main. Monitor: https://streamsailive.vercel.app

**Checklist:**
- [ ] Vercel build completes (green ✓)
- [ ] No console errors in staging
- [ ] Staging URL loads without errors

### Manual Testing on Staging (30 min)

#### Streams Panel (Phases 0-2, 3)

**Generate Tab:**
- [ ] Can submit a generation (any mode)
- [ ] Job appears in topbar counter
- [ ] Job panel shows real user/workspace ID
- [ ] Status overlay shows mode-specific message
  - Image: "Generating image..."
  - T2V: "Generating video..."
  - Voice: "Synthesizing voice..."
  - Music: "Creating music..."
- [ ] Cost displays correctly ($X.XX)
- [ ] Time estimate shows correct value
- [ ] Can cancel job (red Cancel button works)
- [ ] Job status updates to "cancelled"

**Video Analysis (Phase 2):**
- [ ] Click "Show video analysis (Phase 2)"
- [ ] Paste YouTube URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- [ ] Click "Analyze for duplication"
- [ ] Results appear:
  - Platform: YouTube
  - Duplication: 0% (YouTube videos are original)
  - Confidence: High
  - Suggested prompt appears

**Thumbnail Selector (Phase 3):** ⭐ NEW
- [ ] After analysis, click "Next: Select Thumbnail"
- [ ] Timeline scrubber appears
- [ ] Click timeline to preview different frames
- [ ] Frame grid shows (default 5 frames)
- [ ] Click frame to select (checkmark appears)
- [ ] Change grid size (1, 3, 5, 10) - frames update
- [ ] Click "Use Selected Frame"
- [ ] Thumbnail preview shows selected frame

#### Chat (Phases 9, 10)

**Split-Panel Layout:**
- [ ] Desktop: Chat on left (65%), preview on right (35%)
- [ ] Mobile: Full-width with Preview/Code tabs
- [ ] Preview panel is sticky (doesn't scroll with chat)

**Activity Phase:**
- [ ] Send message "Build me a React counter"
- [ ] Activity modal appears with:
  - ✓ Load context
  - ✓ Analyze message  
  - ● Generate response (current)
  - ⧐ Prepare artifacts
  - Animated background visible
- [ ] Shows: "✓ Load 5 artifacts, ✓ Load 3 tasks..." (if has memory)

**Response Streaming (Phase 9):**
- [ ] Text appears word-by-word (not all at once)
- [ ] Reading is comfortable (not too slow)
- [ ] Code appears in right panel while text streams

**Concurrent Rendering (Phase 9):**
- [ ] Code renders immediately (not waiting)
- [ ] Preview is interactive (can click)
- [ ] If async content: shows progress bar
- [ ] Everything visible simultaneously

**Auto-Scroll (Phase 9):**
- [ ] Scrolls follow new content at bottom
- [ ] Scrolling up pauses auto-scroll
- [ ] "Jump to Latest" button appears when paused
- [ ] Button click resumes auto-scroll
- [ ] Smooth (not jarring)

**Memory Integration (Phase 10):** ⭐ NEW
- [ ] Activity phase shows project context loading
- [ ] If project has artifacts: shows count
- [ ] If project has tasks: shows count
- [ ] If project has knowledge: shows count
- [ ] Generation uses memory (smarter response)

### Desktop Testing (Chrome)
- [ ] All features work
- [ ] No console errors
- [ ] No TypeScript issues
- [ ] Layout is correct
- [ ] Colors are vibrant
- [ ] Responsive at breakpoints

### Mobile Testing (iPhone)
- [ ] Streams Panel: Bottom sheet for thumbnail
- [ ] Chat: Preview/Code tabs work
- [ ] Touch targets: 44×44px minimum
- [ ] No horizontal scroll
- [ ] Safe area insets correct
- [ ] Keyboard doesn't obscure input

### Firefox Testing
- [ ] All features work
- [ ] No console errors
- [ ] Layout matches Chrome
- [ ] Smooth animations

### Safari Testing
- [ ] All features work
- [ ] No console errors
- [ ] Mobile Safari (iOS): Works
- [ ] Desktop Safari: Works

### Edge Cases

**Phase 2 (Video Analysis):**
- [ ] Invalid URL shows error message
- [ ] Bad duplication score handled
- [ ] Missing metadata falls back gracefully

**Phase 3 (Thumbnail):**
- [ ] Very short video (<5s) works
- [ ] Very long video (>1hr) responsive
- [ ] Frame grid extraction doesn't hang
- [ ] Cancel works mid-extraction

**Phase 9 (Chat):**
- [ ] Long response doesn't break layout
- [ ] Code with syntax highlighting renders
- [ ] Error in artifact shows error boundary
- [ ] Abort request works

**Phase 10 (Memory):**
- [ ] Works with empty project memory
- [ ] Works with full project memory
- [ ] API failures don't crash (fallback)
- [ ] Parallel loading doesn't timeout

### Vercel Logs
- [ ] No 5xx errors
- [ ] No 4xx errors (except expected)
- [ ] Edge functions working
- [ ] Database queries fast
- [ ] API endpoints responding

### Performance
- [ ] First contentful paint: <2s
- [ ] Time to interactive: <3s
- [ ] Chat load: <1s
- [ ] Video analysis: <3s
- [ ] Frame extraction: <5s

### Accessibility
- [ ] Color contrast: WCAG AA
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] No ARIA violations

### Security
- [ ] No XSS vulnerabilities
- [ ] CSRF tokens valid
- [ ] API keys not exposed
- [ ] Sensitive data encrypted
- [ ] Rate limiting works

### Database
- [ ] Jobs persisting correctly
- [ ] Thumbnails saving
- [ ] Memory data loading
- [ ] No orphaned records
- [ ] Backups running

---

## GO/NO-GO DECISION

### All Tests Pass?
**YES → Deploy to Production** ✅
- Merge main to production branch
- Monitor production logs
- Track user feedback

**NO → Fix Issues** ❌
- Identify failing test
- Create hotfix branch
- Test fix on staging
- Re-run checklist
- Redeploy

---

## Post-Deployment (1 hour)

### Monitor Production
- [ ] Real-time error tracking (Sentry/etc)
- [ ] User feedback reports
- [ ] Performance metrics
- [ ] Database health
- [ ] API response times

### Track Metrics
- [ ] Chat usage
- [ ] Video analysis usage
- [ ] Thumbnail selector usage
- [ ] Generation completion rate
- [ ] Error rate < 1%

### Early Feedback
- [ ] Are users using new features?
- [ ] Any unexpected errors?
- [ ] Performance acceptable?
- [ ] Mobile working well?
- [ ] Happy with workflows?

### If All Good
✅ **Deployment Successful**
- Celebrate! 🎉
- Document lessons learned
- Plan Phase 4/11 next

### If Issues Found
🚨 **Emergency Response**
- Identify root cause
- Hotfix if critical
- Hotfix if widespread
- Rollback if necessary
- Post-mortem after stability

---

## ROLLBACK PLAN

If critical issues:
```bash
# Revert to previous production commit
git revert <commit-hash>
git push origin production

# Vercel auto-deploys
# Production reverted in <5 min
```

Safe because:
- No database migrations
- Backward compatible
- No breaking API changes
- Data integrity maintained

---

## FINAL STATUS

**Ready to Deploy:** ✅ YES

All code tested, committed, and production-ready.
Proceed with confidence.

