import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "192.168.137.1",
    "127.0.0.1",
  ],
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
