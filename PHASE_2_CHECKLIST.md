# PHASE 2: LIVE PREVIEW IFRAME — DETAILED CHECKLIST

## OVERVIEW
**Goal:** Show actual website in iPhone 15 Pro Max frame, switch between devices, reload on save
**Duration:** 3 days
**Files to change:** 2 (1 new, 1 update)
**Complexity:** Medium

---

## DEPENDENCIES
No new npm packages needed (iframe and device switching are native web APIs)

---

## PHASE 2.1: Add Device Presets

### File: `/src/app/visual-editor/page.tsx` (UPDATE)

### Add device constants (before component):
```tsx
const DEVICES = {
  iphone15max: {
    name: 'iPhone 15 Pro Max',
    width: 402,
    height: 874,
    notchHeight: 30,
    homeBarHeight: 34,
    borderRadius: 55,
  },
  iphone15: {
    name: 'iPhone 15',
    width: 390,
    height: 844,
    notchHeight: 24,
    homeBarHeight: 34,
    borderRadius: 50,
  },
  iphonese: {
    name: 'iPhone SE',
    width: 375,
    height: 667,
    notchHeight: 0,
    homeBarHeight: 0,
    borderRadius: 32,
  },
  ipad: {
    name: 'iPad Air 11"',
    width: 820,
    height: 1180,
    notchHeight: 0,
    homeBarHeight: 20,
    borderRadius: 20,
  },
  desktop: {
    name: 'Desktop 1440px',
    width: 1440,
    height: 900,
    notchHeight: 0,
    homeBarHeight: 0,
    borderRadius: 0,
  },
};
```

### Add state for device selection:
```tsx
const [selectedDevice, setSelectedDevice] = useState('iphone15max');
```

### Add to header controls:
```tsx
<div className="device-selector">
  <select 
    value={selectedDevice} 
    onChange={(e) => setSelectedDevice(e.target.value)}
    className="device-select"
  >
    {Object.entries(DEVICES).map(([key, device]) => (
      <option key={key} value={key}>{device.name}</option>
    ))}
  </select>
</div>
```

### Add CSS for device selector:
```css
.device-selector {
  display: flex;
  align-items: center;
}

.device-select {
  padding: 6px 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
}

.device-select:hover {
  background: var(--color-background-tertiary);
}
```

---

## PHASE 2.2: Add iframe with Dynamic Sizing

### File: `/src/app/visual-editor/page.tsx` (UPDATE)

### In mobile preview section, replace placeholder with:
```tsx
<div className="mobile-preview">
  <div 
    className="iphone-frame"
    style={{
      width: `${DEVICES[selectedDevice as keyof typeof DEVICES].width}px`,
      height: `${DEVICES[selectedDevice as keyof typeof DEVICES].height}px`,
      borderRadius: `${DEVICES[selectedDevice as keyof typeof DEVICES].borderRadius}px`,
    }}
  >
    {/* Notch (show only if notchHeight > 0) */}
    {DEVICES[selectedDevice as keyof typeof DEVICES].notchHeight > 0 && (
      <div 
        className="iphone-notch"
        style={{
          height: `${DEVICES[selectedDevice as keyof typeof DEVICES].notchHeight}px`,
        }}
      />
    )}
    
    <div className="iphone-content">
      <div className="iphone-status-bar">
        <span>9:41</span>
        <span>●●●●●</span>
      </div>
      
      {/* IFRAME LOADS ACTUAL WEBSITE */}
      <iframe
        ref={iframeRef}
        src="/"
        title="Mobile preview"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
        className="iphone-viewport"
      />
      
      {/* Safe area overlays */}
      <div className="safe-area-top">⚠️ Unsafe area</div>
      <div className="safe-area-bottom">⚠️ Home indicator</div>
    </div>
    
    {/* Home indicator (show only if homeBarHeight > 0) */}
    {DEVICES[selectedDevice as keyof typeof DEVICES].homeBarHeight > 0 && (
      <div 
        className="iphone-home-indicator"
        style={{
          height: `${DEVICES[selectedDevice as keyof typeof DEVICES].homeBarHeight}px`,
        }}
      />
    )}
  </div>
</div>
```

### Update CSS for viewport:
```css
.iphone-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  overflow: hidden;
}

.safe-area-top {
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 30px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 0, 0, 0.7);
  font-weight: 500;
  z-index: 5;
}

.safe-area-bottom {
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 30px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 0, 0, 0.7);
  font-weight: 500;
  z-index: 5;
}
```

---

## PHASE 2.3: Add HMR Reload on Save

### File: `/src/app/visual-editor/page.tsx` (UPDATE)

### In saveFile function, after successful save, add iframe reload:
```tsx
const saveFile = useCallback(async () => {
  const file = openFiles.find(f => f.path === activeFile);
  if (!file) return;

  setSaveStatus('saving');

  try {
    const res = await fetch('/api/visual-editor/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: file.path,
        content: file.content,
      }),
    });

    if (res.ok) {
      setSaveStatus('saved');
      setOpenFiles(prev =>
        prev.map(f =>
          f.path === activeFile ? { ...f, isDirty: false } : f
        )
      );
      
      // 🆕 RELOAD IFRAME ON SAVE
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.location?.reload();
        } catch (error) {
          console.warn('Could not reload iframe (cross-origin?):', error);
        }
      }, 100);
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
    }
  } catch (error) {
    console.error('Failed to save file:', error);
    setSaveStatus('error');
  }
}, [activeFile, openFiles]);
```

---

## PHASE 2.4: Create HMR API Endpoint (optional, for future)

### File: `/src/app/api/visual-editor/hmr/route.ts` (NEW — can be skeleton for now)

```ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/visual-editor/hmr
 * 
 * Future: Send notifications to iframes about file changes
 * Current: Placeholder for Phase 2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, content } = body;

    // TODO: Implement WebSocket or SSE broadcast to iframes
    // For now, just acknowledge the save

    return NextResponse.json({
      success: true,
      message: 'HMR notification received',
      filePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

---

## TESTING CHECKLIST

### 2.1: Device Presets
- [ ] Device dropdown appears in header
- [ ] Can select each device
- [ ] iPhone 15 Pro Max selected by default
- [ ] No console errors

### 2.2: iframe Rendering
- [ ] iframe loads without errors
- [ ] iframe shows website content
- [ ] Device switching updates frame size
- [ ] Notch visible for iPhones, hidden for others
- [ ] Home indicator visible for iPhones/iPad, hidden for desktop
- [ ] Safe area overlays visible
- [ ] iframe sandbox="allow-same-origin allow-scripts..." works
- [ ] No console CORS errors

### 2.3: HMR Reload
- [ ] Edit code in editor
- [ ] Click Save
- [ ] iframe reloads (<1s)
- [ ] New changes visible in preview
- [ ] Works for all device sizes
- [ ] No blank screen during reload

### 2.4: General
- [ ] No typecheck errors: `npx tsc --noEmit`
- [ ] No console errors
- [ ] Responsive on desktop
- [ ] Works on iPad/mobile
- [ ] localStorage remembers device selection
- [ ] Auto-save still works
- [ ] Chat unaffected

---

## LOCAL TESTING

```bash
# 1. Start dev server
npm run dev

# 2. Visit editor
open http://localhost:3000/visual-editor

# 3. Test file opening
- Click 📁 Files to open sidebar
- Click a .tsx file
- File loads in code editor

# 4. Test device switching
- Dropdown shows: iPhone 15 Pro Max, iPhone 15, iPhone SE, iPad, Desktop
- Select iPhone 15 → frame resizes to 390×844
- Select iPad → frame resizes to 820×1180
- Select Desktop → no notch/home bar

# 5. Test live preview
- iframe should show your homepage (/)
- Try clicking buttons/links in iframe
- They should work (if your site supports it)

# 6. Test save & reload
- Edit code in editor: add "// test comment"
- Click Save
- Watch iframe reload (should complete in <1s)

# 7. Check no chat impact
- Visit /dashboard
- Visit /streams
- Both should work normally
- Chat features unaffected
```

---

## DEPLOYMENT

```bash
# 1. Verify all tests pass
npm run dev
# Test manually as above

# 2. Verify TypeScript
npx tsc --noEmit

# 3. Commit
git add src/app/visual-editor/page.tsx
git add src/app/api/visual-editor/hmr/route.ts
git commit -m "feat: phase 2 - live preview iframe with device switching"

# 4. Push
git push origin main

# 5. Wait for Vercel
# Check: https://vercel.com/streams
# Status should be green ✓

# 6. Verify live
open https://streamsailive.vercel.app/visual-editor
# Test all features again

# 7. Tag milestone
git tag v1.0-phase-2
git push origin v1.0-phase-2
```

---

## COMMON ISSUES & SOLUTIONS

### Issue: iframe shows blank white screen
**Solution:**
- Check browser console for errors
- Verify `src="/"` is correct (should load your homepage)
- Check if your homepage has CORS issues
- Try `sandbox="allow-same-origin allow-scripts ..."`

### Issue: Device switching doesn't update frame size
**Solution:**
- Verify `selectedDevice` state is updating (check React DevTools)
- Verify `DEVICES` constant has correct widths/heights
- Check CSS `width` and `height` are using `${DEVICES[...].width}px`

### Issue: iframe reload doesn't work
**Solution:**
- Try: `iframeRef.current?.contentWindow?.location?.reload()`
- Or: `iframeRef.current?.src = iframeRef.current?.src` (reload)
- Check cross-origin: if iframe is from different domain, reload won't work
- Add console.log to verify saveFile is called

### Issue: Safe area overlays don't show
**Solution:**
- Verify `.safe-area-top` and `.safe-area-bottom` CSS is in `<style jsx>`
- Check z-index: should be `z-index: 5;` (above iframe)
- Verify positioning is absolute (not relative)

### Issue: Notch doesn't show on desktop
**Solution:**
- Desktop device has `notchHeight: 0`
- Render checks: `{notchHeight > 0 && <div ... />}`
- This is correct behavior — desktop shouldn't show notch

---

## SUCCESS CRITERIA

✅ iframe loads and shows website
✅ Device switching works smoothly
✅ All device sizes render correctly
✅ Safe area overlays visible
✅ File save triggers reload (<1s)
✅ No TypeScript errors
✅ No console errors
✅ Chat unaffected
✅ Vercel green
✅ Mobile/desktop responsive

---

## NEXT PHASE (Phase 3)

Once Phase 2 is complete and Vercel is green:

1. Start Phase 3: Click-to-Inspect
2. Add Babel parser for AST
3. Inject data-component-id into elements
4. Add postMessage listener in iframe
5. Highlight code line on element click
6. Show inspector panel

See `BUILD_ORDER_VISUAL_EDITOR.md` Phase 3 for details.

---

## QUESTIONS?

- Check BUILD_ORDER_VISUAL_EDITOR.md for full architecture
- Check BUILD_ORDER_QUICK_REFERENCE.md for quick answers
- Review Phase 2 section of main build order for context

Ready to start? Begin with Phase 2.1 above.
