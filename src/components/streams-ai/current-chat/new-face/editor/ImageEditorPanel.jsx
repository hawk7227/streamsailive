export default function ImageEditorPanel({
  asset,
  onAnalyze,
  onEdit,
  onAnimate,
  onDownload,
}) {
  const size =
    asset?.width && asset?.height ? `${asset.width} × ${asset.height}` : "Size pending";

  return (
    <section aria-label="Image editor panel">
      <h2>{asset?.name || "Image"}</h2>

      {asset?.previewUrl ? (
        <img src={asset.previewUrl} alt={asset.name || "Image"} />
      ) : null}

      <div>{size}</div>

      {asset?.prompt ? <p>{asset.prompt}</p> : null}
      {asset?.source ? <div>Source: {asset.source}</div> : null}

      <button type="button" onClick={onAnalyze}>Analyze</button>
      <button type="button" onClick={onEdit}>Edit</button>
      <button type="button" onClick={onAnimate}>Animate</button>
      <button type="button" onClick={onDownload}>Download</button>
    </section>
  );
}
