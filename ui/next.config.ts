import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Default is 10MB; bump for video uploads going through proxy.ts.
    externalDir: true,
    proxyClientMaxBodySize: "2gb",
  },
  async rewrites() {
    // Browser calls to /api/* on this origin are proxied to the NestJS API.
    // In production (Vercel) set API_BASE_URL to the public API origin.
    const apiOrigin = process.env.API_BASE_URL ?? process.env.API_URL ?? "http://localhost:20130";
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
