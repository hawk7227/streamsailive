"use client";

export default function ExecutionPreview({ result }: { result: any }) {
  if (!result) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {result.images?.map((img: any, i: number) => (
        <img key={i} src={img.url} width={150} alt={`Generated ${i + 1}`} />
      ))}
      {result.video && (
        <div style={{ marginTop: 12 }}>
          <video src={result.video.url} controls width={300} />
        </div>
      )}
    </div>
  );
}
