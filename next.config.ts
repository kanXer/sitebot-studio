import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'jimp',
    'qrcode',
  ],
};

export default nextConfig;
