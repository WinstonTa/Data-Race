import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data Race is a fully client-side app; ship it as static HTML/JS.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
