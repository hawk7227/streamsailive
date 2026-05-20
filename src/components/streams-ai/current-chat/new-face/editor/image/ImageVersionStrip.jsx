export default function ImageVersionStrip({ versions = [], selectedVersionId = "", onSelectVersion }) {
  const safeVersions = versions.length
    ? versions
    : [{ id: "current", label: "Current image", status: "active" }];

  return (
    <footer aria-label="Image version strip">
      {safeVersions.map((version) => (
        <button
          key={version.id}
          type="button"
          aria-pressed={selectedVersionId === version.id || (!selectedVersionId && version.id === "current")}
          onClick={() => onSelectVersion?.(version.id)}
        >
          {version.label} · {version.status}
        </button>
      ))}
    </footer>
  );
}
