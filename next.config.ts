import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode está desligado por causa do useChat do AI SDK v7: o hook chama
  // `chat.stop()` no cleanup, abortando qualquer fetch em andamento. Em Strict
  // Mode dev o useEffect dispara → unmount → remount, e o unmount cancela o
  // sendMessage do autostart (criar conv + 1ª resposta) antes dele chegar no
  // /api/chat. Em produção não existe Strict Mode double-fire. Pra evitar que
  // dev e prod divirjam, mantemos consistência com produção.
  reactStrictMode: false,
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
