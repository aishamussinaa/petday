import { app } from './app.js';
import { cleanup } from './photos.js';
import { disconnect } from './db.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT должен быть целым числом от 1 до 65535');
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`PetDay API: http://127.0.0.1:${port}`);
});
server.on('error', (error) => {
  console.error(`Не удалось запустить API: ${error.code}`);
  process.exit(1);
});

if (process.env.DATABASE_URL) {
  const clean = () => cleanup().catch(() => console.error('Upload cleanup deferred: database or storage unavailable'));
  clean();
  setInterval(clean, 3600000).unref();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await disconnect(); process.exit(0); });
});
