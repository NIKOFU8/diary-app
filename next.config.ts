import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-push は Node 専用パッケージなのでバンドルせず外部依存として扱う
  serverExternalPackages: ["web-push"],
};

export default nextConfig;
