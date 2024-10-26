/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.chess.com",
        pathname: "/chess-themes/pieces/**",
      },
    ],
  },
};

module.exports = nextConfig;
