import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const perks = [
  "Remote-first collaboration",
  "Flexible schedules and async friendly",
  "Learning budget for every teammate",
  "High-impact work across product and AI",
];

export default function CareersPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Careers at StreamsAI
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Join a team that ships fast, listens to creators, and builds with
              care. We are growing and always looking for curious builders.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-bg-secondary border border-border-color rounded-2xl p-8">
              <h2 className="text-xl font-semibold mb-4">Why work with us</h2>
              <ul className="grid gap-3 sm:grid-cols-2 text-sm text-text-secondary">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent-indigo" />
                    {perk}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-text-secondary mt-6">
                Open roles are posted soon. For now, send a note to
                careers@streamsai.com to introduce yourself.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
