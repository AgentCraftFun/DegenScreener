/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@degenscreener/shared",
    "@degenscreener/db",
  ],
  output: "standalone",
};

module.exports = nextConfig;
