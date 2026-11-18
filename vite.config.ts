import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // A different port from the game (5173) so both can run on your computer at the same time.
  server: { port: 5174 },
  test: { environment: "node" },
});
