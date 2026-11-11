import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl sans routage i18n (ADR-007) : la locale vient de src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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

export default withNextIntl(nextConfig);
