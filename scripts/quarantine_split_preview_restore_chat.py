from pathlib import Path

# 1. Remove split preview imports/rendering from the active shell.
shell_path = Path("src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx")
s = shell_path.read_text(encoding="utf-8")

s = s.replace('import StreamsSplitPreview from "./preview/StreamsSplitPreview";\n', "")
s = s.replace('import StreamsSplitPreviewProofButton from "./preview/StreamsSplitPreviewProofButton";\n', "")

# Remove any local PreviewSlide wrapper using StreamsSplitPreview.
start = s.find("function PreviewSlide({ close }) {")
if start != -1:
    end = s.find("\n}\n\n", start)
    if end != -1:
        s = s[:start] + s[end + 3:]

# Replace embedded split preview usage with a safe static placeholder so PreviewWorkspace does not crash.
s = s.replace("<StreamsSplitPreview />", '<div className="previewEmptyState">Preview is paused while chat is being restored.</div>')
s = s.replace("<StreamsSplitPreview embedded initialOpen onClose={closePreview} />", '<div className="previewEmptyState">Preview is paused while chat is being restored.</div>')
s = s.replace("<PreviewSlide close={closePreview} />", '<div className="previewEmptyState">Preview is paused while chat is being restored.</div>')
s = s.replace("<StreamsSplitPreviewProofButton />", "")

shell_path.write_text(s, encoding="utf-8")


# 2. Remove preview-only interception from chat runtime.
runtime_path = Path("src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js")
r = runtime_path.read_text(encoding="utf-8")

r = r.replace('import { openPreviewOnlyArtifact, isPreviewOnlyRequest } from "../runtime/streamsSplitPreviewBridge";\n', "")

start = r.find("    const requestedPreviewOnly = isPreviewOnlyRequest(trimmed);")
if start != -1:
    end = r.find("    const requestedWebSearch =", start)
    if end == -1:
        raise SystemExit("Could not find requestedWebSearch marker after preview-only branch.")
    r = r[:start] + "    // Split Preview command routing is quarantined until normal chat is green.\n" + r[end:]

runtime_path.write_text(r, encoding="utf-8")

print("Quarantined split preview from active chat runtime.")
