import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 30_000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5500',
  },
  reporter: [['list']]
});