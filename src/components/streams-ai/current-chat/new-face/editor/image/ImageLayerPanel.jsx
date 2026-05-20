export default function ImageLayerPanel({ asset, selectedLayerId, onSelectLayer }) {
  const layers = asset?.layers?.length
    ? asset.layers
    : [
        {
          id: asset?.id || "base_image",
          label: "Base image",
          type: "image",
          status: asset?.status || "ready",
        },
      ];

  return (
    <aside aria-label="Image layers and analysis">
      <h3>Layers</h3>
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          aria-pressed={selectedLayerId === layer.id}
          onClick={() => onSelectLayer?.(layer.id)}
        >
          {layer.label} · {layer.type} · {layer.status}
        </button>
      ))}

      <h3>Analysis</h3>
      {asset?.analysisSummary ? (
        <p>{asset.analysisSummary}</p>
      ) : (
        <p>No image analysis saved yet.</p>
      )}
    </aside>
  );
}
