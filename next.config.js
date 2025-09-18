/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Image optimization (AVIF/WebP + remote host allowlist)
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Add/trim to match where your profile logos/avatars come from
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google-hosted avatars
      { protocol: "https", hostname: "media.licdn.com" },           // LinkedIn images
      // If you serve your own CDN/domain for images, add it here:
      // { protocol: "https", hostname: "cdn.aeobro.com" },
    ],
  },

  async redirects() {
    return [
      { source: "/sign-in", destination: "/login", permanent: false },
      { source: "/sign-up", destination: "/login", permanent: false },
      { source: "/signin", destination: "/login", permanent: false },
      { source: "/signup", destination: "/login", permanent: false },
      { source: "/auth/sign-in", destination: "/login", permanent: false },
      { source: "/auth/sign-up", destination: "/login", permanent: false },
    ];
  },
};

module.exports = nextConfig;
