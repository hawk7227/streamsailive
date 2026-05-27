from pathlib import Path
import re

shell_path = Path("src/components/streams-ai/current-chat/new-face/StreamsWorkspaceShell.jsx")
preview_path = Path("src/components/streams-ai/current-chat/new-face/preview/StreamsSplitPreview.jsx")

shell = shell_path.read_text(encoding="utf-8")
preview = preview_path.read_text(encoding="utf-8")

# ------------------------------------------------------------
# 1. Add shell helper: open latest assistant message that has real previewable source.
# ------------------------------------------------------------
if "function openLatestAssistantCodeInPreview" not in shell:
    marker = "function openAssistantMessageInPreview(content = \"\", title = \"Assistant Preview\") {"
    start = shell.find(marker)
    if start == -1:
        raise SystemExit("openAssistantMessageInPreview helper not found.")

    next_function = shell.find("\nfunction ChatInlineImage", start)
    if next_function == -1:
        raise SystemExit("Could not find insertion point after preview helpers.")

    helper = r'''
function openLatestAssistantCodeInPreview(messages = []) {
  const list = Array.isArray(messages) ? messages : [];

  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];

    if (!message || message.role !== "assistant") continue;

    const content = String(message.content || message.text || "");

    if (!hasPreviewableContent(content)) continue;

    return openAssistantMessageInPreview(content, "Latest Assistant Code");
  }

  return false;
}

'''
    shell = shell[:next_function] + "\n" + helper + shell[next_function:]

# ------------------------------------------------------------
# 2. Pass callback into StreamsSplitPreview where it is mounted in preview pane.
# ------------------------------------------------------------
old_mount = '<StreamsSplitPreview embedded initialOpen onClose={closePreview} />'
new_mount = '''<StreamsSplitPreview
    embedded
    initialOpen
    onClose={closePreview}
    onOpenLatestPreview={() => {
      const opened = openLatestAssistantCodeInPreview(chatRuntime?.messages);
      if (!opened) {
        window.alert("No previewable assistant code found yet.");
      }
    }}
  />'''

if old_mount in shell:
    shell = shell.replace(old_mount, new_mount)
elif "onOpenLatestPreview" not in shell:
    raise SystemExit("StreamsSplitPreview mount not found or already customized differently.")

shell_path.write_text(shell, encoding="utf-8")


# ------------------------------------------------------------
# 3. Add header button inside StreamsSplitPreview.
# ------------------------------------------------------------
# Normalize signature so prop exists.
preview = preview.replace(
    "export default function StreamsSplitPreview({ embedded = false, initialOpen = false, onClose } = {}) {",
    "export default function StreamsSplitPreview({ embedded = false, initialOpen = false, onClose, onOpenLatestPreview } = {}) {"
)

preview = preview.replace(
    "export default function StreamsSplitPreview(props = {}) {",
    "export default function StreamsSplitPreview(props = {}) {"
)

# If component uses props destructure block, add prop there too.
preview = preview.replace(
'''    onClose,
  } = props;''',
'''    onClose,
    onOpenLatestPreview,
  } = props;'''
)

# Add button before Show source.
if "Open latest code" not in preview:
    anchor = '''          <button
            type="button"
            onClick={() => setState((current) => ({ ...current, sourceVisible: !current.sourceVisible }))}
          >'''

    if anchor not in preview:
        anchor = '''          <button
            type="button"
            onClick={() =>
              setState((current) => ({
                ...current,
                sourceVisible: !current.sourceVisible,
              }))
            }
          >'''

    if anchor not in preview:
        raise SystemExit("Show source button anchor not found in StreamsSplitPreview.")

    latest_button = '''          {typeof onOpenLatestPreview === "function" ? (
            <button
              type="button"
              onClick={onOpenLatestPreview}
            >
              Open latest code
            </button>
          ) : null}

'''

    preview = preview.replace(anchor, latest_button + anchor, 1)

preview_path.write_text(preview, encoding="utf-8")

print("added Open latest code button to preview header")
