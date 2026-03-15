export default function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Jenkins",
      role: "Content Creator",
      content:
        "StreamsAI has completely transformed how I create content. The video generation quality is unlike anything else I've seen.",
      avatar: "SJ",
      avatarColor: "bg-gradient-to-br from-[#6366f1] to-[#a855f7]",
    },
    {
      name: "David chen",
      role: "Marketing Director",
      content:
        "We've cut our production time by 80%. The brand kit feature ensures everything stays on brand automatically.",
      avatar: "DC",
      avatarColor: "bg-gradient-to-br from-[#10b981] to-[#059669]",
    },
    {
      name: "Emily Rodriguez",
      role: "Social Media Manager",
      content:
        "The script writing tool understands context perfectly. It's like having a copywriter available 24/7.",
      avatar: "ER",
      avatarColor: "bg-gradient-to-br from-[#f97316] to-[#ea580c]",
    },
  ];

  return (
    <section className="py-24 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-[clamp(32px,4vw,48px)] font-bold mb-4">
            Loved by Creators
          </h2>
          <p className="text-lg text-text-secondary max-w-[600px] mx-auto">
            Join thousands of content creators who are scaling their production
            with StreamsAI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-bg-tertiary border border-border-color rounded-3xl p-8"
            >
              <div className="flex text-[#fbbf24] gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <p className="text-text-secondary text-base leading-relaxed mb-6">
                "{testimonial.content}"
              </p>
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white ${testimonial.avatarColor}`}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-semibold text-[15px]">
                    {testimonial.name}
                  </h4>
                  <p className="text-text-muted text-[13px]">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
