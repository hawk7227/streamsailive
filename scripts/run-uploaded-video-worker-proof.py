import json, os, subprocess, sys, time, urllib.request
from pathlib import Path

def load_env():
    p = Path(".env.local")
    if not p.exists(): return
    wanted = {"SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ADMIN_GENERATION_KEY","STREAMS_REFERENCE_BUCKET"}
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        k = k.strip()
        if k in wanted:
            os.environ[k] = v.strip().strip('"').strip("'")

def http_json(url, method="GET", body=None, headers=None):
    data = None
    req_headers = headers or {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def upload_source(file_path, bucket):
    supabase_url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")).rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    safe_name = Path(file_path).name.replace(" ", "-").replace("(", "").replace(")", "")
    object_path = f"admingeneration/reference/local-proof/{int(time.time() * 1000)}-{safe_name}"
    url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
    data = Path(file_path).read_bytes()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {service_key}", "apikey": service_key, "Content-Type": "video/mp4", "x-upsert": "true"
    })
    with urllib.request.urlopen(req) as res:
        res.read()
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"

def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/run-uploaded-video-worker-proof.py /path/to/video.mp4")
    load_env()
    video_file = sys.argv[1]
    base_url = os.environ.get("BASE_URL", "https://streamsailive.vercel.app")
    project_id = os.environ.get("PROJECT_ID", "fb7bf446-78c9-4905-80bc-32a19d0f9803")
    bucket = os.environ.get("STREAMS_REFERENCE_BUCKET", "reference-assets")
    if not Path(video_file).exists():
        raise SystemExit(f"Video file not found: {video_file}")
    for key in ["ADMIN_GENERATION_KEY","SUPABASE_SERVICE_ROLE_KEY"]:
        if not os.environ.get(key):
            raise SystemExit(f"{key} is required in .env.local")

    print("==============================================")
    print("PYTHON ONLY REAL LOCAL MP4 WORKER PROOF")
    print(f"VIDEO_FILE={video_file}")
    print(f"BASE_URL={base_url}")
    print(f"BUCKET={bucket}")
    print("==============================================")

    source_url = upload_source(video_file, bucket)
    print("✅ uploaded directly to Supabase Storage")
    print(f"SOURCE_URL={source_url}")

    analysis = http_json(f"{base_url}/api/admingeneration/reference/analyze", method="POST", body={
        "sourceType":"upload","sourceUrl":source_url,"projectId":project_id,"title":Path(video_file).name
    })
    analysis_id = analysis.get("analysisId") or analysis.get("analysis", {}).get("id")
    print(f"✅ analysis created: {analysis_id}")

    job = http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/worker-jobs", method="POST", body={"requestedProfile":"admin_full"})
    job_id = job["job"]["id"]
    print(f"✅ worker job created: {job_id}")

    subprocess.run(["ffmpeg", "-version"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["ffprobe", "-version"], check=True, stdout=subprocess.DEVNULL)
    print("✅ ffmpeg + ffprobe available")

    print("Running Python ffmpeg worker...")
    env = os.environ.copy()
    env["BASE_URL"] = base_url
    env["STREAMS_PUBLIC_URL"] = base_url
    subprocess.run([sys.executable, "scripts/video-analyzer-worker.py", analysis_id], check=True, env=env)

    intelligence = http_json(f"{base_url}/api/admingeneration/reference/analyze/{analysis_id}/intelligence")
    assets = intelligence.get("intelligence", {}).get("assets", [])
    segments = intelligence.get("intelligence", {}).get("segments", [])
    frames = [a for a in assets if "frame" in str(a.get("asset_kind",""))]
    audio = [a for a in assets if "audio" in str(a.get("asset_kind",""))]
    if not assets or not segments or not frames or not audio:
        raise RuntimeError(f"Missing intelligence assets/segments. assets={len(assets)} frames={len(frames)} audio={len(audio)} segments={len(segments)}")
    print(f"✅ intelligence populated: assets={len(assets)} frames={len(frames)} audio={len(audio)} segments={len(segments)}")

    editor = http_json(f"{base_url}/api/admingeneration/editor/from-analysis", method="POST", body={"analysisId": analysis_id})
    editor_id = editor["editorProject"]["id"]
    print(f"✅ editor project created: {editor_id}")

    timeline = http_json(f"{base_url}/api/admingeneration/editor/projects/{editor_id}/timeline")
    counts = timeline.get("timeline", {}).get("counts", {})
    if not counts.get("assets", 0):
        raise RuntimeError(f"Timeline did not expose extracted assets: {counts}")
    print(f"✅ timeline route loaded with assets={counts.get('assets', 0)} segments={(counts.get('editorSegments', 0) + counts.get('intelligenceSegments', 0))}")

    print("==============================================")
    print("✅ REAL LOCAL MP4 WORKER PROOF COMPLETE")
    print(f"ANALYSIS_ID={analysis_id}")
    print(f"JOB_ID={job_id}")
    print(f"EDITOR_ID={editor_id}")
    print(f"SOURCE_URL={source_url}")
    print("==============================================")

if __name__ == "__main__":
    main()
