import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? "/ANATOMI" : undefined,
  assetPrefix: isGithubPages ? "/ANATOMI" : undefined,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubPages ? "/ANATOMI" : "",
  },
};

export default nextConfig;
