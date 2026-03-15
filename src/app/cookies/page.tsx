import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const cookies = [
  {
    title: "Essential",
    description: "Required to keep the site secure and enable core features.",
  },
  {
    title: "Preferences",
    description: "Remember settings like language, theme, and layout choices.",
  },
  {
    title: "Analytics",
    description: "Help us understand usage so we can improve StreamsAI.",
  },
];

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Cookie Policy
            </h1>
            <p className="text-lg text-text-secondary">
              We use cookies to keep StreamsAI reliable, personalize your
              experience, and measure performance.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-4xl mx-auto px-6 grid gap-6 md:grid-cols-3">
            {cookies.map((cookie) => (
              <div
                key={cookie.title}
                className="bg-bg-secondary border border-border-color rounded-2xl p-6"
              >
                <h2 className="text-lg font-semibold mb-2">{cookie.title}</h2>
                <p className="text-sm text-text-secondary">
                  {cookie.description}
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
