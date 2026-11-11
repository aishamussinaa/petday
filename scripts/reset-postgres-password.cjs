// Run locally in an elevated Windows terminal. No database is dropped or stopped.
// A narrowly scoped loopback rule is restored in finally, including on errors.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const data = 'C:\\Program Files\\PostgreSQL\\18\\data';
const bin = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const hba = `${data}\\pg_hba.conf`;
const backup = `${hba}.petday-password-backup`;
const rule = '# PetDay temporary password recovery - restore immediately\r\nhost postgres postgres 127.0.0.1/32 trust\r\n';
const output = new Writable({ write(chunk, encoding, done) { if (!output.muted) process.stdout.write(chunk); done(); } });
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
let changed = false;
function reload() {
  const result = spawnSync(`${bin}\\pg_ctl.exe`, ['reload', '-D', data], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Не удалось перечитать правила PostgreSQL. Запустите этот скрипт с --restore от имени администратора.');
}
function restore() {
  if (!fs.existsSync(backup)) throw new Error('Резервная копия не найдена; правила не менялись.');
  const current = fs.readFileSync(hba, 'utf8');
  if (current.startsWith(rule)) fs.writeFileSync(hba, current.slice(rule.length));
  else if (!fs.readFileSync(hba).equals(fs.readFileSync(backup))) throw new Error('Правила изменены другим процессом. Не перезаписываю их; нужна ручная проверка pg_hba.conf.');
  reload(); changed = false;
  fs.unlinkSync(backup);
  console.log('Исходные правила проверки пароля восстановлены.');
}
function query(sql, password = '') {
  return spawnSync(`${bin}\\psql.exe`, ['-X', '-w', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], {
    input: sql, encoding: 'utf8', windowsHide: true, env: { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '3', LC_MESSAGES: 'C' },
  });
}
async function secret(prompt) {
  process.stdout.write(prompt); output.muted = true;
  try { return await rl.question(''); } finally { output.muted = false; process.stdout.write('\n'); }
}
async function main() {
  if (process.argv.includes('--restore')) { restore(); return; }
  fs.accessSync(hba, fs.constants.R_OK | fs.constants.W_OK);
  if (fs.existsSync(backup)) throw new Error('Есть незавершённое восстановление. Сначала выполните этот скрипт с --restore.');
  console.log('Будет изменён только пароль локального postgres. Базы и данные сохраняются.');
  const password = await secret('Новый пароль postgres (от 12 символов, не отображается): ');
  if (password.length < 12) throw new Error('Пароль должен содержать минимум 12 символов. Настройки не изменены.');
  if (password !== await secret('Повторите новый пароль: ')) throw new Error('Пароли не совпали. Настройки не изменены.');
  // Send a SCRAM verifier, never the plaintext password, in the ALTER ROLE statement.
  const salt = crypto.randomBytes(16);
  const salted = crypto.pbkdf2Sync(password.normalize('NFKC'), salt, 4096, 32, 'sha256');
  const client = crypto.createHmac('sha256', salted).update('Client Key').digest();
  const stored = crypto.createHash('sha256').update(client).digest('base64');
  const server = crypto.createHmac('sha256', salted).update('Server Key').digest('base64');
  const verifier = `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
  fs.copyFileSync(hba, backup, fs.constants.COPYFILE_EXCL);
  try {
    fs.writeFileSync(hba, Buffer.concat([Buffer.from(rule), fs.readFileSync(backup)])); changed = true; reload();
    let ready = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (query('SELECT 1;').status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('Временный доступ не открылся. Пароль не изменён.');
    if (query(`ALTER ROLE postgres PASSWORD '${verifier}';`).status !== 0) throw new Error('Смена пароля не выполнена.');
  } finally { if (changed) restore(); }
  // Wait until the server has reloaded password authentication; trust must be gone.
  for (let attempt = 0; attempt < 10; attempt++) {
    if (query('SELECT 1;').status !== 0) {
      if (query('SELECT 1;', password).status !== 0) throw new Error('Правила восстановлены, но новый пароль не прошёл проверку.');
      console.log('Готово: новый пароль работает, вход без пароля запрещён. Теперь запустите node scripts/setup-database.cjs.'); return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Файл восстановлен, но сервер ещё принимает вход без пароля. Нужна проверка перечитывания правил.');
}
process.on('SIGINT', () => { try { if (changed) restore(); } finally { process.exit(130); } });
main().catch(error => { console.error(error.code === 'EACCES' || error.code === 'EPERM' ? 'Откройте PowerShell от имени администратора и повторите команду. Настройки не изменены.' : error.message); process.exitCode = 1; }).finally(() => rl.close());
