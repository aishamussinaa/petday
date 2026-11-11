import { spawnSync } from 'node:child_process';
import { testDatabaseUrl } from './database-guard.mjs';
export default async function setup() {
  const url = testDatabaseUrl();
  if (!url) { console.log('Database integration tests skipped: configure TEST_DATABASE_URL.'); return; }
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true,
  });
  if (result.status !== 0) throw new Error('Could not migrate the isolated test database; connection details suppressed.');
}
