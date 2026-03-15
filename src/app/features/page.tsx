import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CTA from "@/components/home/CTA";

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="relative py-24 text-center overflow-hidden">
          <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.2)_0%,transparent_70%)] rounded-full blur-[80px] -top-[100px] left-1/2 -translate-x-1/2 animate-pulse-slow pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <h1 className="text-[clamp(40px,6vw,64px)] font-extrabold leading-[1.1] mb-6">
              Everything You Need to
              <br />
              <span className="bg-gradient-to-br from-[#818cf8] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
                Create Amazing Content
              </span>
            </h1>
            <p className="text-xl text-text-secondary max-w-[700px] mx-auto mb-10">
              One platform for AI videos, images, voiceovers, and scripts.
              Powered by the world's best AI models, designed for creators who
              demand excellence.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-br from-accent-indigo to-accent-purple text-white rounded-2xl font-semibold text-base transition-all hover:shadow-[0_8px_30px_rgba(99,102,241,0.4)] hover:-translate-y-0.5"
              >
                Start Free Trial
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-border-color text-white rounded-2xl font-semibold text-base transition-all hover:bg-white/10 hover:border-border-hover">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Watch Demo
              </button>
            </div>
          </div>
        </section>

        {/* Main Features */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 space-y-32">
            {/* Video Feature */}
            <div className="flex flex-col lg:flex-row items-center gap-20">
              <div className="flex-1">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-accent-indigo to-[#4f46e5] flex items-center justify-center mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-4">AI Video Generation</h2>
                <p className="text-lg text-text-secondary leading-relaxed mb-8">
                  Create stunning videos from text prompts in seconds. Perfect
                  for YouTube, TikTok, product demos, and marketing campaigns.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "Text-to-video generation",
                    "Up to 4K resolution",
                    "60 second clips",
                    "Multiple aspect ratios",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b9811a] flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent-emerald"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-bg-secondary border border-border-color rounded-3xl p-10 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
                  <div className="w-[120px] h-[120px] rounded-[30px] bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center opacity-20">
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white"
                    >
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Feature */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-20">
              <div className="flex-1">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-accent-purple to-[#9333ea] flex items-center justify-center mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-4">Voice & Audio</h2>
                <p className="text-lg text-text-secondary leading-relaxed mb-8">
                  Generate natural-sounding voiceovers in any language. Clone
                  voices or choose from 50+ premium voices with emotion control.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "50+ premium voices",
                    "29 languages",
                    "Voice cloning",
                    "Emotion control",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b9811a] flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent-emerald"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-bg-secondary border border-border-color rounded-3xl p-10 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
                  <div className="w-[120px] h-[120px] rounded-[30px] bg-gradient-to-br from-[#a855f7] to-[#9333ea] flex items-center justify-center opacity-20">
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Images Feature */}
            <div className="flex flex-col lg:flex-row items-center gap-20">
              <div className="flex-1">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-accent-orange to-[#ea580c] flex items-center justify-center mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-4">Image Creation</h2>
                <p className="text-lg text-text-secondary leading-relaxed mb-8">
                  Generate photorealistic images and illustrations from text.
                  Multiple art styles and up to 2048x2048 resolution.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "Photorealistic images",
                    "Multiple art styles",
                    "Up to 2048x2048",
                    "Batch generation",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b9811a] flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent-emerald"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-bg-secondary border border-border-color rounded-3xl p-10 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
                  <div className="w-[120px] h-[120px] rounded-[30px] bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center opacity-20">
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Scripts Feature */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-20">
              <div className="flex-1">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-accent-emerald to-[#059669] flex items-center justify-center mb-6">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h2 className="text-4xl font-bold mb-4">Script Writing</h2>
                <p className="text-lg text-text-secondary leading-relaxed mb-8">
                  AI-powered copywriting for any format. Blog posts, ad copy,
                  video scripts with brand voice matching and SEO optimization.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "Multiple formats",
                    "Brand voice matching",
                    "SEO optimization",
                    "A/B variations",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b9811a] flex items-center justify-center flex-shrink-0">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent-emerald"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span className="text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-bg-secondary border border-border-color rounded-3xl p-10 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
                  <div className="w-[120px] h-[120px] rounded-[30px] bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center opacity-20">
                    <svg
                      width="60"
                      height="60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Features */}
        <section className="py-24 bg-bg-secondary">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-[clamp(32px,4vw,48px)] font-bold mb-4">
                Platform Features
              </h2>
              <p className="text-lg text-text-secondary max-w-[600px] mx-auto">
                Beyond generation, StreamsAI gives you everything to scale your
                content production.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Pipelines",
                  desc: "Chain tools together in automated workflows. Script → Voice → Video in one click.",
                  iconColor: "bg-[#6366f11a] text-accent-indigo",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  ),
                },
                {
                  title: "AI Copilot",
                  desc: "Your AI assistant helps optimize prompts and suggests improvements.",
                  iconColor: "bg-[#a855f71a] text-accent-purple",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ),
                },
                {
                  title: "Team Collaboration",
                  desc: "Invite team members, share projects, and collaborate in real-time.",
                  iconColor: "bg-[#3b82f61a] text-accent-blue",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                },
                {
                  title: "Analytics",
                  desc: "Track usage, measure performance, and optimize your content strategy.",
                  iconColor: "bg-[#10b9811a] text-accent-emerald",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  ),
                },
                {
                  title: "API Access",
                  desc: "Integrate our AI into your apps with our comprehensive REST API.",
                  iconColor: "bg-[#f59e0b1a] text-accent-amber",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  ),
                },
                {
                  title: "Integrations",
                  desc: "Connect with your favorite tools like YouTube, WordPress, and Shopify.",
                  iconColor: "bg-[#ec48991a] text-accent-pink",
                  icon: (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  ),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-bg-tertiary border border-border-color rounded-[20px] p-8 transition-all hover:border-border-hover hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
                >
                  <div
                    className={`w-12 h-12 rounded-[14px] flex items-center justify-center mb-5 ${item.iconColor}`}
                  >
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {item.desc}
                  </p>
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
