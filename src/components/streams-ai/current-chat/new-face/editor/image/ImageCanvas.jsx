export default function ImageCanvas({ asset, zoom = 1, compareMode = "current" }) {
  const size = asset?.width && asset?.height ? `${asset.width} × ${asset.height}` : "Size pending";

  return (
    <main aria-label="Image editor canvas">
      <div>Mode: {compareMode}</div>
      <div>Zoom: {Math.round(Number(zoom) * 100)}%</div>
      {asset?.previewUrl ? (
        <img src={asset.previewUrl} alt={asset.name || "Image canvas"} />
      ) : (
        <div>No image preview available.</div>
      )}
      <div>{size}</div>
    </main>
  );
}
