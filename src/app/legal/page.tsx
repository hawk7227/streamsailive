import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const policies = [
  {
    title: "Terms of Service",
    description: "How the platform works, acceptable use, and account rules.",
    href: "/terms",
  },
  {
    title: "Privacy Policy",
    description: "What data we collect and how we protect your information.",
    href: "/privacy",
  },
  {
    title: "Cookie Policy",
    description: "How cookies help us personalize and improve your experience.",
    href: "/cookies",
  },
];

export default function LegalPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Legal
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Review the policies that keep StreamsAI transparent and safe for
              everyone on the platform.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-6 grid gap-6">
            {policies.map((policy) => (
              <Link
                key={policy.title}
                href={policy.href}
                className="group bg-bg-secondary border border-border-color rounded-2xl p-6 transition hover:border-border-hover"
              >
                <h2 className="text-lg font-semibold mb-2">{policy.title}</h2>
                <p className="text-sm text-text-secondary">
                  {policy.description}
                </p>
                <span className="text-sm text-accent-indigo inline-flex items-center gap-2 mt-4">
                  Read more
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
