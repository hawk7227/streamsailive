# Separated Clip Continuity Format

Use this format when one large video prompt is broken into separate clips that the system auto-submits one by one.

Each provider entry is independent, so every generated clip must carry the shared scene setup again. The generator now detects this format in `/api/streams/generate-job` and wraps each clip with a continuity lock before it enters the queue.

```text
GLOBAL SETUP:
Same main character, same wardrobe, same camera language, same color palette, same lighting direction, same time period, same visual realism style.

SET A: Exterior street at night, same parked Buick, same wet pavement, same streetlight direction, same wardrobe.
CLIP 1: First shot action goes here.
CLIP 2: Second shot action goes here.
CLIP 3: Third shot action goes here.

SET B: Interior church, morning light through windows, new location but same character and wardrobe unless changed here.
CLIP 4: Fourth shot action goes here.
CLIP 5: Fifth shot action goes here.
```

Rules:

- Put the full shared setup once under `GLOBAL SETUP:`.
- Use the same `SET` label for clips that should share the same screen, room, street, car, lighting, wardrobe, props, and time of day.
- Change the `SET` label only when the video intentionally changes location or environment.
- Use `CLIP 1:`, `CLIP 2:`, etc. for each independent provider job.
- The backend repeats the global setup, the current set setup, previous clip handoff, current clip prompt, next clip handoff, and continuity rules for every queued clip.

Acceptance behavior:

- A single normal prompt still creates one job.
- A video prompt with two or more `CLIP:` or `SCENE:` markers creates a batch.
- The batch response includes `batch: true`, `sceneCount`, `bulkJobId`, and the created job list.
- The stored prompt for each child job is the continuity-locked prompt, not the raw isolated clip only.
