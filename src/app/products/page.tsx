import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CTA from "@/components/home/CTA";

export default function ProductsPage() {
  const products = [
    {
      id: "video",
      name: "Video Pro",
      description:
        "Generate stunning videos from text prompts. Perfect for YouTube, TikTok, product demos, and marketing campaigns with up to 4K resolution.",
      features: [
        "Text-to-video",
        "Up to 4K resolution",
        "60 second clips",
        "Multiple styles",
      ],
      price: "0.25",
      unit: "/second",
      popular: true,
      color: "from-accent-indigo to-accent-blue",
      iconColor: "video",
    },
    {
      id: "voice",
      name: "Voice Lab",
      description:
        "Natural text-to-speech with voice cloning. Create realistic voiceovers in any language with emotion control and custom voices.",
      features: [
        "50+ voices",
        "29 languages",
        "Voice cloning",
        "Emotion control",
      ],
      price: "0.02",
      unit: "/second",
      badge: "New",
      badgeColor: "bg-[#10b9811a] text-[#6ee7b7]",
      color: "from-accent-purple to-accent-pink",
      iconColor: "voice",
    },
    {
      id: "image",
      name: "Image Forge",
      description:
        "Photorealistic AI image generation. Create stunning images in any style with up to 2048x2048 resolution and advanced editing.",
      features: [
        "Photorealistic",
        "2048x2048 max",
        "Multiple styles",
        "Batch generation",
      ],
      price: "0.02",
      unit: "/image",
      color: "from-accent-orange to-accent-red",
      iconColor: "image",
    },
    {
      id: "script",
      name: "Script Studio",
      description:
        "AI-powered copywriting for any format. Create compelling scripts, blog posts, ad copy with brand voice matching and SEO optimization.",
      features: [
        "Multiple formats",
        "Brand voice",
        "SEO optimized",
        "A/B variations",
      ],
      price: "0.005",
      unit: "/word",
      color: "from-accent-emerald to-[#14b8a6]",
      iconColor: "script",
    },
    {
      id: "pipeline",
      name: "Pipeline Builder",
      description:
        "Connect AI tools into automated workflows. Create content at scale by chaining script, voice, and video generation steps.",
      features: [
        "Visual builder",
        "Custom logic",
        "API integration",
        "Team sharing",
      ],
      price: "Custom",
      unit: "",
      color: "from-accent-blue to-[#06b6d4]",
      iconColor: "pipeline",
    },
    {
      id: "avatar",
      name: "AI Avatars",
      description:
        "Create custom AI avatars for your videos. Choose from our library or create your own digital twin for consistent branding.",
      features: [
        "Custom avatars",
        "Lip sync",
        "Gesture control",
        "4K rendering",
      ],
      price: "Custom",
      unit: "",
      color: "from-accent-pink to-[#f472b6]",
      iconColor: "avatar",
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "video":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        );
      case "voice":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        );
      case "image":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        );
      case "script":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
      case "pipeline":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        );
      case "avatar":
        return (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 text-center overflow-hidden">
          <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(168,85,247,0.2)_0%,transparent_70%)] rounded-full blur-[80px] -top-[100px] left-1/2 -translate-x-1/2 animate-pulse-slow pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#a855f71a] border border-[#a855f733] rounded-full text-sm text-[#d8b4fe] mb-6">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              6 AI-Powered Products
            </div>
            <h1 className="text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.1] mb-6">
              Professional Tools for
              <br />
              <span className="bg-gradient-to-br from-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
                Every Creator
              </span>
            </h1>
            <p className="text-xl text-text-secondary max-w-[600px] mx-auto">
              Each product is optimized for specific creative tasks. Use them
              individually or chain them together in powerful pipelines.
            </p>
          </div>
        </section>

        {/* Products Grid */}
        <section className="pb-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-bg-secondary border border-border-color rounded-[28px] p-10 transition-all hover:border-border-hover hover:-translate-y-1.5 hover:shadow-[0_25px_50px_rgba(0,0,0,0.3)] relative overflow-hidden group"
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${product.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  <div className="flex items-start justify-between mb-6">
                    <div
                      className={`w-[72px] h-[72px] rounded-[20px] flex items-center justify-center bg-gradient-to-br ${product.color}`}
                    >
                      <div className="text-white w-9 h-9">
                        {getIcon(product.iconColor)}
                      </div>
                    </div>
                    {product.popular && (
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#6366f11a] text-[#a5b4fc]">
                        Most Popular
                      </span>
                    )}
                    {product.badge && (
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${product.badgeColor}`}
                      >
                        {product.badge}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold mb-3">{product.name}</h2>
                  <p className="text-text-secondary leading-relaxed mb-7 text-base">
                    {product.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-7">
                    {product.features.map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 text-sm text-text-secondary"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-[18px] h-[18px] text-accent-emerald flex-shrink-0"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-border-color">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {product.price === "Custom" ? "Custom" : `$${product.price}`}
                      </span>
                      {product.unit && (
                        <span className="text-sm text-text-muted">
                          {product.unit}
                        </span>
                      )}
                    </div>
                    <a
                      href="/signup"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-white/5 border border-border-color rounded-xl font-semibold text-sm text-white transition-all hover:bg-white/10 hover:border-border-hover group-hover:bg-white/10"
                    >
                      Try Free
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </>
  );
}
