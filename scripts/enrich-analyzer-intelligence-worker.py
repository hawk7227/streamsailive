import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

def load_env():
    p = Path(".env.local")
    if not p.exists():
        return
    wanted = {
        "OPENAI_API_KEY",
        "OPENAI_API_KEY_IMAGES",
        "OPENAI_VISION_MODEL",
        "OPENAI_TRANSCRIBE_MODEL",
        "ADMIN_GENERATION_KEY",
        "BASE_URL",
        "STREAMS_PUBLIC_URL",
    }
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in wanted:
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))

def ensure_openai():
    try:
        import openai  # noqa
    except Exception:
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "openai"], check=True)

def http_json(url, method="GET", body=None, headers=None):
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def download(url, dest):
    urllib.request.urlretrieve(url, dest)
    return dest

def event(base_url, analysis_id, admin_key, event_type, status, message):
    http_json(
        f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/worker-event",
        method="POST",
        headers={"Authorization": f"Bearer {admin_key}"},
        body={
            "eventType": event_type,
            "status": status,
            "message": message,
            "analysisStatus": "analyzing",
        },
    )

def json_from_text(text):
    text = (text or "").strip()
    match = re.search(r"```json\s*(.*?)```", text, flags=re.S | re.I)
    if match:
        text = match.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start:end + 1]
    return json.loads(text)

def kind(asset):
    return str(asset.get("asset_kind") or asset.get("assetKind") or "")

def url_of(asset):
    return asset.get("asset_url") or asset.get("assetUrl") or asset.get("url") or ""

def post_asset(asset):
    return {
        "assetKind": kind(asset) or "reference",
        "assetUrl": url_of(asset),
        "storageBucket": asset.get("storage_bucket") or asset.get("storageBucket"),
        "storagePath": asset.get("storage_path") or asset.get("storagePath"),
        "startSec": float(asset.get("start_sec") or asset.get("startSec") or 0),
        "endSec": float(asset.get("end_sec") or asset.get("endSec") or 0),
        "mimeType": asset.get("mime_type") or asset.get("mimeType"),
        "metadata": asset.get("metadata") or {},
    }

def post_segment(segment, enriched):
    metadata = dict(segment.get("metadata") or {})
    metadata.update(enriched or {})
    return {
        "segmentType": segment.get("segment_type") or segment.get("segmentType") or "shot",
        "segmentIndex": int(segment.get("segment_index") or segment.get("segmentIndex") or metadata.get("segmentIndex") or 1),
        "startSec": float(segment.get("start_sec") or segment.get("startSec") or metadata.get("startSec") or 0),
        "endSec": float(segment.get("end_sec") or segment.get("endSec") or metadata.get("endSec") or 0),
        "label": metadata.get("sceneTitle") or metadata.get("shotTitle") or segment.get("label") or "Enriched shot",
        "transcript": metadata.get("transcript") or segment.get("transcript"),
        "frameAssetIds": segment.get("frame_asset_ids") or segment.get("frameAssetIds") or [],
        "metadata": metadata,
    }

def build_provider_prompt(title, shots, visual, audio):
    lines = [
        "Create or edit a video using this analyzed reference blueprint.",
        f"Reference title: {title}",
        "",
        "Shot-by-shot blueprint:",
    ]
    for shot in shots:
        subjects = shot.get("subjects")
        subjects_text = ", ".join(subjects[:6]) if isinstance(subjects, list) else str(subjects or "")
        lines.append(
            f"- Shot {shot.get('shotIndex')}: {shot.get('sceneDescription')}. "
            f"Time {shot.get('startSec')}–{shot.get('endSec')}s. "
            f"Subjects/objects/products: {subjects_text}. "
            f"Camera: {shot.get('cameraMovement')}. "
            f"Lighting: {shot.get('lighting')}. "
            f"Motion: {shot.get('motion')}. "
            f"Environment: {shot.get('environment')}. "
            f"Edit intent: {shot.get('editIntent')}."
        )
    lines.extend([
        "",
        f"Overall visual style: {visual.get('style')}",
        f"Lighting style: {visual.get('lightingStyle')}",
        f"Composition style: {visual.get('compositionStyle')}",
        f"Camera language: {visual.get('cameraLanguage')}",
        f"Audio style: {audio.get('soundDesign')}",
        f"Voice/narration: {audio.get('voiceStyle') or audio.get('narrationTone')}",
        "",
        "Preserve timing, pacing, subject continuity, framing, camera language, lighting, motion, and sound design from the analyzed reference.",
    ])
    return "\n".join(lines)

def main():
    load_env()
    ensure_openai()
    from openai import OpenAI

    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/enrich-analyzer-intelligence-worker.py <analysisId>")

    analysis_id = sys.argv[1]
    base_url = os.environ.get("BASE_URL") or os.environ.get("STREAMS_PUBLIC_URL") or "https://streamsailive.vercel.app"
    admin_key = os.environ.get("ADMIN_GENERATION_KEY")
    api_key = os.environ.get("OPENAI_API_KEY_IMAGES") or os.environ.get("OPENAI_API_KEY")
    vision_model = os.environ.get("OPENAI_VISION_MODEL") or "gpt-4o-mini"
    transcribe_model = os.environ.get("OPENAI_TRANSCRIBE_MODEL") or "whisper-1"

    if not admin_key:
        raise SystemExit("ADMIN_GENERATION_KEY is required in .env.local")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY or OPENAI_API_KEY_IMAGES is required in .env.local")

    client = OpenAI(api_key=api_key)
    event(base_url, analysis_id, admin_key, "enrichment_started", "running", "Analyzer enrichment worker started")

    data = http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/intelligence")
    analysis = data.get("analysis") or {}
    intelligence = data.get("intelligence") or {}
    assets = intelligence.get("assets") or []
    segments = intelligence.get("segments") or []

    frames = [asset for asset in assets if "frame" in kind(asset) and url_of(asset)]
    audios = [asset for asset in assets if "audio" in kind(asset) and url_of(asset)]

    if not frames:
        raise RuntimeError("No frame assets found. Run the video analyzer worker first.")
    if not segments:
        raise RuntimeError("No segments found. Run the video analyzer worker first.")

    event(base_url, analysis_id, admin_key, "vision_analysis_started", "running", "Analyzing frames with vision model")

    prompt = (
        "You are a production video reference analyzer. Analyze the provided frame sequence and return JSON only. "
        "Required JSON shape: {"
        "\"overall\":{\"style\":\"\",\"colorPalette\":\"\",\"lightingStyle\":\"\",\"compositionStyle\":\"\",\"cameraLanguage\":\"\",\"environment\":\"\",\"pacing\":\"\",\"productionDesign\":\"\"},"
        "\"frameDescriptions\":[{\"frameIndex\":1,\"description\":\"\",\"subjects\":[\"\"],\"objects\":[\"\"],\"products\":[\"\"],\"lighting\":\"\",\"composition\":\"\",\"environment\":\"\",\"motionCue\":\"\"}],"
        "\"segments\":[{\"segmentIndex\":1,\"shotTitle\":\"\",\"sceneTitle\":\"\",\"sceneDescription\":\"\",\"subjects\":[\"\"],\"objects\":[\"\"],\"products\":[\"\"],\"cameraMovement\":\"\",\"lensComposition\":\"\",\"lighting\":\"\",\"environment\":\"\",\"motion\":\"\",\"pacing\":\"\",\"editIntent\":\"\",\"recommendedEditActions\":[\"\"],\"negativePrompt\":\"\"}],"
        "\"qaIssues\":[\"\"],\"editRecommendations\":[\"\"]}. "
        "Create one segment object for each time slice if possible. Base descriptions only on visible frame content."
    )

    content = [{"type": "text", "text": prompt}]
    for frame in frames[:12]:
        content.append({"type": "image_url", "image_url": {"url": url_of(frame)}})

    response = client.chat.completions.create(
        model=vision_model,
        temperature=0.2,
        messages=[{"role": "user", "content": content}],
    )
    vision = json_from_text(response.choices[0].message.content or "{}")

    transcript = ""
    audio_language = {
        "voiceStyle": "pending audio transcription",
        "narrationTone": "pending audio transcription",
        "musicStyle": "pending audio transcription",
        "soundDesign": "pending audio transcription",
        "pacing": "pending audio transcription",
        "transcript": "",
        "speakerSections": [],
        "editRecommendations": [],
    }

    if audios:
        event(base_url, analysis_id, admin_key, "audio_transcription_started", "running", "Transcribing extracted audio")
        with tempfile.TemporaryDirectory() as td:
            audio_path = Path(td) / "audio.wav"
            download(url_of(audios[0]), audio_path)
            with audio_path.open("rb") as audio_file:
                tx = client.audio.transcriptions.create(
                    model=transcribe_model,
                    file=audio_file,
                    response_format="json",
                )
            transcript = getattr(tx, "text", "") or (tx.get("text") if isinstance(tx, dict) else "") or ""

        audio_prompt = (
            "Analyze this transcript/audio content for video production. Return JSON only with keys: "
            "voiceStyle, narrationTone, musicStyle, soundDesign, pacing, speakerSections, editRecommendations.\n\n"
            f"Transcript:\n{transcript[:12000]}"
        )
        audio_response = client.chat.completions.create(
            model=vision_model,
            temperature=0.2,
            messages=[{"role": "user", "content": audio_prompt}],
        )
        parsed_audio = json_from_text(audio_response.choices[0].message.content or "{}")
        audio_language.update(parsed_audio)
        audio_language["transcript"] = transcript

    overall = vision.get("overall") or {}
    enriched_list = vision.get("segments") or []
    enriched_by_index = {}
    for item in enriched_list:
        try:
            enriched_by_index[int(item.get("segmentIndex") or item.get("segment_index") or 0)] = item
        except Exception:
            pass

    post_segments = []
    shots = []
    for index, segment in enumerate(segments, start=1):
        segment_index = int(segment.get("segment_index") or segment.get("segmentIndex") or index)
        enriched = enriched_by_index.get(segment_index, {})
        enriched.setdefault("segmentIndex", segment_index)
        enriched.setdefault("startSec", float(segment.get("start_sec") or segment.get("startSec") or 0))
        enriched.setdefault("endSec", float(segment.get("end_sec") or segment.get("endSec") or 0))
        post_segments.append(post_segment(segment, enriched))
        shots.append({
            "shotIndex": segment_index,
            "startSec": enriched.get("startSec"),
            "endSec": enriched.get("endSec"),
            "sceneDescription": enriched.get("sceneDescription") or enriched.get("sceneTitle") or segment.get("label"),
            "sceneTitle": enriched.get("sceneTitle") or enriched.get("shotTitle") or segment.get("label"),
            "subjects": enriched.get("subjects") or [],
            "objects": enriched.get("objects") or [],
            "products": enriched.get("products") or [],
            "environment": enriched.get("environment"),
            "cameraMovement": enriched.get("cameraMovement"),
            "lensComposition": enriched.get("lensComposition"),
            "lighting": enriched.get("lighting"),
            "motion": enriched.get("motion"),
            "pacing": enriched.get("pacing"),
            "editIntent": enriched.get("editIntent"),
            "recommendedEditActions": enriched.get("recommendedEditActions") or [],
            "negativePrompt": enriched.get("negativePrompt"),
        })

    visual_language = {
        "style": overall.get("style") or "analyzed visual style",
        "colorPalette": overall.get("colorPalette") or "analyzed color palette",
        "lightingStyle": overall.get("lightingStyle") or "analyzed lighting style",
        "compositionStyle": overall.get("compositionStyle") or "analyzed composition",
        "cameraLanguage": overall.get("cameraLanguage") or "analyzed camera language",
        "environment": overall.get("environment") or "analyzed environment",
        "productionDesign": overall.get("productionDesign") or "analyzed production design",
        "pacing": overall.get("pacing") or "analyzed pacing",
        "frameDescriptions": vision.get("frameDescriptions") or [],
    }

    title = (
        (((analysis.get("blueprint") or {}).get("summary") or {}).get("title"))
        or analysis.get("summary")
        or "Analyzed video reference"
    )
    provider_prompt = build_provider_prompt(title, shots, visual_language, audio_language)
    negative_prompt = "no watermarks, no logos, no distorted people, no broken hands, no identity drift, no unreadable text, no sudden continuity jumps, no extra subjects unless requested"

    blueprint = {
        "source": (analysis.get("blueprint") or {}).get("source") or {
            "url": analysis.get("sourceUrl") or analysis.get("source_url"),
            "type": analysis.get("sourceType") or analysis.get("source_type"),
            "title": title,
        },
        "summary": {
            "title": title,
            "conciseSummary": "Reference enriched with frame, segment, visual, audio, transcript, and provider blueprint analysis.",
            "recreateGoal": "Create or edit video using the enriched shot-by-shot analyzer blueprint.",
        },
        "shots": shots,
        "timingMap": [{"startSec": shot["startSec"], "endSec": shot["endSec"], "label": shot["sceneDescription"]} for shot in shots],
        "visualLanguage": visual_language,
        "audioLanguage": audio_language,
        "generation": {
            "recommendedMode": "image-to-video",
            "recommendedProvider": "provider-router",
            "providerReadyPrompt": provider_prompt,
            "recreatePrompt": provider_prompt,
            "negativePrompt": negative_prompt,
            "editRecommendations": vision.get("editRecommendations") or audio_language.get("editRecommendations") or [],
        },
        "qa": {"issues": vision.get("qaIssues") or []},
    }

    event(base_url, analysis_id, admin_key, "blueprint_write_started", "running", "Writing enriched analyzer blueprint")
    post_assets = [post_asset(asset) for asset in assets]
    http_json(
        f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/intelligence",
        method="POST",
        headers={"Authorization": f"Bearer {admin_key}"},
        body={
            "status": "completed",
            "summary": blueprint["summary"]["conciseSummary"],
            "transcript": transcript,
            "blueprint": blueprint,
            "assets": post_assets,
            "segments": post_segments,
            "subjects": [],
            "speakers": audio_language.get("speakerSections") or [],
            "motionProfiles": [{
                "targetType": "project",
                "motionProfile": {"summary": visual_language.get("pacing"), "segments": shots},
                "cameraMotionProfile": {"summary": visual_language.get("cameraLanguage"), "segments": shots},
                "metadata": {"source": "openai_enrichment_worker"},
            }],
            "qualityReports": [{
                "status": "completed",
                "report": {"qaIssues": blueprint["qa"]["issues"], "editRecommendations": blueprint["generation"]["editRecommendations"]},
                "issues": blueprint["qa"]["issues"],
                "metadata": {"source": "openai_enrichment_worker"},
            }],
            "mediaGraphs": [{
                "graph": {"blueprint": blueprint, "assets": post_assets, "segments": post_segments},
                "metadata": {"source": "openai_enrichment_worker"},
            }],
        },
    )

    event(base_url, analysis_id, admin_key, "enrichment_completed", "completed", "Analyzer enrichment worker completed")
    print("✅ Analyzer enrichment completed")
    print(f"analysisId={analysis_id}")
    print(f"segments={len(post_segments)}")
    print(f"transcript={'yes' if transcript else 'no'}")
    print(f"providerPromptChars={len(provider_prompt)}")

if __name__ == "__main__":
    main()
