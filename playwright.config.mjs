import {defineConfig, devices} from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.mjs/,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {baseURL: "http://localhost:3100", ...devices["Pixel 7"], ...(process.env.CI ? {} : {channel: "chrome"})},
  webServer: {command: "node tests/servidor-pruebas.mjs", url: "http://localhost:3100", reuseExistingServer: !process.env.CI}
});
