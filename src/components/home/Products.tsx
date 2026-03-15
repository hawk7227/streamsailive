import Link from "next/link";

export default function Products() {
  const products = [
    {
      name: "Video Studio",
      description: "Professional video editing and generation suite.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ),
      color: "bg-accent-indigo",
    },
    {
      name: "Voice Lab",
      description: "Advanced voice synthesis and cloning.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
      ),
      color: "bg-accent-purple",
    },
    {
      name: "Image Generator",
      description: "Create images from text descriptions.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      color: "bg-accent-orange",
    },
    {
      name: "Copywriter",
      description: "Generate high-converting marketing copy.",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      color: "bg-accent-emerald",
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <div
              key={index}
              className="bg-bg-secondary border border-border-color rounded-3xl p-8 transition-all hover:border-border-hover hover:-translate-y-1 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent-indigo to-accent-purple opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${product.color}`}
              >
                {product.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
              <p className="text-text-secondary text-sm mb-4">
                {product.description}
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-accent-indigo font-medium text-sm transition-all hover:gap-2.5"
              >
                Learn more
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
