import { defineConfig } from "@playwright/test";
import { resolvePort, shouldReuseServer } from "./tests/ui/playwrightPort";

const CI = process.env.CI !== undefined;
const PORT = resolvePort(process.env);
const BASE_URL = `http://localhost:${PORT}`;

/** Les trois largeurs réellement visées par le joueur : portable, HD, écran large. */
const VIEWPORTS = [
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

function projects() {
  return VIEWPORTS.map((viewport) => ({
    name: viewport.name,
    use: { viewport: { width: viewport.width, height: viewport.height } },
  }));
}

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: projects(),
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: shouldReuseServer(process.env),
    timeout: 120_000,
  },
});
