/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a localhost production build run beside an existing dev server
  // without sharing or locking the same .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.100", "192.168.0.102"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
