import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const contacts = [
  {
    label: "General",
    value: "hello@streamsai.com",
  },
  {
    label: "Support",
    value: "support@streamsai.com",
  },
  {
    label: "Partnerships",
    value: "partners@streamsai.com",
  },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h1 className="text-[clamp(32px,5vw,56px)] font-bold mb-4">
              Contact
            </h1>
            <p className="text-lg text-text-secondary">
              We would love to hear from you. Reach out and we will respond as
              soon as possible.
            </p>
          </div>
        </section>
        <section className="pb-24">
          <div className="max-w-3xl mx-auto px-6">
            <div className="bg-bg-secondary border border-border-color rounded-2xl p-8">
              <h2 className="text-xl font-semibold mb-6">
                Contact information
              </h2>
              <div className="grid gap-4">
                {contacts.map((contact) => (
                  <div
                    key={contact.label}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <span className="text-sm text-text-muted">
                      {contact.label}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {contact.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-text-secondary mt-6">
                Prefer a form? We can add a contact form here whenever you are
                ready.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
