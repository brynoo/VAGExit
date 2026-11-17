import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], server: { host: true, port: 8777, allowedHosts: true }, preview: { host: true, port: 8777, allowedHosts: true }, build: { chunkSizeWarningLimit: 900 } });
