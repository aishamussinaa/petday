const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { recoveryFiles, withRecovery, rule } = require('../scripts/reset-postgres-password.cjs');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petday-recovery-test-'));
  const hba = path.join(dir, 'pg_hba.conf');
  const original = Buffer.from('# existing\r\nhost all all 127.0.0.1/32 scram-sha-256\r\n');
  fs.writeFileSync(hba, original);
  t.after(() => { for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir,file)); fs.rmdirSync(dir); });
  return { hba, original, files: recoveryFiles(hba) };
}
test('successful recovery restores exact bytes and removes only its backup', t => {
  const { hba, original, files } = fixture(t);
  withRecovery(files, () => assert.ok(fs.readFileSync(hba).subarray(0,rule.length).equals(rule)));
  assert.deepEqual(fs.readFileSync(hba), original); assert.equal(files.exists(),false);
});
test('password command failure still restores authentication', t => {
  const { hba, original, files } = fixture(t);
  assert.throws(() => withRecovery(files, () => { throw new Error('psql failed'); }), /psql failed/);
  assert.deepEqual(fs.readFileSync(hba), original);
});
test('overlapping recovery never overwrites a previous backup', t => {
  const { hba, files } = fixture(t); files.enable();
  const before = fs.readFileSync(hba);
  assert.throws(() => files.enable(), { code:'EEXIST' });
  assert.deepEqual(fs.readFileSync(hba),before); files.restore();
});
test('unrelated appended rules survive cleanup', t => {
  const { hba, original, files } = fixture(t); files.enable();
  fs.appendFileSync(hba, '# concurrent edit\r\n'); files.restore();
  assert.equal(fs.readFileSync(hba,'utf8'), original.toString()+'# concurrent edit\r\n');
});
test('ambiguous concurrent replacement is not overwritten and backup is retained', t => {
  const { hba, files } = fixture(t); files.enable(); fs.writeFileSync(hba,'# changed externally\n');
  assert.throws(() => files.restore(), /другим процессом/);
  assert.equal(files.exists(),true); assert.equal(fs.readFileSync(hba,'utf8'),'# changed externally\n');
});
