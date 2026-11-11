import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components non adopté : l'app lit des cookies serveur partout (plan socle, § Décisions).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
