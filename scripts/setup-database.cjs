// Interactive local setup. Never deletes databases or changes existing passwords.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');

const root = path.resolve(__dirname, '..');
const output = new Writable({ write(chunk, encoding, done) { if (!output.muted) process.stdout.write(chunk); done(); } });
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
async function password(prompt) {
  process.stdout.write(prompt);
  output.muted = true;
  try { return await rl.question(''); }
  finally { output.muted = false; process.stdout.write('\n'); }
}
async function main() {
  const envPath = path.join(root, '.env');
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (/^\s*(DATABASE_URL|TEST_DATABASE_URL)\s*=/m.test(existing)) {
    console.log('В .env уже есть подключение. Файл не изменён. Проверьте настройки вручную.'); return;
  }
  const psql = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
  if (!fs.existsSync(psql)) throw new Error('Не найден PostgreSQL 18. Уточните путь psql в scripts/setup-database.cjs.');
  console.log('Проверка локальных баз petday и petday_test. Существующие базы и данные не удаляются.');
  const admin = (await rl.question('Пользователь PostgreSQL [postgres]: ')).trim() || 'postgres';
  const adminPassword = await password('Пароль PostgreSQL (не отображается): ');
  function sql(query, database = 'postgres') {
    const result = spawnSync(psql, ['-X', '-w', '-h', '127.0.0.1', '-U', admin, '-d', database, '-v', 'ON_ERROR_STOP=1', '-tA'], {
      input: query, encoding: 'utf8', env: { ...process.env, PGPASSWORD: adminPassword, PGCONNECT_TIMEOUT: '5', LC_MESSAGES: 'C' }, windowsHide: true,
    });
    if (result.status !== 0) {
      const diagnostic = result.stderr || '';
      const reason = /password authentication failed|28P01/i.test(diagnostic) ? 'Проверка пароля не пройдена: неверное имя пользователя или пароль.'
        : /no password supplied/i.test(diagnostic) ? 'Пароль не был введён.'
        : /permission denied|must be superuser/i.test(diagnostic) ? 'У пользователя нет прав на создание роли или базы.'
        : /Connection refused|could not connect|timeout expired/i.test(diagnostic) ? 'Сервер 127.0.0.1:5432 недоступен.'
        : /no pg_hba.conf entry/i.test(diagnostic) ? 'Подключение запрещено правилами pg_hba.conf.'
        : 'Команда PostgreSQL завершилась ошибкой; проверьте доступ к выбранной базе.';
      throw new Error(reason + ' Пароли и строки подключения не выведены.');
    }
    return result.stdout.trim();
  }
  sql('SELECT 1;');
  const names = sql("SELECT datname FROM pg_database WHERE datname IN ('petday','petday_test');");
  console.log(names ? `Найдены базы: ${names.replaceAll('\n', ', ')}` : 'Баз petday и petday_test пока нет.');
  const roleExists = sql("SELECT 1 FROM pg_roles WHERE rolname='petday_app';") === '1';
  let appPassword;
  if (roleExists) appPassword = await password('Пароль существующего пользователя petday_app (не изменяется): ');
  else {
    appPassword = crypto.randomBytes(32).toString('base64url');
    sql(`CREATE ROLE petday_app LOGIN PASSWORD '${appPassword}';`);
  }
  for (const name of ['petday', 'petday_test']) {
    if (!names.split(/\r?\n/).includes(name)) { sql(`CREATE DATABASE ${name} OWNER petday_app;`); console.log(`Создана база ${name}.`); }
  }
  // Verify both connections before writing local settings. Existing permissions are never changed.
  for (const name of ['petday', 'petday_test']) {
    const check = spawnSync(psql, ['-X', '-w', '-h', '127.0.0.1', '-U', 'petday_app', '-d', name, '-tA', '-c', 'SELECT 1;'], {
      encoding: 'utf8', env: { ...process.env, PGPASSWORD: appPassword }, windowsHide: true,
    });
    if (check.status !== 0) throw new Error(`Нет доступа petday_app к ${name}. Существующие права не изменены. Настройте подключение с владельцем этой базы.`);
  }
  const prefix = `postgresql://petday_app:${encodeURIComponent(appPassword)}@127.0.0.1:5432/`;
  fs.writeFileSync(envPath, `${existing.trimEnd()}\nDATABASE_URL="${prefix}petday"\nTEST_DATABASE_URL="${prefix}petday_test"\n`);
  console.log('Готово. Подключения сохранены только в C:\\petday\\.env, пароли не выведены. Сообщите в чате «готово».');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => rl.close());
