# Streams Panel — Build Rules
## Violations of any rule block merge. No exceptions.

---

## 1. MOBILE-FIRST LAYOUT

**Rule 1.1 — Single column is the default.**
Every screen is built for 390px first. Desktop two-column is an enhancement added via `@media (min-width: 768px)`. Never the reverse. Desktop layout is never `display: none` on mobile — it is absent from the mobile build entirely.

**Rule 1.2 — No content is hidden on mobile.**
`display: none !important` on any feature-carrying element at mobile breakpoint is a build failure. If something cannot fit on mobile, it must be redesigned for mobile — a bottom sheet, a collapsed section, a full-screen takeover — not hidden.

**Rule 1.3 — Grid results are always reachable on mobile.**
On mobile, when generation completes: the result must be immediately visible. Controls collapse or a sheet slides up. The result grid is never CSS-hidden while generation is running.

**Rule 1.4 — No two-column layout below 768px.**
Left panel + right grid is a desktop pattern only. On mobile: left panel is full-width, grid is either below it (scroll) or in a separate view. Never side-by-side at any mobile width.

**Rule 1.5 — Safe area insets on every bottom-anchored element.**
Any element pinned to the bottom of the screen must include `paddingBottom: env(safe-area-inset-bottom)`. This applies to: input bars, bottom nav, sheet footers, stitch strips.

---

## 2. NAVIGATION AND DRAWERS

**Rule 2.1 — Sidebar state must be consumed.**
Every boolean that controls visibility (`sidebarOpen`, `drawerOpen`, etc.) must be directly consumed in the render path. State that is set but never read is a dead bug. Audit: search for every `useState` with `open` — verify each has a conditional render or style that reads it.

**Rule 2.2 — Drawer implementation is mandatory.**
Any sidebar that is hidden on mobile must be replaced with a real drawer:
- `position: fixed; top: 0; left: 0; height: 100%; width: 280px`
- `transform: translateX(-100%)` closed, `translateX(0)` open
- `transition: transform 200ms ease`
- Dark overlay behind it: `position: fixed; inset: 0; background: rgba(0,0,0,0.5)`
- Tapping overlay closes the drawer
- No drawer = no merge.

**Rule 2.3 — No native scroll arrows on tab rows.**
Any `overflow-x: auto` row must suppress the native scrollbar:
```css
overflow-x: auto;
scrollbar-width: none;
-ms-overflow-style: none;
```
Plus `::-webkit-scrollbar { display: none }`. If the scrollbar is visible in any browser at any zoom level, it is a build failure.

**Rule 2.4 — Bottom nav touch targets are 48×48 minimum.**
Every bottom nav button: `min-width: 48px; min-height: 48px`. The tap area, not the icon area.

---

## 3. KEYBOARD AND INPUT BEHAVIOR

**Rule 3.1 — Input must stay above the keyboard on iOS.**
Every chat or prompt input that is bottom-anchored must use `visualViewport` to stay above the software keyboard:
```js
window.visualViewport?.addEventListener('resize', () => {
  const offset = window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
  inputContainer.style.transform = `translateY(-${offset}px)`;
});
```
No `visualViewport` listener = no merge for any bottom-anchored input.

**Rule 3.2 — Last message is never obscured.**
The message list scroll container must have `paddingBottom` equal to the input bar height + safe area inset. Measure the input bar height and set it explicitly. This is calculated, not guessed.

**Rule 3.3 — No scroll-within-scroll.**
A scrollable container must not be a child of another scrollable container on the same axis. One scroll context per screen. If a panel scrolls, the page does not. If the page scrolls, panels do not have `overflow: auto` on the same axis.

---

## 4. CHAT MESSAGE DESIGN

**Rule 4.1 — No chat bubbles. Ever.**
User messages: right-aligned text, `color: C.t1`. No background fill. No border. No border-radius. No `background: C.acc`. No pill shape.

**Rule 4.2 — No AI message cards.**
AI messages: left-aligned text. No background. No border. No card. No avatar circle. Flat prose. The only visual separation between messages is spacing.

**Rule 4.3 — No avatars.**
No `S` circle. No `U` circle. No initials. No avatar of any kind next to messages. Sender is identified by alignment and colour only.

**Rule 4.4 — Timestamps are muted, not labeled.**
`color: C.t4; fontSize: 12px`. No "Streams, now" prefix. Time only.

---

## 5. BORDERS AND SURFACES

**Rule 5.1 — No borders on input fields.**
Input fields: `background: C.bg3; border: none`. Depth is created by background contrast alone. If a border is needed for focus state: `outline: 1px solid C.acc` on `:focus`, and only on focus.

**Rule 5.2 — No borders on message containers.**
Any container that holds message text has no border. Background `C.bg2` or `C.bg3` is sufficient depth signal.

**Rule 5.3 — Cards use shadow, not borders.**
A card (a bounded UI object like a library item, a generation result, a settings section) uses `box-shadow: 0 4px 14px rgba(0,0,0,0.06)` from the locked shadow scale. Never a visible border unless it is an interactive affordance (button, chip, selectable).

**Rule 5.4 — Section groupings use spacing only.**
Inside a panel, sections are separated by spacing (`gap: 20px` or `margin-top: 24px`). Not by borders, not by dividers, not by section background fills. Spacing alone creates grouping.

**Rule 5.5 — No nested borders.**
If a parent container has a border, its children have no borders. One border per visual group maximum. Three levels of nested borders is a hard violation.

---

## 6. EMPTY STATES

**Rule 6.1 — Every empty state is designed.**
No screen, panel, or content area renders a blank dark rectangle when empty. Every empty state has: a brief label explaining what goes here, and an action (button or instruction) to fill it.

**Rule 6.2 — No developer text in empty states.**
"Shell data · load a video in Person tab to see real transcript" is a build failure. Empty state copy must be user-facing: "Upload a video to see its transcript here."

**Rule 6.3 — Empty state is not a dark void.**
A content area that has no content shows: the area's purpose label (`C.t4`, `12px`, uppercase), and an action in `C.acc2`. Not a black rectangle.

---

## 7. STUBS AND FAKE STATES

**Rule 7.1 — No setTimeout masking missing functionality.**
`setTimeout(() => setState("done"), 2000)` with no real operation behind it is a build failure. Every state transition must be triggered by a real event: API response, user action, or genuine timeout (polling).

**Rule 7.2 — No stub divs.**
A `div` with `onClick={() => {}}` or no `onClick` that is intended to be a file picker, uploader, or interactive element is a build failure. Every interactive affordance must do something on click.

**Rule 7.3 — No "coming soon" in live UI.**
Any visible string containing "coming soon", "not yet implemented", or "TODO" in rendered UI is a build failure. Unimplemented features are either absent from the UI or show a clear disabled state with no explanation.

**Rule 7.4 — No window.prompt.**
`window.prompt()` is a build failure. Every user input uses a rendered input element.

---

## 8. TOUCH AND INTERACTION

**Rule 8.1 — All interactive elements are 44×44pt minimum.**
Every button, chip, icon button, and interactive element: `min-height: 44px; min-width: 44px`. This is the Apple HIG minimum. Word chips in transcript: `padding: 6px 10px` minimum. Attach buttons: `padding: 8px` minimum.

**Rule 8.2 — No hover-only controls.**
Video player controls must be always-visible on mobile (not hover-triggered). On desktop, hover-reveal is acceptable. The breakpoint is 768px. Below it: controls are persistent.

**Rule 8.3 — No cursor: pointer on non-interactive elements.**
Only elements that respond to click/tap have `cursor: pointer`. Decorative elements, labels, and non-interactive containers have `cursor: default`.

---

## 9. TYPOGRAPHY AND VISUAL TOKENS

**Rule 9.1 — No fontSize below 12.**
12px is the minimum. 11px is a build failure. 10px is a build failure.

**Rule 9.2 — No arbitrary spacing values.**
Spacing is locked to `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}`. Any other px value is a build failure. Use multiples of 4 only.

**Rule 9.3 — No arbitrary radius values.**
Radius is locked to `{8, 12, 16, 20, 24, 999}`. Any other value is a build failure.

**Rule 9.4 — Motion is transform + opacity only.**
Animated properties are limited to `transform` and `opacity`. Animating `width`, `height`, `top`, `left`, `padding`, `margin`, or `border` is a build failure.

**Rule 9.5 — Motion duration is 150–220ms.**
Any transition or animation shorter than 150ms or longer than 220ms is a violation. No exceptions.

---

## 10. PROVIDER AND BRAND RULES

**Rule 10.1 — No provider names outside SettingsTab.**
`fal-ai/`, `ElevenLabs`, `Kling`, `MiniMax`, `OpenAI`, `Runway`, `Veo` must not appear in any rendered UI string in any tab except SettingsTab. Streams brand names only everywhere else.

**Rule 10.2 — All presets are baked in.**
No user-configurable fields for: `guidance_scale`, `audio_guidance_scale`, `stability` for singing, `speaker_boost`. These are hardcoded server-side. Rule 6 from the original spec — enforced at the route level.

---

## 11. FUNCTIONAL COMPLETENESS

**Rule 11.1 — State must be consumed.**
Every `useState` declaration is traced. If the state value is never read in the render path or in a handler that produces a visible effect, it is dead code and a build failure.

**Rule 11.2 — Props must be consumed.**
Every prop passed to a component is used inside that component. Unused props indicate a wiring failure.

**Rule 11.3 — Every button label must fit its container.**
No truncated button labels. If a label is cut off, either shorten the label or widen the button. `text-overflow: ellipsis` on a button is a design failure.

**Rule 11.4 — No uncontrolled form inputs.**
Every `<input>` and `<textarea>` uses `value` + `onChange`. `defaultValue` is a build failure except for read-only display fields.

---

## 12. BUILD AND DEPLOYMENT

**Rule 12.1 — ignoreBuildErrors does not mean ignore type errors.**
`typescript: { ignoreBuildErrors: true }` in `next.config.ts` suppresses pre-existing non-streams errors only. All streams files must pass `tsc --noEmit` with zero errors before merge.

**Rule 12.2 — No files are created without being committed.**
Any file imported by another file must exist in git. Verify with `git status` before push. An untracked imported file = broken build on Vercel.

**Rule 12.3 — Audit script runs before every push.**
The pattern-match audit (stubs, tokens, font floor, Rule 3, typecheck) runs before `git push`. Zero findings required to push.

---

## AUDIT CHECKLIST — run before every push

```
□ No chat bubbles (no background fill on user or AI messages)
□ No bordered message cards
□ No avatar circles
□ No sidebar state that is tracked but not consumed
□ Drawer implementation uses transform/overlay pattern
□ No native scroll arrows on any overflow row
□ Grid is visible on mobile (not display:none)
□ visualViewport listener on all bottom-anchored inputs
□ paddingBottom on message list = input bar height
□ No scroll-within-scroll on same axis
□ No empty dark rectangles — every empty state has label + action
□ No "shell data", "coming soon", or TODO in rendered UI
□ No setTimeout masking missing functionality
□ No window.prompt
□ No stub onClick={() => {}}
□ All interactive elements ≥ 44×44px
□ Video controls visible without hover on mobile
□ No fontSize below 12
□ No arbitrary spacing outside {4,8,12,16,20,24,32,40,48,64,80,96}
□ No arbitrary radius outside {8,12,16,20,24,999}
□ No provider names outside SettingsTab
□ All sliders and inputs use controlled value + onChange
□ No truncated button labels
□ All new files committed before push
□ tsc --noEmit on streams/ = 0 errors
```
