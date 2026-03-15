import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const points = [
  "Collect only the data needed to provide and improve StreamsAI.",
  "Never sell personal information to third parties.",
  "Secure data with encryption and strict access controls.",
  "Let you control marketing preferences and account data.",
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-text-secondary">
              We respect your privacy and design our platform to be transparent
              about the data we collect and how it is used.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-bg-secondary border border-border-color rounded-2xl p-8">
              <h2 className="text-xl font-semibold mb-4">Key commitments</h2>
              <ul className="grid gap-3 text-sm text-text-secondary">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent-indigo mt-2" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-secondary mt-6">
                This page is a summary. A full policy update will be published
                as StreamsAI evolves.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
