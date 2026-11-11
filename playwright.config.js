import { defineConfig } from '@playwright/test';
import { testDatabaseUrl } from './tests/database-guard.mjs';
const testUrl = testDatabaseUrl();

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/setup-database.mjs',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5183', channel: 'chrome', headless: true, viewport: { width: 1440, height: 1050 } },
  webServer: {
    command: 'npm.cmd run dev',
    url: 'http://127.0.0.1:5183',
    env: { PORT: '3011', CLIENT_PORT: '5183', APP_ORIGIN: 'http://127.0.0.1:5183', DATABASE_URL: testUrl || '', UPLOAD_DIR: '../test-results/uploads' },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
