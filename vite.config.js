import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/.codex-tmp/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        /* Three sustenta a hero, mas nao precisa engrossar o arquivo principal.
           O Ripple/OGL continua no chunk adiado da showcase. */
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
