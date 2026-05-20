export default function DocumentEditorPanel({ asset }) {
  return (
    <section aria-label="Document editor panel">
      <h2>{asset?.name || "Document"}</h2>
      <div>Kind: {asset?.kind || "file"}</div>
      {asset?.summary ? <p>{asset.summary}</p> : <p>Summary pending</p>}
      {asset?.chunkCount ? <div>Chunks: {asset.chunkCount}</div> : null}
    </section>
  );
}
