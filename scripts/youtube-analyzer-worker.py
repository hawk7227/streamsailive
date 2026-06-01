import json
import os
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
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ADMIN_GENERATION_KEY",
        "STREAMS_REFERENCE_BUCKET",
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

def http_json(url, method="GET", body=None, headers=None):
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def upload_file(local_path, bucket, remote_path, mime_type):
    supabase_url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    url = f"{supabase_url}/storage/v1/object/{bucket}/{remote_path}"
    data = Path(local_path).read_bytes()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": mime_type,
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req) as res:
        res.read()
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{remote_path}"

def run(cmd, cwd=None):
    result = subprocess.run(cmd, text=True, capture_output=True, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(
            "Command failed: " + " ".join(cmd) +
            "\nSTDERR:\n" + (result.stderr or "") +
            "\nSTDOUT:\n" + (result.stdout or "")
        )
    return result.stdout

def ensure_ytdlp():
    try:
        run([sys.executable, "-m", "yt_dlp", "--version"])
    except Exception:
        print("Installing yt-dlp locally for YouTube downloader worker...")
        run([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"])

def main():
    load_env()
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/youtube-analyzer-worker.py <analysisId>")
    analysis_id = sys.argv[1]
    base_url = os.environ.get("BASE_URL") or os.environ.get("STREAMS_PUBLIC_URL") or "https://streamsailive.vercel.app"
    admin_key = os.environ["ADMIN_GENERATION_KEY"]
    bucket = os.environ.get("STREAMS_REFERENCE_BUCKET", "reference-assets")
    auth_headers = {"Authorization": f"Bearer {admin_key}"}

    def event(event_type, status, message, analysis_status="analyzing"):
        http_json(
            f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/worker-event",
            method="POST",
            headers=auth_headers,
            body={
                "eventType": event_type,
                "status": status,
                "message": message,
                "analysisStatus": analysis_status,
            },
        )

    response = http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}")
    analysis = response["analysis"]
    source_url = analysis.get("sourceUrl")
    if not source_url:
        raise RuntimeError("No sourceUrl found on analysis")
    if "youtube.com" not in source_url and "youtu.be" not in source_url:
        raise RuntimeError(f"Analysis source is not YouTube: {source_url}")

    ensure_ytdlp()
    event("youtube_worker_started", "running", "YouTube downloader worker started")

    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        template = str(work_dir / "source.%(ext)s")

        event("youtube_download_started", "running", "Downloading YouTube video source")
        run([
            sys.executable,
            "-m",
            "yt_dlp",
            "-f",
            "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
            "--merge-output-format",
            "mp4",
            "-o",
            template,
            source_url,
        ])

        candidates = sorted(work_dir.glob("source.*"))
        if not candidates:
            raise RuntimeError("yt-dlp completed but source file was not found")
        source_path = next((c for c in candidates if c.suffix.lower() == ".mp4"), candidates[0])

        frames_dir = work_dir / "frames"
        frames_dir.mkdir()
        audio_path = work_dir / "audio.wav"

        event("ffprobe_started", "running", "Reading YouTube video metadata")
        metadata = json.loads(run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(source_path)]))

        event("frame_extract_started", "running", "Extracting frames from YouTube video")
        run(["ffmpeg", "-y", "-i", str(source_path), "-vf", "fps=1,scale=1280:-1", "-frames:v", "12", str(frames_dir / "frame-%03d.jpg")])

        event("audio_extract_started", "running", "Extracting audio from YouTube video")
        run(["ffmpeg", "-y", "-i", str(source_path), "-vn", "-ac", "1", "-ar", "16000", str(audio_path)])

        prefix = f"admingeneration/analyzer/{analysis_id}"
        assets = []
        frame_urls = []

        video_remote = f"{prefix}/source/youtube-source.mp4"
        video_url = upload_file(source_path, bucket, video_remote, "video/mp4")
        assets.append({
            "assetKind": "source_video",
            "assetUrl": video_url,
            "storageBucket": bucket,
            "storagePath": video_remote,
            "mimeType": "video/mp4",
            "metadata": {"source": "youtube_downloader_worker", "originalUrl": source_url},
        })

        for frame_path in sorted(frames_dir.glob("*.jpg")):
            remote_path = f"{prefix}/frames/{frame_path.name}"
            public_url = upload_file(frame_path, bucket, remote_path, "image/jpeg")
            frame_urls.append(public_url)
            assets.append({
                "assetKind": "frame",
                "assetUrl": public_url,
                "storageBucket": bucket,
                "storagePath": remote_path,
                "mimeType": "image/jpeg",
                "metadata": {"source": "youtube_downloader_worker", "fileName": frame_path.name},
            })

        audio_remote_path = f"{prefix}/audio/audio.wav"
        audio_url = upload_file(audio_path, bucket, audio_remote_path, "audio/wav")
        assets.append({
            "assetKind": "audio",
            "assetUrl": audio_url,
            "storageBucket": bucket,
            "storagePath": audio_remote_path,
            "mimeType": "audio/wav",
            "metadata": {"source": "youtube_downloader_worker", "role": "extracted_audio"},
        })

        duration = float(metadata.get("format", {}).get("duration") or 0)
        segment_count = max(1, min(6, int((duration + 4) // 5)))
        segments = []
        for index in range(segment_count):
            segments.append({
                "segmentType": "shot",
                "segmentIndex": index + 1,
                "startSec": index * 5,
                "endSec": min(duration or (index + 1) * 5, (index + 1) * 5),
                "label": f"YouTube timeline segment {index + 1}",
                "frameAssetIds": frame_urls,
                "metadata": {
                    "source": "youtube_downloader_worker",
                    "detectionMode": "deterministic_time_slices",
                    "note": "Real video/audio downloaded and extracted. Model shot detection comes next.",
                },
            })

        event("intelligence_write_started", "running", "Writing YouTube intelligence graph")
        http_json(
            f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/intelligence",
            method="POST",
            headers=auth_headers,
            body={
                "status": "analyzing",
                "summary": "YouTube downloader worker downloaded video, extracted metadata, frames, and audio.",
                "assets": assets,
                "segments": segments,
                "subjects": [],
                "speakers": [],
                "motionProfiles": [{
                    "targetType": "project",
                    "motionProfile": {"status": "pending_model_analysis"},
                    "cameraMotionProfile": {"status": "pending_model_analysis"},
                    "metadata": {"source": "youtube_downloader_worker"},
                }],
                "qualityReports": [{
                    "status": "pending_model_qc",
                    "report": {"ffprobe": metadata, "assets": len(assets)},
                    "issues": [],
                }],
                "mediaGraphs": [{
                    "graph": {"source": source_url, "downloadedVideo": video_url, "assets": assets, "segments": segments, "metadata": metadata},
                    "metadata": {"source": "youtube_downloader_worker"},
                }],
            },
        )

    event("youtube_worker_completed", "completed", "YouTube downloader worker completed")
    print("✅ YouTube downloader worker completed")

if __name__ == "__main__":
    main()
