import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O usuário reenvia o histórico completo de viagens a cada quinzena (pode passar de
      // alguns MB e só tende a crescer), bem acima do padrão de 1 MB do Next.js.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
