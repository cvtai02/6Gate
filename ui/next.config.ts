import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 10MB; bump for video uploads going through proxy.ts.
    externalDir: true,
    proxyClientMaxBodySize: "2gb",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:20130/api/:path*",
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
