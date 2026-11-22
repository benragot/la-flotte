import { defineConfig } from "@playwright/test";

const CI = process.env.CI !== undefined;
const BASE_URL = "http://localhost:4173";

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
    command: "npm run dev -- --port 4173 --strictPort",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
