import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { testDatabaseUrl } from './tests/database-guard.mjs';
const testUrl=testDatabaseUrl();
const env={PORT:'3011',CLIENT_PORT:'5183',APP_ORIGIN:'http://127.0.0.1:5183',DATABASE_URL:testUrl||'',UPLOAD_DIR:fileURLToPath(new URL('./test-results/uploads',import.meta.url))};
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.js',globalSetup:'./tests/setup-database.mjs',workers:1,
  use:{baseURL:'http://127.0.0.1:5183',channel:'chrome',headless:true,viewport:{width:1440,height:1050}},
  // Wait for API readiness too; file watching can restart the API mid-request
  // when Prisma first loads its generated engine during tests.
  webServer:[
    {command:'node --env-file-if-exists=.env server/src/index.js',url:'http://127.0.0.1:3011/api/health',env,reuseExistingServer:false,timeout:30000},
    {command:'npm.cmd run dev --workspace client',url:'http://127.0.0.1:5183',env,reuseExistingServer:false,timeout:30000},
  ],
});
