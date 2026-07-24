import VisionsClient from "./VisionsClient";

export const dynamic = "force-dynamic";

export default function StreamsVisionsPage() {
  if (process.env.STREAMS_VISIONS_ENABLED === "false") {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#060915", color: "white", padding: 24 }}>
        <section style={{ maxWidth: 520, textAlign: "center" }}>
          <h1>Streams Visions is turned off.</h1>
          <p style={{ color: "#aeb7d3" }}>The main Streams AI experience is unaffected.</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <VisionsClient />
      <section className="visionsVideoProof" aria-label="Visible sample vision video">
        <video
          src="/d4b2ed55-e055-4b75-8fcf-d0acf8f60c77.mp4"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
        />
        <div className="visionsVideoShade" aria-hidden="true" />
        <p>The path remembers.</p>
      </section>
      <style>{`
        .visionsVideoProof {
          position: fixed;
          z-index: 80;
          left: 50%;
          top: 170px;
          width: min(520px, calc(100vw - 32px));
          aspect-ratio: 16 / 9;
          transform: translateX(-50%);
          overflow: hidden;
          border-radius: 24px;
          background: #02040b;
          box-shadow: 0 30px 110px rgba(0,0,0,.8), 0 0 70px rgba(96,72,255,.25);
        }
        .visionsVideoProof video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: .58;
          filter: blur(3px) saturate(.72) brightness(.72);
          transform: scale(1.025);
        }
        .visionsVideoShade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at center, transparent 20%, rgba(2,3,10,.68) 92%), linear-gradient(180deg, rgba(3,5,14,.18), rgba(2,3,10,.58));
        }
        .visionsVideoProof p {
          position: absolute;
          z-index: 2;
          left: 16px;
          right: 16px;
          bottom: 20%;
          margin: 0;
          color: rgba(245,247,255,.96);
          text-align: center;
          font: 600 clamp(1.25rem, 3vw, 2rem)/1.1 Georgia, serif;
          letter-spacing: .04em;
          text-shadow: 0 4px 24px #000;
        }
        @media (max-width: 680px) {
          .visionsVideoProof { top: 150px; border-radius: 20px; }
        }
      `}</style>
    </>
  );
}
