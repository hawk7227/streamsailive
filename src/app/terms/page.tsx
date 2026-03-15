import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const terms = [
  "Use StreamsAI in line with all applicable laws and our acceptable use rules.",
  "You own the content you create and are responsible for its compliance.",
  "Subscription plans renew automatically unless canceled before renewal.",
  "Misuse or abuse of the platform may result in suspension.",
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-text-secondary">
              These terms outline how you can use StreamsAI and what you can
              expect from our services.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-bg-secondary border border-border-color rounded-2xl p-8">
              <h2 className="text-xl font-semibold mb-4">Highlights</h2>
              <ul className="grid gap-3 text-sm text-text-secondary">
                {terms.map((term) => (
                  <li key={term} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent-indigo mt-2" />
                    {term}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-secondary mt-6">
                Full legal terms will be provided as the platform grows.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
