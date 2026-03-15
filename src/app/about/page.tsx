import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const highlights = [
  {
    title: "Mission",
    description:
      "Help creators turn ideas into polished content faster with reliable AI tools.",
  },
  {
    title: "Focus",
    description:
      "Streamline every step from scripting to publishing with an all-in-one platform.",
  },
  {
    title: "Promise",
    description:
      "Build with transparency, privacy, and performance at the center of every release.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              About StreamsAI
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              StreamsAI is an AI creation suite built for modern teams. We make
              video, image, voice, and writing workflows feel effortless so you
              can focus on storytelling.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-6 grid gap-6 md:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="bg-bg-secondary border border-border-color rounded-2xl p-6 text-left"
              >
                <h2 className="text-lg font-semibold mb-2">{item.title}</h2>
                <p className="text-sm text-text-secondary">
                  {item.description}
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
