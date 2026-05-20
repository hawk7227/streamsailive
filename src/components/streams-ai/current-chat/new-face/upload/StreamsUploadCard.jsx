export default function StreamsUploadCard({ item }) {
  const progress = Number(item?.progress || 0);
  const status = item?.status || "queued";

  return (
    <article aria-label="Upload progress">
      <strong>{item?.name || "Upload"}</strong>
      <div>Status: {status}</div>
      <progress value={progress} max="100" aria-label="Upload percentage" />
      <div>{progress}%</div>
      {item?.error ? <div role="alert">{item.error}</div> : null}
    </article>
  );
}
