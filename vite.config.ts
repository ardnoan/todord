import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Supabase
          if (id.includes("/node_modules/@supabase/")) {
            return "supabase-vendor";
          }
          // React core
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          // Framer Motion
          if (id.includes("/node_modules/framer-motion/")) {
            return "framer-vendor";
          }
          // Recharts + its deps (d3, victory-vendor, etc.)
          if (
            id.includes("/node_modules/recharts/") ||
            id.includes("/node_modules/d3-") ||
            id.includes("/node_modules/victory-vendor/")
          ) {
            return "recharts-vendor";
          }
          // Lucide icons
          if (id.includes("/node_modules/lucide-react/")) {
            return "lucide-vendor";
          }
          return undefined;
        },
      },
    },
  },
});
