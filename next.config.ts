import type { NextConfig } from "next";

const backendBaseUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8010";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
