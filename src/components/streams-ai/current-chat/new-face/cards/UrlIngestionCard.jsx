export default function UrlIngestionCard({ item }) {
  return (
    <article aria-label="URL ingestion card">
      <strong>{item?.sourceType === "youtube" ? "Reading YouTube link" : "Reading link"}</strong>
      <div>{item?.url || ""}</div>
      <div>Metadata: {item?.metadataStatus || "pending"}</div>
      <div>Transcript: {item?.transcriptStatus || "pending"}</div>

      {item?.transcriptStatus === "unavailable" ? (
        <p>Transcript is not available from this link. Upload the video/audio file to analyze it directly.</p>
      ) : null}
    </article>
  );
}
