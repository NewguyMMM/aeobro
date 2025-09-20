/** @type {import('next').NextConfig} */

// --- Security Headers ---
const securityHeaders = [
  // Enforce HTTPS (browsers that have seen this header)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Disable MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Basic XSS protection
  { key: "X-XSS-Protection", value: "0" }, // modern browsers use CSP; leave 0 to avoid legacy quirks
  // Limit referrer leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful APIs (tune as needed)
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
      "screen-wake-lock=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
];

// --- Caching for static/optimized assets ---
const cacheHeaders = [
  {
    // Next.js build output
    source: "/_next/static/:path*",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  },
  {
    // Next.js image optimizer
    source: "/_next/image",
    headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=86400" }],
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // ✅ Image optimization (AVIF/WebP + remote host allowlist)
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 1 day

    // Use wildcards where CDNs vary by subdomain
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "media.licdn.com" }, // LinkedIn
      { protocol: "https", hostname: "avatars.githubusercontent.com" }, // GitHub
      { protocol: "https", hostname: "yt3.ggpht.com" }, // YouTube channel avatars

      // Instagram often uses varying scontent subdomains/CDNs
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "static.cdninstagram.com" },

      // TikTok / other common creator CDNs (optional; keep if you embed)
      { protocol: "https", hostname: "p16-sign-va.tiktokcdn.com" },
      { protocol: "https", hostname: "*.tiktokcdn.com" },

      // Substack / Etsy avatars (optional)
      { protocol: "https", hostname: "substackcdn.com" },
      { protocol: "https", hostname: "images.squarespace-cdn.com" },
      { protocol: "https", hostname: "i.etsystatic.com" },

      // If you host images on your own CDN/domain, add it here:
      // { protocol: "https", hostname: "cdn.aeobro.com" },
      // { protocol: "https", hostname: "aeobro.com" },
      // { protocol: "https", hostname: "aeobro.vercel.app" },
    ],
  },

  async headers() {
    // Apply security headers to all routes, and strong caching to static assets
    return [
      { source: "/:path*", headers: securityHeaders },
      ...cacheHeaders,
    ];
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
