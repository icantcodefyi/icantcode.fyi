import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@my-better-t-app/api",
    "@my-better-t-app/auth",
    "@my-better-t-app/db",
    "@my-better-t-app/env",
  ],
};

export default nextConfig;
