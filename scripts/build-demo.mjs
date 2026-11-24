import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', 'dist-demo'], { cwd: path.join(root, 'client'), env: { ...process.env, VITE_DEMO_ONLY: 'true' }, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const out = path.join(root, 'client/dist-demo');
const manifest = JSON.parse(await readFile(path.join(out, 'manifest.webmanifest'), 'utf8')); manifest.start_url = '/demo';
await writeFile(path.join(out, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
// Explicit route documents also work on static hosts without a SPA fallback.
for (const route of ['demo', 'app', 'login', 'register']) { await mkdir(path.join(out, route), { recursive: true }); await copyFile(path.join(out, 'index.html'), path.join(out, route, 'index.html')); }
console.log('Public demo built in client/dist-demo. No server or private records are included.');
