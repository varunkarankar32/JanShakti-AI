import type { NextConfig } from "next";

const rawBackendBaseUrl = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8010"
).trim();
const withProtocol = /^https?:\/\//i.test(rawBackendBaseUrl) ? rawBackendBaseUrl : `https://${rawBackendBaseUrl}`;
const backendBaseUrl =
  /^http:\/\//i.test(withProtocol) && !/localhost|127\.0\.0\.1/i.test(withProtocol)
    ? withProtocol.replace(/^http:\/\//i, "https://")
    : withProtocol;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=(self)",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
