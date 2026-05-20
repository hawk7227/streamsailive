export default function UploadProgressCard({ upload }) {
  return (
    <article aria-label="Upload card">
      <strong>{upload?.name || "Upload"}</strong>
      <div>Status: {upload?.status || "queued"}</div>
      <div>Progress: {Number(upload?.progress || 0)}%</div>
    </article>
  );
}
