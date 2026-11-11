// Windows PostgreSQL 18 recovery. Run interactively as Administrator.
// Password entry/encryption is handled by psql, never by this JavaScript program.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const data = 'C:/Program Files/PostgreSQL/18/data';
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const rule = Buffer.from('# PetDay temporary password recovery - restore immediately\r\nhost postgres postgres 127.0.0.1/32 trust\r\n');

function recoveryFiles(hba) {
  const backup = `${hba}.petday-password-backup`;
  return {
    enable() {
      // Exclusive backup prevents overlapping recovery attempts.
      fs.copyFileSync(hba, backup, fs.constants.COPYFILE_EXCL);
      try { fs.writeFileSync(hba, Buffer.concat([rule, fs.readFileSync(backup)])); }
      catch (error) { fs.copyFileSync(backup, hba); fs.unlinkSync(backup); throw error; }
    },
    restore() {
      const original = fs.readFileSync(backup);
      const current = fs.readFileSync(hba);
      if (current.subarray(0, rule.length).equals(rule)) {
        // Remove only our prefix, preserving unrelated edits and original bytes.
        fs.writeFileSync(hba, current.subarray(rule.length));
      } else if (!current.equals(original)) {
        throw new Error('Правила изменились другим процессом. Резервная копия сохранена; нужна ручная проверка pg_hba.conf.');
      }
      fs.unlinkSync(backup);
    },
    exists: () => fs.existsSync(backup),
  };
}
function withRecovery(files, action) {
  files.enable();
  try { return action(); } finally { files.restore(); }
}

function main() {
  if (process.platform !== 'win32') throw new Error('Этот помощник предназначен для PostgreSQL 18 в Windows.');
  const hba = path.join(data, 'pg_hba.conf');
  const files = recoveryFiles(hba);
  if (process.argv.includes('--restore')) { files.restore(); console.log('Исходные правила восстановлены.'); return; }
  if (!process.stdin.isTTY) throw new Error('Запустите помощник в отдельном интерактивном PowerShell от имени администратора.');
  fs.accessSync(hba, fs.constants.R_OK | fs.constants.W_OK);
  if (files.exists()) throw new Error('Есть незавершённое восстановление. Выполните node scripts/reset-postgres-password.cjs --restore.');
  if (!fs.existsSync(path.join(bin, 'psql.exe'))) throw new Error('Не найден psql.exe PostgreSQL 18.');
  // Ignore inherited connection settings and any saved password file.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'petday-login-'));
  const passfile = path.join(temp, 'empty.pgpass'); fs.writeFileSync(passfile, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  Object.assign(env, { PGPASSFILE: passfile, PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8' });
  const args = ['-X', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'];
  function run(commands, interactive = false, forcePassword = false) {
    const result = spawnSync(path.join(bin, 'psql.exe'), [...args, forcePassword ? '-W' : '-w', ...commands.flatMap(command => ['-c', command])], {
      env, encoding: 'utf8', windowsHide: true, stdio: interactive ? 'inherit' : 'pipe',
      ...(interactive ? {} : { timeout: 10000 }),
    });
    if (result.error) throw new Error(`Не удалось запустить psql: ${result.error.code || 'PROCESS_ERROR'}`);
    return result;
  }
  let active = false;
  const restoreOnExit = () => {
    if (active && files.exists()) {
      try { files.restore(); active = false; } catch { console.error('Выполните --restore от имени администратора.'); }
    }
  };
  process.on('exit', restoreOnExit);
  try {
    console.log('Меняется только пароль postgres. Базы и данные сохраняются.');
    console.log('Во время ввода временно разрешён вход postgres только с этого компьютера в базу postgres.');
    console.log('Не закрывайте окно. Придумайте и сохраните пароль от 12 символов. Введите его дважды в запросах psql.');
    withRecovery(files, () => {
      active = true;
      // Windows applies pg_hba.conf changes immediately to new connections.
      const connected = run(['SHOW data_directory;']);
      if (connected.status !== 0) throw new Error('Этап 1: нет подключения к локальному PostgreSQL 18. Пароль не менялся.');
      if (path.resolve(connected.stdout.trim()).toLowerCase() !== path.resolve(data).toLowerCase()) throw new Error('Этап 1: порт 5432 обслуживает другой экземпляр PostgreSQL. Пароль не менялся.');
      console.log('Этап 1: нужный сервер доступен.');
      const changed = run(["SET password_encryption = 'scram-sha-256';", '\\password postgres'], true);
      if (changed.status !== 0) throw new Error('Этап 2: psql не подтвердил смену пароля.');
      console.log('Этап 2: команда смены пароля выполнена.');
    });
    active = false;
    console.log('Этап 3: исходные правила авторизации восстановлены.');
    if (run(['SELECT 1;']).status === 0) throw new Error('Вход без пароля всё ещё разрешён исходными правилами. Нужна проверка конфигурации.');
    console.log('Теперь введите НОВЫЙ пароль ещё один раз для проверки входа.');
    if (run(['SELECT 1;'], true, true).status !== 0) throw new Error('Этап 4: вход не подтверждён. Правила уже восстановлены. Сохраните сообщение psql без пароля.');
    console.log('ГОТОВО: новый пароль работает; вход без пароля отклонён.');
    console.log('Следующая команда: node scripts/setup-database.cjs');
  } finally {
    restoreOnExit(); process.removeListener('exit', restoreOnExit);
    fs.unlinkSync(passfile); fs.rmdirSync(temp);
  }
}
module.exports = { recoveryFiles, withRecovery, rule };
if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(['EACCES','EPERM'].includes(error.code) ? 'Нужен PowerShell от имени администратора. Если операция началась, выполните --restore.' : error.message);
    process.exitCode = 1;
  }
}
