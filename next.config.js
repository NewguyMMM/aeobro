/** @type {import('next').NextConfig} */
const nextConfig = {
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
