# Frontend Build Rules
## Every rule is a hard gate. Violations block merge. No exceptions.

---

## SECTION 1 — TYPOGRAPHY

**Rule T.1**
Font must be loaded and available before first paint. Use `font-display: swap` with a defined fallback stack that matches the loaded font's metrics. Layout shift caused by font swap is a build failure.

**Rule T.2**
Font weight scale is defined once at the system level and used consistently. The scale is: 400 regular, 500 medium. No other weights. 600 and 700 are never used.

**Rule T.3**
Line height is set explicitly on every text element. Body text: `line-height: 1.6`. Labels and UI text: `line-height: 1.4`. Headings: `line-height: 1.2`. No element relies on the browser default of `1.2` for body text.

**Rule T.4**
Letter spacing is never applied to body text or labels. Letter spacing is permitted only on uppercase display text at sizes above 24px and only up to `0.08em`.

**Rule T.5**
A typographic hierarchy is defined and enforced. Every text element maps to exactly one role: display, heading, subheading, body, label, caption, or code. No two roles share the same size and weight combination.

**Rule T.6**
Decorative or display fonts are never applied to functional UI text. Functional UI text includes: button labels, input placeholders, navigation items, error messages, status labels, and form field labels.

**Rule T.7**
Monospace fonts are applied only to code, IDs, technical strings, and values that require character-level precision. Monospace is never applied to prose, instructions, or descriptive text.

**Rule T.8**
Font sizes are set in `rem` throughout. Pixel values for font sizes are never used. The minimum rendered size in the default browser configuration is 12px (0.75rem). No font size below 0.75rem.

**Rule T.9**
All text must wrap correctly at the narrowest viewport the application supports. `white-space: nowrap` is never used on strings of unknown length. `overflow: hidden` is never used on text without a defined `text-overflow: ellipsis` and a `title` attribute containing the full value.

**Rule T.10**
`text-transform: uppercase` is never applied to strings longer than 4 words. Uppercase is permitted only on short labels, badges, and section markers.

**Rule T.11**
Font smoothing is set on the root element: `-webkit-font-smoothing: antialiased; moz-osx-font-smoothing: grayscale`.

**Rule T.12**
Font family is defined once in the design token and imported from that single source in every component. No component defines its own `font-family` value.

**Rule T.13**
Numeric values displayed live (counters, costs, progress) use a font with tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shift as digits change.

**Rule T.14**
Every string of unknown length that is displayed in a fixed-width container has explicit overflow handling. The handling is one of: `text-overflow: ellipsis` with `overflow: hidden` and `white-space: nowrap`, or `overflow-wrap: break-word` for multiline. No container clips text silently without a visible affordance.

**Rule T.15**
Headings and display text are constrained to a maximum line length. No heading wraps to more than 3 lines on any supported viewport. Prose body text column width does not exceed 72 characters on any viewport.

**Rule T.16**
Right-aligned text is consistently right-aligned across all instances of the same content type. Center-aligned text is used only for short labels, empty states, and display content — never for lists, paragraphs, or flowing text.

---

## SECTION 2 — COLOUR AND CONTRAST

**Rule C.1**
Every foreground text colour is tested against its background at the point of use. The minimum contrast ratio is 4.5:1 for body text (WCAG AA). The minimum for large text above 18px is 3:1. Any failing combination is a build failure regardless of aesthetic intent.

**Rule C.2**
Placeholder text is visually distinct from entered text and visually distinct from the field label. Placeholder: `C.t4`. Label: `C.t2`. Entered value: `C.t1`. These three must pass contrast independently.

**Rule C.3**
Disabled states are visually distinct from enabled states. The disabled visual treatment is consistent across all interactive elements: buttons, inputs, selects, chips. Disabled does not mean invisible — it means reduced opacity with a `cursor: not-allowed`.

**Rule C.4**
Hover state, active (pressed) state, and selected/active state are three distinct visual states. They may share a colour family but must differ in intensity or property (background vs border vs underline). A button that looks the same when hovered as when selected is a build failure.

**Rule C.5**
Error, warning, success, and informational states each have a distinct colour. Error is never the same colour as warning. Success is never the same colour as informational. These four states do not share a colour.

**Rule C.6**
The accent colour is used exclusively for interactive affordances and primary actions. It is never used for decoration, background fills, or non-interactive elements. If the accent colour appears on a non-interactive element, a user will try to click it. That is a design failure.

**Rule C.7**
Overlay backgrounds are dark enough to reduce the content behind them to an unreadable level. The overlay behind a modal, drawer, or sheet uses `rgba(0,0,0,0.5)` minimum. Content behind the overlay must not be readable or distracting.

**Rule C.8**
Focus rings are visible on every interactive element. The focus ring colour is never the same as the element's background or border. Focus ring style: `outline: 2px solid C.acc; outline-offset: 2px`. `outline: none` without a replacement is a hard build failure.

**Rule C.9**
Interactive elements are never differentiated from non-interactive elements by colour alone. Shape, position, weight, or an explicit affordance (border, underline, icon) must also signal interactivity.

**Rule C.10**
Background colours are consistent within the same visual layer. Panel backgrounds are `C.bg2`. Page background is `C.bg`. Surface elevations are `C.bg3`, `C.bg4`. No component introduces a new background value not in the token set.

**Rule C.11**
Semi-transparent backgrounds use values from the token set (`C.surf`, `C.surf2`, `C.surf3`). No component defines its own arbitrary `rgba()` background value.

**Rule C.12**
`prefers-color-scheme` is either fully supported with a light mode or explicitly documented as dark-only. A dark-only product is a legitimate choice but must be a deliberate decision, not an omission.

---

## SECTION 3 — SPACING AND LAYOUT

**Rule S.1**
All spacing values are from the locked scale: `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}` pixels. No other values. No arithmetic that produces off-scale values. `calc(16px + 2px)` is a build failure. Use `20px`.

**Rule S.2**
No element touches the edge of its container without padding. The minimum horizontal padding inside any panel, card, or container is `16px`. The minimum vertical padding is `12px`.

**Rule S.3**
Icons and their adjacent labels are vertically aligned on the same baseline. Use `display: flex; align-items: center; gap: Npx` on the parent. Never use `vertical-align` with magic offset values.

**Rule S.4**
Interactive elements do not shift their position or change the size of surrounding elements when their state changes. A button that changes width on hover, a label that changes size on active, a container that changes height when selected — all are build failures.

**Rule S.5**
Negative margins are not used to compensate for padding set on a parent. Compensatory layout is a structural failure. Fix the padding on the parent.

**Rule S.6**
Fixed-height containers that receive dynamic content have `overflow` explicitly set. If the content can exceed the container, `overflow: hidden` with `text-overflow` or `overflow: auto` with a visible scrollbar — never implicit clipping.

**Rule S.7**
`position: relative` is only applied when necessary. It is necessary when: a child uses `position: absolute`, or a `z-index` is required, or the element is the scroll container. `position: relative` added for no reason creates unintended stacking contexts.

**Rule S.8**
Z-index values follow a defined scale: `10` for in-flow elevated elements, `100` for dropdowns and tooltips, `200` for modals, `300` for drawers and sheets, `400` for toasts and alerts. No arbitrary values. No values above `400`. No values of `9999` or `99999`.

**Rule S.9**
`overflow: hidden` on a parent never clips a child's box shadow, dropdown, or tooltip. If a child needs to visually overflow its parent, the parent cannot have `overflow: hidden`. Use `clip-path` or restructure the DOM.

**Rule S.10**
Dropdowns, tooltips, and context menus that extend beyond their trigger container are rendered in a portal appended to `document.body`. They are never children of `overflow: hidden` containers.

**Rule S.11**
The viewport height calculation accounts for the browser's own UI on mobile. Use `100dvh` on the root container. Never use `100vh` as the sole height value for full-screen layouts on mobile.

**Rule S.12**
List items of the same type have consistent heights. If some items have subtitles and some do not, all items reserve space for the subtitle line or none do. Mixed heights in a list are a design failure.

**Rule S.13**
Grid and flexbox column alignment is consistent across visual sections on the same page. Items that appear to be in the same column must actually be in the same grid column or aligned via the same flex parent.

---

## SECTION 4 — ANIMATION AND MOTION

**Rule M.1**
Animated properties are limited to `transform` and `opacity`. Animating `width`, `height`, `top`, `left`, `right`, `bottom`, `padding`, `margin`, `border-width`, or `font-size` is a build failure. These properties trigger layout and paint.

**Rule M.2**
All transition durations are between 150ms and 220ms. Nothing shorter, nothing longer. Durations are defined from the token set: `fast: 150ms`, `base: 180ms`, `slow: 220ms`.

**Rule M.3**
`transition: all` is never used. Every transition names its specific property: `transition: transform 180ms ease, opacity 150ms ease`. Unknown future properties must not accidentally animate.

**Rule M.4**
`will-change: transform` is applied to elements that animate on every interaction (hover states, active states, open/close transitions). It is removed from elements that animate only once.

**Rule M.5**
Animation direction matches the spatial direction of the interaction. A drawer opening from the left slides in from `translateX(-100%)`. A sheet rising from the bottom slides in from `translateY(100%)`. An element triggered from the top enters from above.

**Rule M.6**
Entrance animations do not replay on tab return, route re-mount, or state update. Entrance animations play once on first mount only.

**Rule M.7**
`@media (prefers-reduced-motion: reduce)` is respected. Every animation and transition is wrapped with this check. When reduced motion is preferred, transitions are instant (`transition-duration: 0.01ms`) and animations are disabled.

**Rule M.8**
Spinner animations use `animation-timing-function: linear` with `0deg` to `360deg`. No `steps()`. No easing. Rotation must appear smooth.

**Rule M.9**
Skeleton loading shimmer direction is consistent across the entire application. Every skeleton shimmers left-to-right. Every skeleton shimmers at the same speed.

**Rule M.10**
`pointer-events` is set to `none` during animation for elements that are not yet in their final interactive position. An element must not be clickable before it has visually arrived.

**Rule M.11**
Easing functions are from the token set: `cubic-bezier(.4,0,.2,1)` for enter/exit, `cubic-bezier(.4,0,1,1)` for exit-only, `cubic-bezier(0,0,.2,1)` for enter-only. Bounce easings (`cubic-bezier` with values above 1 or below 0) are never used on functional UI elements.

**Rule M.12**
List items entering the viewport do not all animate simultaneously. Staggered entrance uses `animation-delay` increments of `20ms` per item. Maximum stagger delay is `200ms` total regardless of list length.

---

## SECTION 5 — LOADING AND SKELETON STATES

**Rule L.1**
Every data-driven UI region has three explicitly designed states: loading, loaded, and error. No region has only one or two of these states. All three are designed before the feature is considered complete.

**Rule L.2**
Skeleton placeholders match the dimensions of the content they represent. A skeleton for a single-line label is one line. A skeleton for a three-line description is three lines. Skeletons that do not match cause layout shift when real content arrives.

**Rule L.3**
Skeleton states are never shown indefinitely. A maximum skeleton duration is set. After that duration, the error state is shown. `setTimeout` to transition from skeleton to error is acceptable and required.

**Rule L.4**
A loading spinner is used only when the duration is unknown and the content area has no predictable shape. When the content shape is known, a skeleton is used instead of a spinner.

**Rule L.5**
No global loading state is shown for a local operation. A spinner in the page header does not appear because a single component is fetching data. Loading indicators are scoped to the element that is loading.

**Rule L.6**
Content that arrives in under 100ms must not show a skeleton. The skeleton appearance itself causes perceived jank. Use a minimum display time of 300ms for skeletons or suppress them entirely for fast operations.

**Rule L.7**
Progress indicators that cannot report real progress show an indeterminate animation. They do not show `0%` or jump instantly to `100%`. A fake progress bar is worse than no progress bar.

**Rule L.8**
Spinner colours pass the same contrast requirements as text. A spinner that is invisible against its background is a build failure.

---

## SECTION 6 — FOCUS AND KEYBOARD NAVIGATION

**Rule K.1**
Every interactive element is reachable and operable by keyboard alone. This is tested manually before every merge by tabbing through every interactive surface without a mouse.

**Rule K.2**
Focus order matches visual reading order. Tab moves left-to-right, top-to-bottom through the page. Focus must never jump to a visually distant location unexpectedly.

**Rule K.3**
When a modal, drawer, or overlay opens, focus moves into it immediately. The first focusable element inside it receives focus. Focus is trapped inside the overlay until it is dismissed.

**Rule K.4**
When a modal, drawer, or overlay closes, focus returns to the element that triggered it.

**Rule K.5**
Pressing Escape closes any open modal, drawer, overlay, dropdown, or tooltip. This is non-negotiable.

**Rule K.6**
Dropdown menus and select-like components respond to arrow keys for navigation, Enter to select, and Escape to close.

**Rule K.7**
Every click handler on a non-`<button>` or non-`<a>` element also handles `onKeyDown` for Enter and Space. If a `div` or `span` is clickable, it has `role="button"`, `tabIndex={0}`, and keyboard handlers. No exceptions.

**Rule K.8**
Every icon-only button has an `aria-label` that describes its action. "Close", "Delete", "Copy", "Download" — not "icon" or "button".

**Rule K.9**
Every form field `<label>` is associated with its input via `htmlFor` matching the input's `id`. Clicking the label focuses the input. This is verified during testing.

**Rule K.10**
A skip-to-main-content link is present and is the first focusable element on every page. It is visually hidden until focused.

---

## SECTION 7 — RESPONSIVE LAYOUT

**Rule R.1**
Every screen is designed and built for 390px width first. The desktop layout is built as an enhancement on top of the mobile layout. Mobile CSS is never overridden by desktop CSS — desktop CSS is added on top of mobile defaults.

**Rule R.2**
Media query breakpoints are determined by content reflow points, not device names. The breakpoints are: `480px`, `768px`, `1024px`, `1280px`. All four are defined in the token set and used consistently. No other breakpoint values.

**Rule R.3**
No feature is hidden at any breakpoint. If something cannot fit at a narrow viewport, it is redesigned for that viewport. `display: none !important` on a feature-carrying element at any breakpoint is a build failure.

**Rule R.4**
Fixed pixel widths on containers are not used. Containers use `max-width` with `width: 100%`. Child elements use `flex: 1`, `min-width: 0`, or percentage widths that sum to 100%.

**Rule R.5**
`min-width: 0` is applied to all flex children that contain text or other constrained content. Without it, flex children do not shrink below their content size and overflow their parent.

**Rule R.6**
Text column widths are constrained at wide viewports. Body text columns have `max-width: 72ch`. Line lengths exceeding 80 characters per line are a readability failure.

**Rule R.7**
All images have `max-width: 100%; height: auto` unless they have a specific fixed-size purpose. Images never overflow their container.

**Rule R.8**
No horizontal scrollbar appears on the full page at any supported viewport width. If a scrollbar appears, something is wider than the viewport. That element is found and fixed.

**Rule R.9**
Two-column layouts transition through an intermediate single-column layout at the appropriate breakpoint. There is no layout that jumps from 3-column to 1-column without a 2-column intermediate.

**Rule R.10**
`vw` and `vh` units are not used for font sizes or spacing. They are permitted only for full-bleed layout containers.

**Rule R.11**
`env(safe-area-inset-bottom)` is applied to every element anchored to the bottom of the screen. Bottom navigation, input bars, action sheets, and toast containers all include this padding.

**Rule R.12**
`100dvh` is used for full-screen height calculations. `100vh` is not used as the sole value for full-height layouts because it does not account for the mobile browser's own UI.

---

## SECTION 8 — INTERACTIVE AFFORDANCES

**Rule A.1**
Every element that responds to a click or tap is visually distinguishable as interactive before it is interacted with. The signal may be colour, shape, underline, border, or position — but it must exist in the resting state.

**Rule A.2**
Every interactive element has a visible response within 100ms of interaction. The response may be a pressed/active state, a loading indicator, or a state change. Tapping a button and seeing nothing for 300ms is a build failure.

**Rule A.3**
`cursor: pointer` is applied to every interactive element. `cursor: pointer` is applied to nothing that is not interactive. A non-interactive label with `cursor: pointer` falsely signals interactivity.

**Rule A.4**
Icon-only buttons have a visible tooltip on hover (desktop) and a visible label beneath the icon on touch surfaces. An icon with no label and no tooltip communicates nothing.

**Rule A.5**
Destructive actions (delete, overwrite, disconnect, revoke) require a confirmation step before execution. A confirmation step is a modal, an inline confirmation UI, or a hold-to-confirm interaction. A single tap that irrevocably destroys data is a build failure.

**Rule A.6**
Disabled interactive elements are visually reduced in opacity (`opacity: 0.4`) and use `cursor: not-allowed`. They are accompanied by a tooltip or adjacent text explaining why they are disabled and what action enables them.

**Rule A.7**
The tap/click target of every interactive element is at minimum 44×44 CSS pixels on mobile. This is the Apple HIG and Google Material minimum. The visual size of the element may be smaller but the tap target must meet this minimum via padding.

**Rule A.8**
Elements placed adjacent to each other have at minimum 8px of non-interactive space between their tap targets. Two 44px targets placed 2px apart will result in frequent mis-taps.

**Rule A.9**
Toggle switches, checkboxes, and radio buttons have labels that describe what enabled and disabled mean. A toggle with no label that says "on" or "off" communicates nothing about what is being toggled.

---

## SECTION 9 — IMAGES AND MEDIA

**Rule I.1**
All `<img>` elements have explicit `width` and `height` attributes or CSS that reserves their space before they load. Images that load without reserved space cause cumulative layout shift. CLS is a build failure.

**Rule I.2**
`object-fit: cover` or `object-fit: contain` is set on every image inside a fixed-size container. No image distorts to fill its box.

**Rule I.3**
All images have meaningful `alt` text. Decorative images have `alt=""`. Images that convey information have alt text describing that information. An `alt` attribute that repeats surrounding text is incorrect.

**Rule I.4**
Images below the fold use `loading="lazy"`. Images in the initial viewport do not use `loading="lazy"`. The fold is approximated at 600px from the top.

**Rule I.5**
High-resolution source images are never served to low-resolution displays. Responsive images use `srcset` with at minimum a 1x and 2x variant. The appropriate variant is served based on `devicePixelRatio`.

**Rule I.6**
Exported images are compressed. PNG is used only for images requiring transparency. JPEG is used for photographs. WebP is the preferred format when browser support allows. SVG is used for all icons, logos, and illustrations.

**Rule I.7**
SVG icons are never embedded as base64 in CSS. Base64-encoded SVGs are not cacheable, inflate CSS bundle size, and are unmaintainable.

**Rule I.8**
Icon fonts are not used. Icon fonts render as blank squares when the font fails to load. SVG icons with `aria-hidden="true"` are used instead.

**Rule I.9**
Video elements that autoplay have the `muted` and `playsInline` attributes. Autoplay without `muted` is blocked by every modern browser. Autoplay without `playsInline` opens fullscreen unintentionally on iOS.

**Rule I.10**
Every video element has a `poster` attribute pointing to a representative still frame. A black rectangle is never the first thing a user sees where a video will be.

**Rule I.11**
Video playback controls are accessible without hover on touch devices. Controls are either always visible on mobile or toggled by a tap on the video area. Hover-reveal controls are desktop-only.

---

## SECTION 10 — FORMS

**Rule F.1**
Every form input is a controlled component using `value` and `onChange`. `defaultValue` is never used on inputs whose value affects application state. Uncontrolled inputs whose state is tracked elsewhere diverge silently.

**Rule F.2**
Submit buttons are disabled during form submission. They are re-enabled only after the response is received and processed. Double-submit is never possible.

**Rule F.3**
Form field values are preserved across submission failures. If a submission fails, the user's input remains in the field. Fields are only cleared on successful submission.

**Rule F.4**
Inline validation error messages appear adjacent to the field that failed, not below the form. The error message is associated with the field via `aria-describedby`.

**Rule F.5**
Required fields are marked with a visible indicator before submission. The indicator is consistent across all forms.

**Rule F.6**
The correct `input type` is used for every field. Email fields use `type="email"`. Phone fields use `type="tel"`. Number fields use `type="number"` or `type="text"` with `inputmode="numeric"`. Password fields use `type="password"`.

**Rule F.7**
`inputmode` is set on text inputs that expect a specific keyboard type. Numeric entry uses `inputmode="numeric"`. Decimal entry uses `inputmode="decimal"`. Search fields use `inputmode="search"`.

**Rule F.8**
Browser autofill is not blocked on standard fields. `autocomplete` attributes are set correctly: `autocomplete="email"` on email fields, `autocomplete="new-password"` on new password fields, `autocomplete="current-password"` on login password fields.

**Rule F.9**
Select elements are styled to match the design system. The native OS appearance is overridden via `appearance: none` with a custom visual treatment. Native selects on mobile are acceptable — on desktop they are not.

**Rule F.10**
Multi-step forms preserve all previously entered values when navigating between steps. Going back to step 1 from step 3 shows the values that were entered in step 1.

**Rule F.11**
`maxLength` is set on all free-text inputs. The limit matches the backend validation limit. There is no input with unlimited length.

**Rule F.12**
File inputs show the current file name after selection. The file name updates correctly after a new file is selected. The display clears after a successful upload.

---

## SECTION 11 — NOTIFICATIONS AND FEEDBACK

**Rule N.1**
Toast notifications are visible for a minimum of 4 seconds. Error toasts are visible for a minimum of 6 seconds. No toast auto-dismisses faster than these minimums.

**Rule N.2**
Toast notifications stack with a maximum of 3 visible simultaneously. A fourth toast replaces the oldest. Unlimited stacking is a build failure.

**Rule N.3**
Toast notifications are positioned above the keyboard on mobile. When the software keyboard is open, toasts are not obscured. Toast position responds to `visualViewport` changes.

**Rule N.4**
Error toasts and success toasts are visually distinct. They differ in colour, icon, and optionally in position. A user must know at a glance which type they received.

**Rule N.5**
Copy-to-clipboard actions show immediate visual confirmation. The confirmation persists for 2 seconds. There is no user action that produces zero feedback.

**Rule N.6**
Confirmation dialogs have two visually distinct buttons. The destructive action is visually differentiated from the cancel action — different colour, different weight, different position.

**Rule N.7**
Progress indicators accurately reflect real progress when real progress data is available. Fake progress bars that jump to 100% immediately and wait are not used. Indeterminate indicators are used when progress cannot be measured.

**Rule N.8**
Every async operation has a visible loading state. No button press produces silence for more than 100ms before showing that something is happening.

**Rule N.9**
Toast notifications appear above all other content. They are never behind modals, overlays, or the keyboard. Their z-index is `400` from the defined scale.

---

## SECTION 12 — NAVIGATION AND ROUTING

**Rule V.1**
The active navigation item is visually distinguished from inactive items by at minimum two properties: colour and weight, or colour and border, or colour and background. Colour alone is not sufficient.

**Rule V.2**
The browser's back button navigates within the application's navigation model. If the application uses tabs or multi-level navigation, the browser back button navigates to the previous state, not to the previous domain.

**Rule V.3**
The active tab or section is encoded in the URL. Deep links to specific application states work. Reloading the page returns the user to the same state they were in.

**Rule V.4**
Tab switching preserves scroll position within each tab. Returning to a tab shows the user the same scroll position they left it at.

**Rule V.5**
Tab switching preserves form state within each tab. A partially filled form is not cleared when the user switches tabs and returns.

**Rule V.6**
Links that open in a new tab display a visible indicator — a small external link icon — adjacent to the link text.

**Rule V.7**
The application logo or brand mark links to the home or default screen. Clicking the logo on any screen returns to the primary landing state.

---

## SECTION 13 — DATA DISPLAY

**Rule D.1**
All numbers are formatted for human readability. Thousands are separated by commas or locale-appropriate separators. `1000000` is displayed as `1,000,000`. Raw unformatted large numbers are a build failure.

**Rule D.2**
Currency values include the currency symbol and are formatted to 2 decimal places. `$0.45` not `0.45`. `$1,200.00` not `1200`.

**Rule D.3**
Dates are never displayed in ISO 8601 format to end users. `2026-04-23T16:00:00Z` is a build failure in the UI. Dates are displayed in a human-readable format appropriate to the user's locale.

**Rule D.4**
Relative time values update automatically. "2 minutes ago" becomes "3 minutes ago" after a minute passes. Static relative time strings that never update are a build failure.

**Rule D.5**
Every list, table, and grid has a designed empty state. An empty container with no content and no label is a build failure. The empty state describes what should be here and provides an action to populate it.

**Rule D.6**
Truncated text values have a mechanism to reveal the full value. This may be a tooltip, an expand control, or a detail view. Text that is silently truncated with no way to see the rest is a build failure.

**Rule D.7**
Floating point arithmetic results are rounded before display. `0.30000000000000004` is a build failure. All displayed numbers pass through `toFixed(n)`, `Math.round()`, or `Intl.NumberFormat` before rendering.

**Rule D.8**
Table columns have a defined minimum width. No column collapses to zero width when its data is short. Column widths are stable regardless of the data they contain.

**Rule D.9**
Percentage values are displayed to a maximum of one decimal place in UI contexts. `34.0%` not `34.000000%`.

---

## SECTION 14 — CSS AND STYLING ARCHITECTURE

**Rule CSS.1**
`!important` is never used. Its presence in any file is a build failure. If a specificity conflict requires `!important` to resolve, the specificity conflict is fixed at its source.

**Rule CSS.2**
All style values for colour, spacing, radius, shadow, and motion come from the design token file. No component defines its own values for these properties. The token file is the single source of truth.

**Rule CSS.3**
CSS class names follow a consistent convention. Component-scoped class names are prefixed with the component name. Global utility classes are prefixed with `u-`. No class named `container`, `wrapper`, `box`, or `inner` exists without a component prefix.

**Rule CSS.4**
Global CSS rules never target elements by tag name inside a component. A global `input { }` rule affects all inputs everywhere. Component-specific input styles are scoped.

**Rule CSS.5**
Inline styles are used only for dynamic values that cannot be expressed in static CSS — values derived from JavaScript state at runtime. Static design decisions are never expressed as inline styles.

**Rule CSS.6**
`px` and `rem` units are not mixed within the same property type. Spacing is all `px` (from the scale). Font sizes are all `rem`. These conventions are consistent across the entire codebase.

**Rule CSS.7**
CSS custom properties are defined before they are used. Every `var(--property)` reference has a corresponding definition. Undefined custom properties silently fall back to browser defaults — this is a build failure.

**Rule CSS.8**
Media queries use the breakpoint values from the defined scale and only those values. No media query uses a breakpoint value not in the token set.

**Rule CSS.9**
Unused CSS rules are removed. A CSS rule with no matching DOM element is dead code. CSS bundle size is audited before every major release.

**Rule CSS.10**
`calc()` expressions are simplified. `calc(16px + 0px)` is a build failure. `calc(100% - 0px)` is a build failure. `calc()` is used only when the arithmetic is genuinely necessary.

---

## SECTION 15 — ACCESSIBILITY BEYOND KEYBOARD

**Rule ACC.1**
Colour is never the sole differentiator between states. Every state difference communicated by colour is also communicated by shape, icon, text, weight, or position.

**Rule ACC.2**
Motion is never the sole carrier of information. An animation that communicates a state change must also communicate that state change through a non-motion property: colour, text, icon, or visibility.

**Rule ACC.3**
The `lang` attribute is set on the `<html>` element and matches the language of the content. Without it, screen readers may use the wrong language voice.

**Rule ACC.4**
Dynamic content changes are announced to screen readers via `aria-live` regions. A list that updates, a status that changes, a count that increments — all must be in an `aria-live="polite"` region.

**Rule ACC.5**
Loading states are communicated to screen readers. An `aria-busy="true"` attribute is applied to the container being loaded. A visually hidden live region announces completion.

**Rule ACC.6**
`aria-hidden="true"` is never applied to interactive elements. Hidden elements must not be focusable. Interactive elements must not be hidden from assistive technology.

**Rule ACC.7**
`role="button"` is never applied to an element without also applying `tabIndex={0}` and keyboard event handlers for Enter and Space.

**Rule ACC.8**
`aria-label` is never applied to an element that already has visible text content. The screen reader reads both and the result is redundant.

**Rule ACC.9**
Decorative images, icons, and illustrations are marked with `aria-hidden="true"` or `alt=""`. Images that exist only for visual decoration must not be narrated by screen readers.

**Rule ACC.10**
Error messages are associated with their form fields via `aria-describedby`. When the field receives focus, the screen reader announces both the field label and the error message.

**Rule ACC.11**
`prefers-reduced-motion` is respected in all animation code. When the user has requested reduced motion, all transitions are instantaneous and all looping animations stop.

---

## SECTION 16 — EMPTY STATES AND CONTENT STATES

**Rule E.1**
Every content region that can be empty has a designed empty state. The empty state consists of: a brief label describing what belongs here, and a single primary action to populate it. A blank container is never acceptable.

**Rule E.2**
Developer text, debug labels, and placeholder copy are never visible in production. Strings like "Shell data", "TODO", "placeholder", "test", "lorem ipsum", or technical field names are build failures in rendered UI.

**Rule E.3**
Empty states do not use a dark void as the visual treatment. An empty state has visible text at minimum. Optionally it has an icon or illustration. It is never an unmarked dark rectangle.

**Rule E.4**
The empty state for a content list is different from the empty state for a failed load. "No items yet — generate your first" is different from "Failed to load — try again". Both are designed separately.

**Rule E.5**
Error states have a recovery action. A component that shows "Something went wrong" with no button is a build failure. The error state includes a retry button, a link to support, or an instruction for what the user should do.

---

## SECTION 17 — STUBS, FAKES, AND INCOMPLETE STATES

**Rule ST.1**
`setTimeout` is never used to simulate a state transition that should be driven by a real event. A `setTimeout` that sets a loading state to done without a corresponding real operation is a build failure.

**Rule ST.2**
`onClick={() => {}}` on a visible interactive element is a build failure. Every interactive element that is visible must do something when activated. Elements for future functionality are hidden or absent — not present and non-functional.

**Rule ST.3**
`window.prompt()`, `window.alert()`, and `window.confirm()` are never used in production UI. Every input and confirmation uses rendered React components.

**Rule ST.4**
The string "coming soon" is never rendered in the UI. Unimplemented features are either absent from the interface or shown as disabled with no label explaining their future status.

**Rule ST.5**
Every `useState` declaration is traced to a point of consumption. State that is set but never read in the render path or in a handler that produces a user-visible effect is dead code and a build failure.

**Rule ST.6**
Every prop passed to a component is used within that component. A prop that is accepted but never referenced inside the component body indicates a wiring failure. Dead props are removed.

---

## PRE-PUSH AUDIT CHECKLIST

Run this checklist manually before every push. Every item must be confirmed.

```
TYPOGRAPHY
□ No font-size below 12px (0.75rem) in any file
□ No arbitrary font weights — only 400 and 500
□ No monospace font on prose or instructional text
□ No letter-spacing on body text or labels
□ No text overflowing containers without overflow handling
□ All text wraps correctly at 390px

COLOUR
□ Every text/background combination passes 4.5:1 contrast
□ Placeholder, label, and entered value are three distinct colours
□ Disabled state visually distinct from enabled
□ Hover, active, and selected are three distinct states
□ Focus ring visible on every interactive element
□ No accent colour on non-interactive elements

SPACING AND LAYOUT
□ All spacing values are from {4,8,12,16,20,24,32,40,48,64,80,96}
□ No element touches container edge without padding
□ No negative margin compensation
□ No z-index values outside the defined scale
□ No overflow:hidden clipping box-shadows, dropdowns, or tooltips
□ No horizontal page scrollbar at any viewport width

ANIMATION
□ Only transform and opacity animated
□ All durations between 150ms and 220ms
□ No transition:all
□ prefers-reduced-motion respected
□ No bounce easing on functional elements

LOADING STATES
□ Every data region has loading, loaded, and error state
□ Skeleton dimensions match content dimensions
□ No indefinite skeleton state
□ No global spinner for local operation

KEYBOARD AND FOCUS
□ Every interactive element reachable by Tab
□ Focus ring visible on every interactive element
□ Modal focus trap implemented
□ Escape closes every overlay
□ No div with onClick missing role and tabIndex

RESPONSIVE
□ Layout designed mobile-first from 390px
□ No feature hidden at any breakpoint
□ No fixed pixel widths on containers
□ safe-area-inset-bottom on all bottom-anchored elements
□ 100dvh used not 100vh

AFFORDANCES
□ Every interactive element visually signals interactivity at rest
□ Every button press produces visible feedback within 100ms
□ No cursor:pointer on non-interactive elements
□ Every destructive action has a confirmation step
□ All tap targets minimum 44×44px

IMAGES AND MEDIA
□ All images have width, height, and alt
□ No image distortion — object-fit set
□ Lazy loading on below-fold images
□ All videos have muted and playsInline
□ All videos have poster attribute

FORMS
□ All inputs are controlled (value + onChange)
□ Submit disabled during submission
□ Field values preserved on failure
□ Errors appear adjacent to their field
□ Correct input type on every field

NOTIFICATIONS
□ Toast minimum 4s display time
□ Toast maximum 3 simultaneous
□ Toasts above keyboard on mobile
□ Error and success toasts visually distinct

DATA DISPLAY
□ All numbers formatted — no raw large integers
□ No ISO dates displayed to users
□ Relative time updates automatically
□ All empty lists have an empty state
□ All floats rounded before display

CSS
□ No !important in any file
□ No inline styles for static design decisions
□ No undefined CSS custom properties
□ No unused CSS classes

ACCESSIBILITY
□ lang attribute set on html element
□ aria-live on all dynamic content regions
□ No aria-hidden on interactive elements
□ All decorative images aria-hidden or alt=""
□ All errors associated via aria-describedby

EMPTY AND INCOMPLETE STATES
□ No dark void empty states
□ No developer text in rendered UI
□ Every error state has a recovery action

STUBS AND FAKES
□ No setTimeout masking missing functionality
□ No onClick={() => {}} on visible elements
□ No window.prompt, window.alert, window.confirm
□ No "coming soon" in rendered UI
□ All useState consumed in render
□ All props consumed in component

DEPLOYMENT — REQUIRED AFTER EVERY PUSH
□ git status — zero untracked files that are imported by committed code
□ git rev-parse --show-toplevel — confirms correct repo root
□ git branch — confirms on main
□ git remote -v — confirms correct remote URL
□ npx tsc --noEmit — zero streams/ errors
□ git push origin main
□ git log --oneline -3 — latest commit hash matches what was just committed
□ Vercel deployment status checked — must show "Ready" before moving on
□ If "Error" — build log read in full, cause identified, fix verified locally, pushed again
□ Loop repeats until Vercel shows "Ready"
□ No new work begins while deployment is in failed state
```
