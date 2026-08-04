/**
 * Next.js application configuration for bughouse-chess.
 *
 * Enables React cache components and whitelists remote image hosts used by the
 * chess board (chessboardjs piece sprites) and Firebase Auth profile avatars.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chessboardjs.com",
        pathname: "/img/chesspieces/wikipedia/*",
      },
      // Google profile avatars (Firebase Auth)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
