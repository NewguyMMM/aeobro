/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // ✅ Image optimization (AVIF/WebP + remote host allowlist)
  images: {
    formats: ["image/avif", "image/webp"],
    // Helps reduce re-fetching of remote images by the optimizer (in seconds)
    minimumCacheTTL: 86400, // 1 day; adjust to your update cadence

    remotePatterns: [
      // Common CDNs you’re likely to reference in profile fields
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "media.licdn.com" },           // LinkedIn images
      { protocol: "https", hostname: "avatars.githubusercontent.com" }, // GitHub avatars
      { protocol: "https", hostname: "yt3.ggpht.com" },             // YouTube channel avatars
      { protocol: "https", hostname: "scontent.cdninstagram.com" }, // Instagram CDN

      // If you host images on your own domain/CDN, add it here:
      // { protocol: "https", hostname: "cdn.aeobro.com" },
      // { protocol: "https", hostname: "aeobro.vercel.app" }, // only if you ever serve images from your app domain
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
