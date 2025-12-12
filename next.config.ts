import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chessboardjs.com",
        pathname: "/img/chesspieces/wikipedia/*",
      },
    ],
  },
};

export default nextConfig;
