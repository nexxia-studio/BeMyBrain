import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Import relatif : next.config.ts est chargé hors des alias tsconfig.
import { securityHeaders } from "./src/lib/security-headers";

// next-intl sans routage i18n (ADR-007) : la locale vient de src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Cache Components non adopté : l'app lit des cookies serveur partout (plan socle, § Décisions).
  // En-têtes de sécurité sur toutes les routes ; la CSP, à nonce, est posée par src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          isProduction: process.env.NODE_ENV === "production",
        }),
      },
    ];
  },
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
