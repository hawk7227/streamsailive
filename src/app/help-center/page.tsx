import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const topics = [
  {
    title: "Getting Started",
    description: "Create your first workspace and generate content in minutes.",
  },
  {
    title: "Billing & Plans",
    description: "Understand plans, invoices, and usage-based pricing.",
  },
  {
    title: "Account & Security",
    description: "Manage your profile, password, and authentication options.",
  },
  {
    title: "Troubleshooting",
    description: "Resolve common issues with generation and exports.",
  },
];

export default function HelpCenterPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Help Center
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Find guides, best practices, and answers to common questions about
              using StreamsAI.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-6 grid gap-6 md:grid-cols-2">
            {topics.map((topic) => (
              <div
                key={topic.title}
                className="bg-bg-secondary border border-border-color rounded-2xl p-6"
              >
                <h2 className="text-lg font-semibold mb-2">{topic.title}</h2>
                <p className="text-sm text-text-secondary">
                  {topic.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
