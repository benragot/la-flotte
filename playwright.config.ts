import { defineConfig } from "@playwright/test";
import { devCommand, resolvePort, suiteRoot } from "./tests/ui/playwrightPort";

const CI = process.env.CI !== undefined;
const ROOT = suiteRoot();
const PORT = resolvePort(process.env, ROOT);
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
  globalSetup: "./tests/ui/playwrightGlobalSetup.ts",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: projects(),
  webServer: {
    command: devCommand(PORT),
    url: BASE_URL,
    // Jamais de réutilisation : sur un port voisin, Playwright mesurerait le
    // serveur d'un autre worktree (vert sur du code qu'on n'a pas écrit).
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
