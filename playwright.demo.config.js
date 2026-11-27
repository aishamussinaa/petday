import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4183';

export default defineConfig({
  testDir: './tests',
  testMatch: ['walk-tour.spec.js', 'vet-summary.spec.js'],
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL, channel: 'chrome' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview client --outDir dist-demo --host 127.0.0.1 --port 4183 --strictPort',
    url: baseURL + '/demo/index.html',
    reuseExistingServer: false,
  },
});
