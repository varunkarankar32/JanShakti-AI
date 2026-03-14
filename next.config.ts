import type { NextConfig } from "next";

const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://varunka-janshakti-backend.hf.space").trim();
const withProtocol = /^https?:\/\//i.test(rawBackendBaseUrl) ? rawBackendBaseUrl : `https://${rawBackendBaseUrl}`;
const backendBaseUrl =
  /^http:\/\//i.test(withProtocol) && !/localhost|127\.0\.0\.1/i.test(withProtocol)
    ? withProtocol.replace(/^http:\/\//i, "https://")
    : withProtocol;

const nextConfig: NextConfig = {
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
