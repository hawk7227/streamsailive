export default function Features() {
  const features = [
    {
      title: "AI Video Generation",
      description:
        "Create stunning 4K videos from text prompts. Perfect for YouTube, TikTok, ads, and more. Up to 60 second clips.",
      iconColors: "bg-gradient-to-br from-accent-indigo to-[#4f46e5]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      title: "Voice & Audio",
      description:
        "Natural-sounding voiceovers in 29 languages. Clone voices or choose from 50+ premium voices with emotion control.",
      iconColors: "bg-gradient-to-br from-accent-purple to-[#9333ea]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      ),
    },
    {
      title: "Image Creation",
      description:
        "Generate photorealistic images and illustrations. Multiple art styles, up to 2048x2048 resolution.",
      iconColors: "bg-gradient-to-br from-accent-orange to-[#ea580c]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      title: "Script Writing",
      description:
        "AI-powered copywriting for any format. Blog posts, ad copy, video scripts with brand voice matching.",
      iconColors: "bg-gradient-to-br from-accent-emerald to-[#059669]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      title: "Social Media",
      description:
        "Auto-generate captions, hashtags, and schedule posts across all your social channels.",
      iconColors: "bg-gradient-to-br from-accent-blue to-[#2563eb]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    },
    {
      title: "Brand Kit",
      description:
        "Store your logos, colors, and fonts to ensure consistent branding across all AI-generated content.",
      iconColors: "bg-gradient-to-br from-accent-pink to-[#db2777]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 text-white"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-24 bg-bg-secondary" id="features">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-[clamp(32px,4vw,48px)] font-bold mb-4">
            Powerful AI Tools
          </h2>
          <p className="text-lg text-text-secondary max-w-[600px] mx-auto">
            Everything you need to create professional content, powered by
            state-of-the-art AI models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-bg-tertiary border border-border-color rounded-3xl p-8 transition-all hover:border-border-hover hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] group"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${feature.iconColors}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-text-secondary text-[15px] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
