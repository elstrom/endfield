import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "react";
            if (id.includes("lodash")) return "lodash";
            if (id.includes("@xyflow/system")) return "xyflow";
            if (id.includes("elkjs")) return "elkjs";
            if (id.includes("d3-selection") || id.includes("d3-transition"))
              return "d3";
          }
        },
      },
    },
  },
  define: {
    // Inject version and build info as global constants
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
});

function getVersion() {
  return "v1.0.0";
}
