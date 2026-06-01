import json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

def load_env():
    p = Path(".env.local")
    if not p.exists(): return
    wanted = {"SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ADMIN_GENERATION_KEY","STREAMS_REFERENCE_BUCKET","BASE_URL","STREAMS_PUBLIC_URL"}
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        k = k.strip()
        if k in wanted:
            os.environ.setdefault(k, v.strip().strip('"').strip("'"))

def http_json(url, method="GET", body=None, headers=None):
    data = None
    req_headers = headers or {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def upload_file(local_path, bucket, remote_path, mime):
    supabase_url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")).rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{supabase_url}/storage/v1/object/{bucket}/{remote_path}"
    data = Path(local_path).read_bytes()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": mime,
        "x-upsert": "true",
    })
    with urllib.request.urlopen(req) as res:
        res.read()
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{remote_path}"

def run(cmd):
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError("Command failed: " + " ".join(cmd) + "\nSTDERR:\n" + (result.stderr or "") + "\nSTDOUT:\n" + (result.stdout or ""))
    return result.stdout

def main():
    load_env()
    analysis_id = sys.argv[1]
    base_url = os.environ.get("BASE_URL") or os.environ.get("STREAMS_PUBLIC_URL") or "https://streamsailive.vercel.app"
    admin_key = os.environ["ADMIN_GENERATION_KEY"]
    bucket = os.environ.get("STREAMS_REFERENCE_BUCKET", "reference-assets")
    auth = {"Authorization": f"Bearer {admin_key}"}

    def event(event_type, status, message, analysis_status="analyzing"):
        http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/worker-event", method="POST", headers=auth, body={
            "eventType": event_type, "status": status, "message": message, "analysisStatus": analysis_status
        })

    event("python_worker_started", "running", "Python ffmpeg worker started")
    analysis = http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}")["analysis"]
    source_url = analysis.get("sourceUrl")
    if not source_url:
        raise RuntimeError("No sourceUrl found on analysis")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        source = td / "source.mp4"
        frames_dir = td / "frames"
        frames_dir.mkdir()
        audio = td / "audio.wav"

        event("download_started", "running", "Downloading source video")
        urllib.request.urlretrieve(source_url, source)

        event("ffprobe_started", "running", "Reading metadata")
        metadata = json.loads(run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(source)]))

        event("frame_extract_started", "running", "Extracting frames")
        run(["ffmpeg", "-y", "-i", str(source), "-vf", "fps=1,scale=1280:-1", "-frames:v", "12", str(frames_dir / "frame-%03d.jpg")])

        event("audio_extract_started", "running", "Extracting audio")
        run(["ffmpeg", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", str(audio)])

        prefix = f"admingeneration/analyzer/{analysis_id}"
        assets, frame_urls = [], []

        for frame in sorted(frames_dir.glob("*.jpg")):
            remote = f"{prefix}/frames/{frame.name}"
            url = upload_file(frame, bucket, remote, "image/jpeg")
            frame_urls.append(url)
            assets.append({"assetKind":"frame","assetUrl":url,"storageBucket":bucket,"storagePath":remote,"mimeType":"image/jpeg","metadata":{"source":"python_ffmpeg_worker","fileName":frame.name}})

        audio_remote = f"{prefix}/audio/audio.wav"
        audio_url = upload_file(audio, bucket, audio_remote, "audio/wav")
        assets.append({"assetKind":"audio","assetUrl":audio_url,"storageBucket":bucket,"storagePath":audio_remote,"mimeType":"audio/wav","metadata":{"source":"python_ffmpeg_worker","role":"extracted_audio"}})

        duration = float(metadata.get("format", {}).get("duration") or 0)
        segment_count = max(1, min(6, int((duration + 4) // 5)))
        segments = []
        for i in range(segment_count):
            segments.append({
                "segmentType":"shot","segmentIndex":i+1,"startSec":i*5,"endSec":min(duration or (i+1)*5, (i+1)*5),
                "label":f"Timeline segment {i+1}","frameAssetIds":frame_urls,
                "metadata":{"source":"python_ffmpeg_worker","detectionMode":"deterministic_time_slices","note":"Real frames/audio extracted. Model shot detection comes next."}
            })

        event("intelligence_write_started", "running", "Writing intelligence graph")
        http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/intelligence", method="POST", headers=auth, body={
            "status":"analyzing",
            "summary":"FFmpeg worker extracted metadata, frames, and audio from uploaded video.",
            "assets":assets,
            "segments":segments,
            "subjects":[],
            "speakers":[],
            "motionProfiles":[{"targetType":"project","motionProfile":{"status":"pending_model_analysis"},"cameraMotionProfile":{"status":"pending_model_analysis"},"metadata":{"source":"python_ffmpeg_worker"}}],
            "qualityReports":[{"status":"pending_model_qc","report":{"ffprobe":metadata,"assets":len(assets)},"issues":[]}],
            "mediaGraphs":[{"graph":{"source":source_url,"assets":assets,"segments":segments,"metadata":metadata},"metadata":{"source":"python_ffmpeg_worker"}}],
        })

    event("python_worker_completed", "completed", "Python ffmpeg worker completed")
    print("✅ Python ffmpeg worker completed")

if __name__ == "__main__":
    main()
