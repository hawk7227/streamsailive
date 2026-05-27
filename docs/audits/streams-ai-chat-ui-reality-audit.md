# STREAMS AI Chat UI Reality Audit

Status: Active audit before further frontend patching.

## Rule

Every visible user-facing control must be one of:

- Real and wired
- Partially wired with truthful limits
- Blocked with exact missing backend/route/provider/table
- Removed from default visible UI only if it is a duplicate legacy overlay, not a product capability

No fake provider lists.  
No fake Pro plan.  
No fake thinking/status.  
No static buttons.  
No local-only persistence where durable state is implied.  
No panels without close/outside/Escape/selection-close behavior.

---

## Confirmed fake/static/partial items

### Composer model/provider menu

File:
`src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx`

Current issue:
- Shows `Auto`, `fal.ai`, `Runway`, `Kling`, `Veo`, `ElevenLabs`
- Shows `Instant`, `Thinking`, `Pro`, `Configure...`
- These are local UI labels, not proven from a real provider availability endpoint.
- `Pro` is misleading because account plan must come from AuthContext/billing state.

Required:
- Remove user-facing fake provider list from default chat composer.
- Keep real runtime mode only if it affects request state.
- Configure must route to `/account/personalization` or `/account/modules`.
- If provider preference is not wired, show a truthful blocked state in account settings, not a fake menu.

Classification:
Static fake / must fix now.

---

### Clean sidebar account footer

File:
`src/components/streams-ai/current-chat/new-face/sidebar/StreamsCleanSidebar.jsx`

Current issue:
- Hardcoded `MARCUS HAWKINS`
- Hardcoded `Pro`
- Account footer does not open the account panel reliably.

Required:
- Use AuthContext user/profile/plan/workspace.
- Click opens `/account`.
- No hardcoded name.
- No hardcoded Pro.

Classification:
Static fake / must fix now.

---

### Sidebar controls

File:
`src/components/streams-ai/current-chat/new-face/sidebar/StreamsCleanSidebar.jsx`

Controls:
- New chat
- Search chats
- Projects
- Chat
- Images
- Videos
- Search
- Deep Research
- Editor
- Generate
- Reference
- Settings

Required:
- Every button must call a real route/action or open a real panel.
- Images/Search modal must only mount when clicked.
- X/outside/Escape closes.
- Mobile backdrop must not block sidebar clicks.

Classification:
Partially wired / must complete.

---

### Artifact actions

File:
`src/components/streams-ai/current-chat/new-face/artifact/artifactActions.js`

Current issue:
- Uses localStorage archive/delete.
- Returns “Archived artifact” and “Deleted local artifact.”
- This implies persistence that is not durable.

Required:
- Either wire to real artifact/project routes, or show truthful blocked state.
- Do not imply durable archive/delete if only local.

Classification:
Local-only fake persistence / must fix before calling production.

---

### Global overflow menu

File:
`src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx`

Controls:
- Start group chat
- View files in chat
- Move to project
- Pin chat
- Archive
- Delete

Required:
- Start group chat: real group chat route/state or blocked.
- View files: real files/media panel.
- Move to project: real project selector or blocked.
- Pin: real pinned state or blocked.
- Archive/Delete: real conversation/artifact mutation with confirmation.
- All menus close on outside click, Escape, route change, and item selection.

Classification:
Partial/unknown / audit required before patch.

---

### Message actions

Likely file:
`src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx`

Controls:
- Copy
- Like
- Dislike
- Share/export
- Regenerate
- More
- View sources
- Branch in new chat
- Read aloud

Required:
- Copy: clipboard copy.
- Like/dislike: real feedback event or blocked.
- Share/export: real share/export or blocked.
- Regenerate: real regenerate from prior user turn.
- View sources: only if sources exist.
- Branch: real new session with copied context.
- Read aloud: real TTS route or blocked.

Classification:
Needs source inspection.

---

### Status/thinking

Files:
`src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js`
`src/components/streams-ai/current-chat/new-face/status/activityMessages.js`
`src/components/streams-ai/current-chat/new-face/media/GenerationActivityStrip.jsx`

Current issue:
- Thinking can be real if tied to runtime pending state.
- Fake “Activity / Thought for X seconds” is not allowed unless derived from real turn timing/status events.

Required:
- Only show status from real runtime activity/job state.
- No fake provider thinking.

Classification:
Partially wired / verify.

---

### Snap Pic Click

Files:
`src/components/streams-ai/current-chat/new-face/capture/SnapPicClickCapture.jsx`
`src/components/streams-ai/current-chat/new-face/media/GeneratedVideoDock.jsx`

Current issue:
- Floating legacy pill was visible by default.
- Feature itself should not be removed.
- It should live in proper module/tool surface.

Required:
- No default floating pill.
- Snap Pic Click route/tool must open only when user chooses it.
- If capture/upload/analyze routes are real, wire them.
- If not, blocked state.

Classification:
Partial / remove legacy overlay only.

---

## Next build slices

### Slice A
Wire clean sidebar actions and account footer.

### Slice B
Fix composer model/provider menu:
- remove fake provider list
- remove fake Pro
- add close/outside/Escape/selection-close behavior
- configure routes to real account settings

### Slice C
Classify overflow menu and message actions.

### Slice D
Replace local-only artifact actions with real routes or truthful blocked state.

