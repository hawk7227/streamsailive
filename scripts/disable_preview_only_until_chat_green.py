from pathlib import Path

p = Path("src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js")
s = p.read_text(encoding="utf-8")

# Keep import harmless if used elsewhere, but disable the preview-only early-return branch.
start = s.find("    const requestedPreviewOnly = isPreviewOnlyRequest(trimmed);")
if start != -1:
    end = s.find("    const requestedWebSearch =", start)
    if end == -1:
        raise SystemExit("Could not find requestedWebSearch marker after preview-only branch.")

    replacement = '''    // Preview-only routing is temporarily disabled until normal chat is verified green.
    // Split Preview remains available through the preview pane, but normal chat must never be intercepted here.
'''
    s = s[:start] + replacement + s[end:]
    print("disabled preview-only interception branch")
else:
    print("preview-only interception branch not found; no change")

# Remove unused preview-only import only if no remaining usage exists.
if "isPreviewOnlyRequest(trimmed)" not in s and "openPreviewOnlyArtifact({" not in s:
    s = s.replace(
        'import { openPreviewOnlyArtifact, isPreviewOnlyRequest } from "../runtime/streamsSplitPreviewBridge";\n',
        ""
    )
    print("removed unused preview-only import")

p.write_text(s, encoding="utf-8")
