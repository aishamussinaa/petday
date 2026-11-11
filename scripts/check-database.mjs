import { database, disconnect } from '../server/src/db.js';
try {
  await database().$queryRaw`SELECT 1`;
  await database().user.count();
  console.log('PostgreSQL доступен; таблицы PetDay созданы.');
} catch (error) {
  console.error('База или таблицы недоступны. Проверьте .env и выполните npm.cmd run db:migrate. Код:', error.code || 'DATABASE_UNAVAILABLE');
  process.exitCode = 1;
} finally { await disconnect(); }
