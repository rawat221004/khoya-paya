/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // lowdb is a pure-ESM package used only on the server; mark it external so the
  // Next.js server bundle requires it at runtime instead of trying to bundle it.
  experimental: {
    serverComponentsExternalPackages: ["lowdb"],
  },
};

export default nextConfig;
