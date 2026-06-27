# Visual Editor Good Start Lock

This file locks the first confirmed good-start checkpoint for the Streams Builder Visual Editing workstation.

## Confirmed by user

The user confirmed:

> Progress, I can actually edit the text on the screen now. Save this as a good start / lock it, then let's continue.

## Locked behavior

The Visual Editing workstation has reached a good-start state where:

1. Editor mode can load the original patientpanel page through the editable-preview route.
2. Text on the screen can be clicked and edited directly in place.
3. The old fake rebuilt editor page is no longer the desired direction.
4. The current direction is to preserve the real page look while enabling in-place editing.
5. Browser and Mobile modes should remain normal page-preview modes.
6. Advanced controls should stay secondary and should not block direct on-screen editing.

## Locked commits

The good-start checkpoint depends on these commits:

- `2c9197998ef7f294d91f0efa1b1f677dc00dd995` — updated `src/components/streams-builder/VisualEditingWorkstation.tsx` to use the original page through the editable preview path.
- `8ecf7c593a85ce512c6a5180ad02be234512aa3f` — updated `src/app/api/streams-builder/editable-preview/route.ts` to strip client scripts and keep the editable proxy from throwing the target page's client-side exception.

## Files included in this lock

- `src/components/streams-builder/VisualEditingWorkstation.tsx`
- `src/app/api/streams-builder/editable-preview/route.ts`

## Do not regress

Future changes must not return to:

- fake rebuilt frontend mockups in Editor mode
- guessed x/y parent overlays on top of a cross-origin iframe
- floating popup editor panels as the primary edit method
- visible duplicate text layers over the real page
- source-section lists as the main user editing surface

## Next work after this lock

Continue from this checkpoint by improving the real original-page editable flow:

1. Make the editable preview preserve all original styling/assets as closely as possible.
2. Improve editable targeting so only the intended clicked text becomes editable.
3. Map edited text back to the correct source file/string reliably.
4. Add image replacement support from the real page.
5. Add safe staged save/apply/push workflow after visual approval.
