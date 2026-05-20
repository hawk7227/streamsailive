export default function IngestionStatusCard({ job }) {
  return (
    <article aria-label="Ingestion status card">
      <strong>Reading {job?.kind || "file"}</strong>
      <div>Status: {job?.status || "queued"}</div>
      <div>Progress: {Number(job?.progress || 0)}%</div>
      {job?.summary ? <p>{job.summary}</p> : null}
      {job?.error ? <div role="alert">{job.error}</div> : null}
    </article>
  );
}
